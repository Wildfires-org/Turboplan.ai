/**
 * Map router for handling geospatial layer operations
 */
import { Hono } from "hono";
import { z } from "zod";

import { getApiEnv } from "@wildfires-org/turboplan-env";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import {
  getRBACServiceForRequest,
  type RBACContext,
  requirePermission,
  requireProjectReadOrPublicGov,
} from "@wildfires-org/turboplan-rbac/hono";
import { createTimelineRecord } from "@wildfires-org/turboplan-timeline-records/server";
import { assertSafeFetchUrl } from "@wildfires-org/turboplan-utils/ssrf";

import { createMapRepository } from "./repository";
import { createMapService, type IndividualLayerData } from "./service";

// Create a new Hono router
const router = new Hono<RBACContext>();

// Create singleton instances for repository and service
// These are shared across all requests to reuse connection pooling
const mapRepository = createMapRepository();
const mapService = createMapService(mapRepository);

// Schema for individual layer data - matches IndividualLayerData interface exactly
const layerDataSchema = z.object({
  name: z.string().min(1, "Layer name is required"),
  layerName: z.string().min(1, "Layer name is required"),
  sourceFilename: z.string().min(1, "Source filename is required"),
  fileType: z.string().min(1, "File type is required"),
  geoData: z
    .object({
      type: z.literal("FeatureCollection"),
      features: z.array(
        z.object({
          type: z.literal("Feature"),
          geometry: z.object({
            type: z.string(),
            coordinates: z.unknown(),
          }),
          properties: z.record(z.string(), z.unknown()).nullable(),
        }),
      ),
    })
    .optional(),
});

// Schema for layer upload validation
const layerUploadSchema = z
  .object({
    projectId: z.string().uuid("Valid project ID is required"),
    projectLayer: layerDataSchema.nullable().optional(),
    unitLayer: layerDataSchema.nullable().optional(),
    unitIdKey: z.string().optional(),
  })
  .refine((data) => data.projectLayer !== null || data.unitLayer !== null, {
    message: "At least one layer (projectLayer or unitLayer) must be provided",
  });

// Schema for map processing proxy request
const processRequestSchema = z.object({
  url: z.string().url("Valid URL is required"),
  filename: z.string().min(1, "Filename is required"),
});

// GIS processing is genuinely slow — a large archive means a download, a zip
// extraction and a full geometry parse upstream — so this is generous. It
// exists to stop a hung map-server from pinning a request (and its connection)
// open indefinitely, not to police normal processing time.
const MAP_SERVICE_TIMEOUT_MS = 150_000;

// Best-effort SSRF pre-check at the proxy entry. The map-server performs the
// authoritative DNS-resolution + redirect re-validation; this rejects the
// obvious internal targets before we spend a forward carrying the service key.
// Host classification comes from the shared classifier so this stays in step
// with every other guard in the monorepo.
const assertSafeProcessUrl = (raw: string): void => {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }

  // Loopback stays blocked in every environment, dev included: the URL is an
  // uploaded-asset URL from object storage, never a local address.
  const guardError = assertSafeFetchUrl(parsed, { allowHttp: true });
  if (guardError) {
    throw new Error(
      guardError === "URL must use HTTP or HTTPS."
        ? "Only HTTP and HTTPS URLs are allowed"
        : guardError,
    );
  }
};

// Layer upload endpoint
router.post("/layers/upload", async (c) => {
  try {
    // Check authentication first
    const user = c.get("user");
    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Get raw body
    const rawBody = await c.req.json().catch(() => null);

    // Validate the body
    const validationResult = layerUploadSchema.safeParse(rawBody);
    if (!validationResult.success) {
      return c.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        400,
      );
    }

    const body = validationResult.data;

    // Check permission manually after validating body

    const rbacService = getRBACServiceForRequest(c);
    const permissionResult = await rbacService.checkPermission(
      user.userId,
      body.projectId,
      EntityType.PROJECT,
      Action.CREATE,
    );

    if (!permissionResult.allowed) {
      return c.json(
        {
          error: "Forbidden",
          reason: permissionResult.reason,
        },
        403,
      );
    }

    // Upload layer using service with validated data (using shared singleton instances)
    // Type assertion is safe: Zod validation guarantees all required fields are present
    // The inferred type includes optional/nullable markers that don't reflect runtime reality after validation
    const result = await mapService.createLayersFromFiles({
      projectId: body.projectId,
      projectLayer: body.projectLayer as IndividualLayerData | null,
      unitLayer: body.unitLayer as IndividualLayerData | null,
      unitIdKey: body.unitIdKey,
    });

    if (!result.success) {
      return c.json(
        {
          error: result.error || "Failed to upload layer",
          warnings: result.warnings,
        },
        400,
      );
    }

    const layers = result.layers || (result.layer ? [result.layer] : []);

    // Record a single timeline entry for the upload (not one per layer)
    if (layers.length > 0) {
      await createTimelineRecord({
        projectId: body.projectId,
        userId: user.userId,
        entityType: "map_layer",
        entityId: body.projectId,
        action: "created",
        metadata: {
          layerIds: layers.map((l) => l.id),
          layerNames: layers.map((l) => l.name),
        },
      });
    }

    // Return success response with information about all created layers
    return c.json({
      success: true,
      message: `${layers.length} layer${layers.length > 1 ? "s" : ""} uploaded successfully`,
      layerId: result.layer?.id, // For backward compatibility
      featureCount: result.layer?.featureCount || 0, // For backward compatibility
      layers: layers.map((layer) => ({
        id: layer.id,
        name: layer.name,
        layerType: layer.layerType,
        featureCount: layer.featureCount,
        unitIdKey: layer.unitIdKey,
        unitAcresKey: layer.unitAcresKey,
      })),
      warnings: result.warnings,
    });
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      500,
    );
  }
});

