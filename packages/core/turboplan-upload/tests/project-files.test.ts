import assert from "node:assert";
import { describe, it } from "node:test";

import {
  classifyProjectFile,
  GIS_FILE_EXTENSIONS,
  GIS_MAX_FILE_SIZE,
  GIS_MIME_TYPES,
  GIS_UPLOAD_CONTENT_TYPES,
  getProjectFileMaxSize,
  isAllowedUploadContentType,
  isShapefilePart,
  PROJECT_DOCUMENT_ACCEPT,
  PROJECT_DOCUMENT_MAX_FILE_SIZE,
  PROJECT_DOCUMENT_MIME_TYPES,
  PROJECT_FILE_ACCEPT,
  resolveProjectFileContentType,
  withResolvedContentType,
} from "../src/types";

const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("classifyProjectFile", () => {
  it("classifies PDF and Word files as documents", () => {
    assert.strictEqual(
      classifyProjectFile({ name: "plan.pdf", type: "application/pdf" }),
      "document",
    );
    assert.strictEqual(
      classifyProjectFile({ name: "notes.DOCX", type: DOCX }),
      "document",
    );
    assert.strictEqual(
      classifyProjectFile({ name: "old.doc", type: "application/msword" }),
      "document",
    );
  });

  it("classifies by extension when the browser reports no usable type", () => {
    assert.strictEqual(
      classifyProjectFile({ name: "report.docx", type: "" }),
      "document",
    );
    assert.strictEqual(
      classifyProjectFile({
        name: "layers.zip",
        type: "application/octet-stream",
      }),
      "gis",
    );
  });

  it("classifies ZIP archives as GIS uploads", () => {
    assert.strictEqual(
      classifyProjectFile({ name: "units.zip", type: "application/zip" }),
      "gis",
    );
    assert.strictEqual(
      classifyProjectFile({
        name: "boundary.zip",
        type: "application/x-zip-compressed",
      }),
      "gis",
    );
  });

  it("classifies standalone GIS files by extension", () => {
    for (const name of [
      "roads.geojson",
      "sites.KML",
      "sites.kmz",
      "parcels.gpkg",
    ]) {
      assert.strictEqual(classifyProjectFile({ name, type: "" }), "gis", name);
    }
  });

  it("falls back to the MIME type for extensionless names", () => {
    assert.strictEqual(
      classifyProjectFile({ name: "download", type: "application/pdf" }),
      "document",
    );
    assert.strictEqual(
      classifyProjectFile({ name: "archive", type: "application/zip" }),
      "gis",
    );
  });

  it("rejects everything else", () => {
    assert.strictEqual(
      classifyProjectFile({ name: "photo.png", type: "image/png" }),
      "unsupported",
    );
    assert.strictEqual(
      classifyProjectFile({ name: "layer.json", type: "application/json" }),
      "unsupported",
    );
    assert.strictEqual(
      classifyProjectFile({ name: ".zip", type: "" }),
      "unsupported",
    );
  });
});

describe("resolveProjectFileContentType", () => {
  it("keeps an allowed browser type", () => {
    assert.strictEqual(
      resolveProjectFileContentType({
        name: "boundary.zip",
        type: "application/x-zip-compressed",
      }),
      "application/x-zip-compressed",
    );
  });

  it("derives the type from the extension when the browser gives none", () => {
    assert.strictEqual(
      resolveProjectFileContentType({ name: "report.docx", type: "" }),
      DOCX,
    );
    assert.strictEqual(
      resolveProjectFileContentType({
        name: "layers.zip",
        type: "application/octet-stream",
      }),
      "application/zip",
    );
  });

  it("returns null for unsupported files", () => {
    assert.strictEqual(
      resolveProjectFileContentType({ name: "photo.png", type: "image/png" }),
      null,
    );
  });

  it("uploads KML as text/plain, never as its +xml type", () => {
    const kmlType = "application/vnd.google-earth.kml+xml";
    assert.strictEqual(
      classifyProjectFile({ name: "sites.kml", type: kmlType }),
      "gis",
    );
    assert.strictEqual(
      resolveProjectFileContentType({ name: "sites.kml", type: kmlType }),
      "text/plain",
    );
    assert.strictEqual(
      resolveProjectFileContentType({ name: "download", type: kmlType }),
      "text/plain",
    );
    assert.ok((GIS_MIME_TYPES as readonly string[]).includes(kmlType));
    assert.ok(!GIS_UPLOAD_CONTENT_TYPES.includes(kmlType));
    assert.ok(GIS_UPLOAD_CONTENT_TYPES.includes("text/plain"));
    assert.ok(GIS_UPLOAD_CONTENT_TYPES.every((type) => !type.endsWith("+xml")));
  });

  it("maps GIS extensions to their content types", () => {
    const expected: Record<string, string> = {
      "a.zip": "application/zip",
      "a.kmz": "application/vnd.google-earth.kmz",
      "a.kml": "text/plain",
      "a.geojson": "application/geo+json",
      "a.gpkg": "application/geopackage+sqlite3",
    };
    for (const [name, contentType] of Object.entries(expected)) {
      assert.strictEqual(
        resolveProjectFileContentType({ name, type: "" }),
        contentType,
        name,
      );
      assert.ok(GIS_UPLOAD_CONTENT_TYPES.includes(contentType), name);
    }
  });

  it("only resolves to types the upload allow list accepts", () => {
    const names = ["a.pdf", "b.doc", "c.docx", "d.zip"];
    for (const name of names) {
      const contentType = resolveProjectFileContentType({ name, type: "" });
      assert.ok(contentType, name);
      assert.ok(isAllowedUploadContentType(contentType), name);
    }
  });
});

