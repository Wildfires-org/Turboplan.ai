/**
 * Deterministic generators for the demo project's fixture files: GeoJSON
 * layers, a zipped multi-layer shapefile, and small PDF/DOCX documents.
 *
 * Everything is generated locally with no downloads. The PDF, shapefile and
 * zip writers are intentionally minimal (ASCII text PDFs, 2D shapes, STORE zip)
 * — just enough to produce valid files for demos and manual upload tests.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { crc32 } from "node:zlib";

import { DEMO_DOCUMENTS, type DemoDocument } from "./content";

type Position = [number, number];
type Geometry =
  | { type: "Point"; coordinates: Position }
  | { type: "LineString"; coordinates: Position[] }
  | { type: "Polygon"; coordinates: Position[][] };
type Properties = Record<string, string | number>;
type Feature = { type: "Feature"; geometry: Geometry; properties: Properties };
export type FeatureCollection = {
  type: "FeatureCollection";
  features: Feature[];
};

export type DemoLayers = {
  boundary: FeatureCollection;
  units: FeatureCollection;
  roads: FeatureCollection;
  surveyPoints: FeatureCollection;
};

// ---------------------------------------------------------------------------
// Geometry (planar km offsets around Jackson Creek, projected to WGS84)
// ---------------------------------------------------------------------------

const CENTER = { lon: -116.6, lat: 32.9 };
const KM_PER_DEG_LAT = 110.92;
const KM_PER_DEG_LON = 111.32 * Math.cos((CENTER.lat * Math.PI) / 180);
const ACRES_PER_KM2 = 247.105;
const TARGET_BOUNDARY_ACRES = 1250;

// Counter-clockwise rings (RFC 7946 exterior ring orientation), unscaled.
const BOUNDARY_SHAPE: Position[] = [
  [-1.35, -0.95],
  [-0.2, -1.1],
  [0.9, -0.85],
  [1.4, -0.2],
  [1.25, 0.6],
  [0.6, 1.05],
  [-0.3, 1.0],
  [-1.1, 0.7],
  [-1.45, 0.0],
];

const UNIT_SHAPES: Array<{ props: Properties; ring: Position[] }> = [
  {
    props: {
      UNIT_ID: "JC-01",
      TREATMENT: "Mastication",
      VEG_TYPE: "Chamise chaparral",
      SEASON: "Sep-Feb",
    },
    ring: [
      [-1.15, -0.75],
      [-0.3, -0.85],
      [-0.2, -0.05],
      [-1.1, 0.05],
    ],
  },
  {
    props: {
      UNIT_ID: "JC-02",
      TREATMENT: "Mastication",
      VEG_TYPE: "Chamise chaparral",
      SEASON: "Sep-Feb",
    },
    ring: [
      [0.05, -0.75],
      [0.9, -0.62],
      [1.15, -0.1],
      [0.15, 0.0],
    ],
  },
  {
    props: {
      UNIT_ID: "JC-03",
      TREATMENT: "Hand thin and pile",
      VEG_TYPE: "Coast live oak woodland",
      SEASON: "Year-round",
    },
    ring: [
      [-0.95, 0.2],
      [-0.2, 0.15],
      [-0.25, 0.75],
      [-0.85, 0.55],
    ],
  },
  {
    props: {
      UNIT_ID: "JC-04",
      TREATMENT: "Invasive removal",
      VEG_TYPE: "Sycamore-willow riparian",
      SEASON: "Aug-Oct",
    },
    ring: [
      [0.25, 0.2],
      [1.0, 0.15],
      [0.95, 0.55],
      [0.45, 0.85],
    ],
  },
];

const ROAD_SHAPES: Array<{ props: Properties; line: Position[] }> = [
  {
    props: {
      ROAD_ID: "15S04",
      NAME: "Jackson Creek Road",
      MAINT_LVL: 2,
      SURFACE: "Native",
    },
    line: [
      [-1.75, -0.6],
      [-1.0, -0.42],
      [-0.1, -0.35],
      [0.6, -0.25],
      [1.2, 0.05],
      [1.65, 0.3],
    ],
  },
  {
    props: {
      ROAD_ID: "15S04A",
      NAME: "Jackson Creek Spur",
      MAINT_LVL: 1,
      SURFACE: "Native",
    },
    line: [
      [-0.1, -0.35],
      [-0.35, 0.35],
      [-0.5, 0.85],
    ],
  },
];

const SURVEY_POINTS: Array<{ props: Properties; at: Position }> = [
  {
    props: {
      SITE_ID: "SP-01",
      SURVEY: "Botany",
      TARGET: "Cuyamaca larkspur",
      RESULT: "Occurrence found",
      SURVEY_DT: "2026-08-26",
    },
    at: [-0.7, -0.45],
  },
  {
    props: {
      SITE_ID: "SP-02",
      SURVEY: "Wildlife",
      TARGET: "California spotted owl",
      RESULT: "No detection (visit 2 of 6)",
      SURVEY_DT: "2026-09-03",
    },
    at: [0.6, -0.3],
  },
  {
    props: {
      SITE_ID: "SP-03",
      SURVEY: "Wildlife",
      TARGET: "Arroyo toad habitat",
      RESULT: "Marginal habitat",
      SURVEY_DT: "2026-09-10",
    },
    at: [0.7, 0.5],
  },
  {
    props: {
      SITE_ID: "SP-04",
      SURVEY: "Heritage",
      TARGET: "Transect start",
      RESULT: "Survey in progress",
      SURVEY_DT: "2026-09-15",
    },
    at: [-0.5, 0.45],
  },
  {
    props: {
      SITE_ID: "SP-05",
      SURVEY: "Fuels",
      TARGET: "Photo point",
      RESULT: "Baseline photos taken",
      SURVEY_DT: "2026-09-17",
    },
    at: [0.2, 0.8],
  },
];

const ringAreaKm2 = (ring: Position[]): number => {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
};

const round = (value: number, digits: number) =>
  Math.round(value * 10 ** digits) / 10 ** digits;

const lineLengthKm = (line: Position[]): number => {
  let total = 0;
  for (let i = 1; i < line.length; i++) {
    total += Math.hypot(
      line[i][0] - line[i - 1][0],
      line[i][1] - line[i - 1][1],
    );
  }
  return total;
};

export const buildDemoLayers = (): DemoLayers => {
  const scale = Math.sqrt(
    TARGET_BOUNDARY_ACRES / ACRES_PER_KM2 / ringAreaKm2(BOUNDARY_SHAPE),
  );
  const scalePos = ([x, y]: Position): Position => [x * scale, y * scale];
  const toLonLat = ([x, y]: Position): Position => [
    round(CENTER.lon + x / KM_PER_DEG_LON, 6),
    round(CENTER.lat + y / KM_PER_DEG_LAT, 6),
  ];
  const polygon = (ring: Position[]): Geometry => {
    const lonLat = ring.map((p) => toLonLat(scalePos(p)));
    return { type: "Polygon", coordinates: [[...lonLat, lonLat[0]]] };
  };
  const acres = (ring: Position[]) =>
    round(ringAreaKm2(ring.map(scalePos)) * ACRES_PER_KM2, 1);

  return {
    boundary: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: polygon(BOUNDARY_SHAPE),
          properties: {
            NAME: "Jackson Creek Vegetation Restoration",
            FOREST: "Cleveland National Forest",
            DISTRICT: "Descanso Ranger District",
            NEPA: "CE 36 CFR 220.6(e)(6)",
            GIS_ACRES: acres(BOUNDARY_SHAPE),
          },
        },
      ],
    },
    units: {
      type: "FeatureCollection",
      features: UNIT_SHAPES.map(({ props, ring }) => ({
        type: "Feature" as const,
        geometry: polygon(ring),
        properties: { ...props, GIS_ACRES: acres(ring) },
      })),
    },
    roads: {
      type: "FeatureCollection",
      features: ROAD_SHAPES.map(({ props, line }) => ({
        type: "Feature" as const,
        geometry: {
          type: "LineString" as const,
          coordinates: line.map((p) => toLonLat(scalePos(p))),
        },
        properties: {
          ...props,
          MILES: round(lineLengthKm(line.map(scalePos)) * 0.621371, 2),
        },
      })),
    },
    surveyPoints: {
      type: "FeatureCollection",
      features: SURVEY_POINTS.map(({ props, at }) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: toLonLat(scalePos(at)),
        },
        properties: props,
      })),
    },
  };
};

// ---------------------------------------------------------------------------
// Shapefile writer (Point / PolyLine / Polygon, WGS84)
// ---------------------------------------------------------------------------

const WGS84_PRJ =
  'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';

const SHAPE_TYPE = { Point: 1, LineString: 3, Polygon: 5 } as const;

const shapeParts = (geometry: Geometry): Position[][] => {
  if (geometry.type === "Point") {
    return [[geometry.coordinates]];
  }
  if (geometry.type === "LineString") {
    return [geometry.coordinates];
  }
  // Shapefile exterior rings are clockwise — the reverse of GeoJSON.
  return geometry.coordinates.map((ring) => [...ring].reverse());
};

const bbox = (points: Position[]) => {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};

const writeShpHeader = (
  buf: Buffer,
  fileLengthBytes: number,
  shapeType: number,
  box: number[],
) => {
  buf.writeInt32BE(9994, 0);
  buf.writeInt32BE(fileLengthBytes / 2, 24);
  buf.writeInt32LE(1000, 28);
  buf.writeInt32LE(shapeType, 32);
  box.forEach((value, i) => buf.writeDoubleLE(value, 36 + i * 8));
};

const buildShpAndShx = (fc: FeatureCollection) => {
  const geometryType = fc.features[0].geometry.type;
  const shapeType = SHAPE_TYPE[geometryType];
  const records: Buffer[] = [];

  for (const feature of fc.features) {
    const parts = shapeParts(feature.geometry);
    const points = parts.flat();
    let content: Buffer;

    if (shapeType === SHAPE_TYPE.Point) {
      content = Buffer.alloc(20);
      content.writeInt32LE(shapeType, 0);
      content.writeDoubleLE(points[0][0], 4);
      content.writeDoubleLE(points[0][1], 12);
    } else {
      content = Buffer.alloc(44 + 4 * parts.length + 16 * points.length);
      content.writeInt32LE(shapeType, 0);
      bbox(points).forEach((value, i) =>
        content.writeDoubleLE(value, 4 + i * 8),
      );
      content.writeInt32LE(parts.length, 36);
      content.writeInt32LE(points.length, 40);
      let offset = 44;
      let pointIndex = 0;
      for (const part of parts) {
        content.writeInt32LE(pointIndex, offset);
        offset += 4;
        pointIndex += part.length;
      }
      for (const [x, y] of points) {
        content.writeDoubleLE(x, offset);
        content.writeDoubleLE(y, offset + 8);
        offset += 16;
      }
    }
    records.push(content);
  }

  const box = bbox(fc.features.flatMap((f) => shapeParts(f.geometry).flat()));
  const shpLength = 100 + records.reduce((sum, r) => sum + 8 + r.length, 0);
  const shp = Buffer.alloc(shpLength);
  const shx = Buffer.alloc(100 + 8 * records.length);
  writeShpHeader(shp, shpLength, shapeType, [...box, 0, 0, 0, 0]);
  writeShpHeader(shx, shx.length, shapeType, [...box, 0, 0, 0, 0]);

  let offset = 100;
  records.forEach((content, i) => {
    shx.writeInt32BE(offset / 2, 100 + i * 8);
    shx.writeInt32BE(content.length / 2, 104 + i * 8);
    shp.writeInt32BE(i + 1, offset);
    shp.writeInt32BE(content.length / 2, offset + 4);
    content.copy(shp, offset + 8);
    offset += 8 + content.length;
  });

  return { shp, shx };
};

const buildDbf = (fc: FeatureCollection): Buffer => {
  const keys = Object.keys(fc.features[0].properties);
  const fields = keys.map((key) => {
    const isNumber = fc.features.every(
      (f) => typeof f.properties[key] === "number",
    );
    const maxLength = Math.max(
      ...fc.features.map((f) => String(f.properties[key] ?? "").length),
    );
    return {
      key,
      type: isNumber ? "N" : "C",
      length: isNumber ? 12 : Math.min(254, Math.max(10, maxLength)),
      decimals: isNumber ? 2 : 0,
    };
  });

  const headerLength = 32 + 32 * fields.length + 1;
  const recordLength = 1 + fields.reduce((sum, f) => sum + f.length, 0);
  const buf = Buffer.alloc(
    headerLength + recordLength * fc.features.length + 1,
  );

  buf.writeUInt8(0x03, 0);
  buf.writeUInt8(126, 1); // 2026 - 1900
  buf.writeUInt8(9, 2);
  buf.writeUInt8(24, 3);
  buf.writeUInt32LE(fc.features.length, 4);
  buf.writeUInt16LE(headerLength, 8);
  buf.writeUInt16LE(recordLength, 10);

  fields.forEach((field, i) => {
    const base = 32 + i * 32;
    buf.write(field.key.slice(0, 10), base, "latin1");
    buf.write(field.type, base + 11, "latin1");
    buf.writeUInt8(field.length, base + 16);
    buf.writeUInt8(field.decimals, base + 17);
  });
  buf.writeUInt8(0x0d, headerLength - 1);

  let offset = headerLength;
  for (const feature of fc.features) {
    buf.write(" ", offset, "latin1");
    offset += 1;
    for (const field of fields) {
      const raw = feature.properties[field.key];
      const text =
        field.type === "N"
          ? Number(raw).toFixed(field.decimals).padStart(field.length, " ")
          : String(raw ?? "")
              .replace(/[^\x20-\x7e]/g, "-")
              .slice(0, field.length)
              .padEnd(field.length, " ");
      buf.write(text, offset, "latin1");
      offset += field.length;
    }
  }
  buf.writeUInt8(0x1a, offset);
  return buf;
};

const buildShapefile = (name: string, fc: FeatureCollection) => {
  const { shp, shx } = buildShpAndShx(fc);
  return [
    { name: `${name}.shp`, data: shp },
    { name: `${name}.shx`, data: shx },
    { name: `${name}.dbf`, data: buildDbf(fc) },
    { name: `${name}.prj`, data: Buffer.from(WGS84_PRJ) },
    { name: `${name}.cpg`, data: Buffer.from("UTF-8") },
  ];
};

// ---------------------------------------------------------------------------
// Zip writer (STORE, fixed timestamp for deterministic output)
// ---------------------------------------------------------------------------

const DOS_TIME = 12 << 11;
const DOS_DATE = ((2026 - 1980) << 9) | (9 << 5) | 24;

const buildZip = (entries: Array<{ name: string; data: Buffer }>): Buffer => {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);

    locals.push(local, nameBuf, data);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }

  const centralDir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDir.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, centralDir, end]);
};

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

const toAscii = (text: string) =>
  text
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7e]/g, "");

const wrap = (text: string, width: number): string[] => {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && line.length + word.length + 1 > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) {
    lines.push(line);
  }
  return lines;
};

const escapePdf = (text: string) => text.replace(/([\\()])/g, "\\$1");

/** Minimal text-only PDF (Helvetica, US Letter, auto-paginated). */
export const buildPdf = (doc: DemoDocument): Buffer => {
  const LINES_PER_PAGE = 40;
  const bodyLines = doc.paragraphs.flatMap((p) => [
    ...wrap(toAscii(p), 88),
    "",
  ]);
  const pages: string[][] = [];
  for (let i = 0; i < bodyLines.length; i += LINES_PER_PAGE) {
    pages.push(bodyLines.slice(i, i + LINES_PER_PAGE));
  }

  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 5 + i * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  pages.forEach((lines, i) => {
    const title =
      i === 0
        ? `BT /F2 15 Tf 72 730 Td (${escapePdf(toAscii(doc.title))}) Tj ET\n`
        : "";
    const body = lines.map((l) => `(${escapePdf(l)}) Tj T*`).join("\n");
    const stream = `${title}BT /F1 10.5 Tf 15 TL 72 ${i === 0 ? 700 : 730} Td\n${body}\nET`;
    objects[pageIds[i]] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageIds[i] + 1} 0 R >>`;
    objects[pageIds[i] + 1] =
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(pdf);
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
};

/** DOCX via the `docx` package already used by the web app. */
export const buildDocx = async (
  doc: DemoDocument,
  repoRoot: string,
): Promise<Buffer> => {
  const require = createRequire(
    path.join(repoRoot, "apps/turboplan/package.json"),
  );
  const docx = await import(pathToFileURL(require.resolve("docx")).href);
  const { Document, HeadingLevel, Packer, Paragraph } = docx;
  const document = new Document({
    creator: "TurboPlan demo seed",
    title: doc.title,
    sections: [
      {
        children: [
          new Paragraph({ text: doc.title, heading: HeadingLevel.HEADING_1 }),
          ...doc.paragraphs.map(
            (text: string) => new Paragraph({ text, spacing: { after: 160 } }),
          ),
        ],
      },
    ],
  });
  return Packer.toBuffer(document);
};

export const mimeTypeFor = (filename: string) =>
  filename.endsWith(".pdf")
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// ---------------------------------------------------------------------------
// Fixture output
// ---------------------------------------------------------------------------

export const LAYER_FILES = {
  boundary: "jackson-creek-project-boundary.geojson",
  units: "jackson-creek-treatment-units.geojson",
  roads: "jackson-creek-roads.geojson",
  surveyPoints: "jackson-creek-survey-points.geojson",
} as const;

export const SHAPEFILE_ZIP = "jackson-creek-shapefiles.zip";

export type DemoFixtures = {
  dir: string;
  layers: DemoLayers;
  documents: Array<{ filename: string; mimeType: string; data: Buffer }>;
};

/** Generate every fixture file into `e2e/fixtures/demo-project/` (overwrites). */
export const writeDemoFixtures = async (
  repoRoot: string,
): Promise<DemoFixtures> => {
  const dir = path.join(repoRoot, "e2e/fixtures/demo-project");
  mkdirSync(dir, { recursive: true });

  const layers = buildDemoLayers();
  for (const [key, filename] of Object.entries(LAYER_FILES)) {
    writeFileSync(
      path.join(dir, filename),
      `${JSON.stringify(layers[key as keyof DemoLayers], null, 2)}\n`,
    );
  }

  const zipEntries = [
    ...buildShapefile("jackson_creek/project_boundary", layers.boundary),
    ...buildShapefile("jackson_creek/treatment_units", layers.units),
    ...buildShapefile("jackson_creek/roads", layers.roads),
    ...buildShapefile("jackson_creek/survey_points", layers.surveyPoints),
  ];
  writeFileSync(path.join(dir, SHAPEFILE_ZIP), buildZip(zipEntries));

  const documents: DemoFixtures["documents"] = [];
  for (const doc of DEMO_DOCUMENTS) {
    const data = doc.filename.endsWith(".pdf")
      ? buildPdf(doc)
      : await buildDocx(doc, repoRoot);
    writeFileSync(path.join(dir, doc.filename), data);
    documents.push({
      filename: doc.filename,
      mimeType: mimeTypeFor(doc.filename),
      data,
    });
  }

  return { dir, layers, documents };
};