router.get(
  "/layers/project/:projectId",
  requireProjectReadOrPublicGov((c) => c.req.param("projectId")!, {
    moduleName: "map",
  }),
  async (c) => {
    const projectId = c.req.param("projectId")!;
    const layers =
      await mapRepository.getLayersWithFeaturesForProject(projectId);
    return c.json(layers);
  },
);

router.delete(
  "/layers/project/:projectId",
  requirePermission(
    EntityType.PROJECT,
    Action.DELETE,
    (c) => c.req.param("projectId")!,
  ),
  async (c) => {
    const projectId = c.req.param("projectId")!;
    const user = c.get("user");
    await mapRepository.deleteLayersForProject(projectId);

    await createTimelineRecord({
      projectId: projectId,
      userId: user.userId,
      entityType: "map_layer",
      entityId: projectId,
      action: "deleted",
      metadata: { bulkDelete: true },
    });

    return c.json({ success: true });
  },
);

router.delete("/layers/:layerId", async (c) => {
  try {
    const layerId = c.req.param("layerId")!;

    if (!layerId) {
      return c.json({ error: "Layer ID is required" }, 400);
    }

    // Fetch the layer to get its projectId for permission check
    const layer = await mapRepository.getLayerById(layerId);

    if (!layer) {
      return c.json({ error: "Layer not found" }, 404);
    }

    // Check permission on the project
    const user = c.get("user");
    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const rbacService = getRBACServiceForRequest(c);
    const permissionResult = await rbacService.checkPermission(
      user.userId,
      layer.projectId,
      EntityType.PROJECT,
      Action.DELETE,
    );

    if (!permissionResult.allowed) {
      return c.json(
        {
          error: "Forbidden",
          reason: permissionResult.reason,
        },
        403,
      );
    }

    // Now delete the layer
    await mapRepository.deleteLayerById(layerId);

    await createTimelineRecord({
      projectId: layer.projectId,
      userId: user.userId,
      entityType: "map_layer",
      entityId: layerId,
      entityName: layer.name,
      action: "deleted",
    });

    return c.json({ success: true });
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      500,
    );
  }
});

// Proxy endpoint for map processing service
router.post("/process", async (c) => {
  try {
    // Check authentication first
    const user = c.get("user");

    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Get and validate request body
    const rawBody = await c.req.json().catch(() => null);
    const validationResult = processRequestSchema.safeParse(rawBody);

    if (!validationResult.success) {
      return c.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        400,
      );
    }

    const body = validationResult.data;

    // Reject internal/private targets before forwarding with the service key.
    try {
      assertSafeProcessUrl(body.url);
    } catch (urlError) {
      return c.json(
        {
          error: urlError instanceof Error ? urlError.message : "Invalid URL",
        },
        400,
      );
    }

    // Get environment configuration
    const ENV = getApiEnv();

    // Forward request to map processing service
    let response: Response;
    try {
      response = await fetch(`${ENV.MAP_SERVICE_URL}/api/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": ENV.MAP_SERVICE_API_KEY,
        },
        body: JSON.stringify({
          url: body.url,
          filename: body.filename,
        }),
        signal: AbortSignal.timeout(MAP_SERVICE_TIMEOUT_MS),
      });
    } catch (fetchError) {
      const name = fetchError instanceof Error ? fetchError.name : "";
      if (name === "TimeoutError" || name === "AbortError") {
        console.error("Map processing service timed out", {
          timeoutMs: MAP_SERVICE_TIMEOUT_MS,
        });
        return c.json({ error: "Map processing service timed out" }, 504);
      }
      // The failure text names the internal service host and port, so it stays
      // server-side.
      console.error("Map processing service request failed", fetchError);
      return c.json({ error: "Map processing service unavailable" }, 502);
    }

    if (!response.ok) {
      // The upstream body can carry internal paths, library internals or the
      // service's own error detail. Log it, return only the status class.
      const errorText = await response.text().catch(() => "Unknown error");
      console.error("Map processing service error", {
        status: response.status,
        body: errorText,
      });
      return c.json(
        { error: `Map processing service error: ${response.status}` },
        502,
      );
    }

    // Forward the successful response
    const data = await response.json();
    return c.json(data);
  } catch (error) {
    console.error("Unexpected error proxying map processing request", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default router;