describe("project file limits and accept strings", () => {
  it("uses per-kind size limits", () => {
    assert.strictEqual(
      getProjectFileMaxSize("document"),
      PROJECT_DOCUMENT_MAX_FILE_SIZE,
    );
    assert.strictEqual(getProjectFileMaxSize("gis"), GIS_MAX_FILE_SIZE);
    assert.strictEqual(getProjectFileMaxSize("unsupported"), null);
  });

  it("lists every document type and extension in the accept strings", () => {
    for (const [mimeType, extensions] of Object.entries(
      PROJECT_DOCUMENT_MIME_TYPES,
    )) {
      assert.ok(PROJECT_DOCUMENT_ACCEPT.includes(mimeType));
      for (const extension of extensions) {
        assert.ok(PROJECT_DOCUMENT_ACCEPT.includes(extension));
      }
    }
    for (const extension of GIS_FILE_EXTENSIONS) {
      assert.ok(PROJECT_FILE_ACCEPT.includes(extension), extension);
    }
    assert.ok(!PROJECT_FILE_ACCEPT.split(",").includes(".json"));
    assert.ok(PROJECT_FILE_ACCEPT.includes(PROJECT_DOCUMENT_ACCEPT));
  });
});

describe("withResolvedContentType", () => {
  it("re-wraps a file the browser could not type", () => {
    const original = new File(["%PDF"], "report.docx", {
      type: "",
      lastModified: 1234,
    });
    const resolved = withResolvedContentType(original);
    assert.notStrictEqual(resolved, original);
    assert.strictEqual(resolved.type, DOCX);
    assert.strictEqual(resolved.name, "report.docx");
    assert.strictEqual(resolved.size, original.size);
    assert.strictEqual(resolved.lastModified, 1234);
  });

  it("re-wraps KML with its upload type", () => {
    const original = new File(["<kml/>"], "sites.kml", {
      type: "application/vnd.google-earth.kml+xml",
    });
    assert.strictEqual(withResolvedContentType(original).type, "text/plain");
  });

  it("returns already typed and unsupported files unchanged", () => {
    const pdf = new File(["%PDF"], "plan.pdf", { type: "application/pdf" });
    const image = new File(["png"], "photo.png", { type: "image/png" });
    assert.strictEqual(withResolvedContentType(pdf), pdf);
    assert.strictEqual(withResolvedContentType(image), image);
  });
});

describe("isShapefilePart", () => {
  it("recognises loose shapefile parts, in any case", () => {
    for (const name of [
      "roads.shp",
      "roads.DBF",
      "roads.shx",
      "roads.prj",
      "roads.cpg",
      "roads.sbn",
      "roads.sbx",
    ]) {
      assert.strictEqual(isShapefilePart({ name }), true, name);
    }
  });

  it("does not flag zipped shapefiles or other files", () => {
    for (const name of ["roads.zip", "plan.pdf", "shp", "notes.txt"]) {
      assert.strictEqual(isShapefilePart({ name }), false, name);
    }
  });

  it("leaves shapefile parts unsupported", () => {
    assert.strictEqual(
      classifyProjectFile({ name: "roads.shp", type: "" }),
      "unsupported",
    );
  });
});
