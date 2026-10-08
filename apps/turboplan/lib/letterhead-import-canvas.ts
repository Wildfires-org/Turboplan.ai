// Browser-only rendering for "Import from document": draws page 1 of a PDF (or
// an image) to a canvas and crops regions of it. pdfjs is loaded on demand so
// it stays out of the settings dialog bundle.

import {
  bytesToBase64,
  type ExtractImageMimeType,
  expandRect,
  findInkBounds,
  fitWithin,
  getRenderScale,
  IMPORT_RENDER_WIDTH,
  MAX_EXTRACT_BYTES,
  type PixelRect,
} from "./letterhead-import";

const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};

const get2dContext = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is not supported in this browser");
  }
  return context;
};

const loadPdfjs = async () => {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  return pdfjs;
};

const renderPdfFirstPage = async (file: File): Promise<HTMLCanvasElement> => {
  const pdfjs = await loadPdfjs();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() })
    .promise;
  try {
    const page = await pdf.getPage(1);
    const scale = getRenderScale(page.getViewport({ scale: 1 }).width);
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = get2dContext(canvas);
    // PDFs have no page color; white keeps the crop readable for the API.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport }).promise;
    return canvas;
  } finally {
    void pdf.destroy();
  }
};

const renderImage = async (file: File): Promise<HTMLCanvasElement> => {
  const bitmap = await createImageBitmap(file);
  try {
    // Downscale big scans to the PDF render width; never upscale.
    const scale = Math.min(1, IMPORT_RENDER_WIDTH / bitmap.width);
    const canvas = createCanvas(bitmap.width * scale, bitmap.height * scale);
    const context = get2dContext(canvas);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    bitmap.close();
  }
};

// Page 1 of a PDF, or the image itself, drawn to a canvas.
export const renderFirstPage = (file: File): Promise<HTMLCanvasElement> =>
  file.type === "application/pdf"
    ? renderPdfFirstPage(file)
    : renderImage(file);

export const cropCanvas = (
  source: HTMLCanvasElement,
  rect: PixelRect,
): HTMLCanvasElement => {
  const canvas = createCanvas(rect.width, rect.height);
  get2dContext(canvas).drawImage(
    source,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    rect.width,
    rect.height,
  );
  return canvas;
};

// Crops away the paper around a crop's content, keeping `margin` px of it.
export const trimPaper = (
  canvas: HTMLCanvasElement,
  margin: number,
): HTMLCanvasElement => {
  const size = { width: canvas.width, height: canvas.height };
  const { data } = get2dContext(canvas).getImageData(
    0,
    0,
    size.width,
    size.height,
  );
  const bounds = findInkBounds(data, size);
  return bounds ? cropCanvas(canvas, expandRect(bounds, margin, size)) : canvas;
};

const scaleCanvas = (source: HTMLCanvasElement, maxEdge?: number) => {
  const size = fitWithin(
    { width: source.width, height: source.height },
    maxEdge,
  );
  if (size.width === source.width && size.height === source.height) {
    return source;
  }
  const canvas = createCanvas(size.width, size.height);
  get2dContext(canvas).drawImage(source, 0, 0, size.width, size.height);
  return canvas;
};

export const canvasToBlob = (
  canvas: HTMLCanvasElement,
  mimeType: ExtractImageMimeType = "image/png",
  quality?: number,
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Couldn't encode the image"));
        }
      },
      mimeType,
      quality,
    );
  });

export const canvasToFile = async (
  canvas: HTMLCanvasElement,
  name: string,
): Promise<File> =>
  new File([await canvasToBlob(canvas)], name, { type: "image/png" });

// The header image as the extract API wants it: scaled to its max edge (the
// returned boxes are normalized, so the full-size canvas is still cropped),
// PNG, or JPEG when the PNG is over the size limit (photographed letters
// compress badly as PNG).
export const encodeForExtract = async (
  header: HTMLCanvasElement,
): Promise<{ image: string; mimeType: ExtractImageMimeType }> => {
  const canvas = scaleCanvas(header);
  let blob = await canvasToBlob(canvas, "image/png");
  let mimeType: ExtractImageMimeType = "image/png";
  if (blob.size > MAX_EXTRACT_BYTES) {
    blob = await canvasToBlob(canvas, "image/jpeg", 0.85);
    mimeType = "image/jpeg";
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { image: bytesToBase64(bytes), mimeType };
};
