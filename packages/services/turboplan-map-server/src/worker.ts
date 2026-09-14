import { Container } from "@cloudflare/containers";

type Env = {
  MAP_CONTAINER: DurableObjectNamespace;
  MAP_SERVICE_API_KEY: string;
  ALLOWED_ORIGINS: string;
};

export class MapContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "300s";

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    if (!env.MAP_SERVICE_API_KEY) {
      throw new Error("MAP_SERVICE_API_KEY secret is required");
    }
    if (!env.ALLOWED_ORIGINS) {
      throw new Error("ALLOWED_ORIGINS secret is required");
    }
    this.envVars = {
      MAP_SERVICE_API_KEY: env.MAP_SERVICE_API_KEY,
      ALLOWED_ORIGINS: env.ALLOWED_ORIGINS,
      PYTHON_ENV: "production",
    };
  }

  override onStart() {
    console.log("Map container started");
  }

  override onError(error: unknown) {
    console.log("Map container error:", error);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const id = env.MAP_CONTAINER.idFromName("map-server");
    const container = env.MAP_CONTAINER.get(id);
    return await container.fetch(request);
  },
};
