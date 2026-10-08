"use client";

import { useRef, useState } from "react";

import { FileUp, Loader2 } from "lucide-react";

import { ApiClient } from "@wildfires-org/turboplan-api-client";
import { useFileUpload } from "@wildfires-org/turboplan-upload/client";
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@wildfires-org/turboplan-utils";
import {
  normalizeLetterheadColor,
  parseLetterheadLines,
} from "@wildfires-org/turboplan-workspace/types";

import { LetterheadBand } from "@/components/letterhead-band";
import { toast } from "@/components/toast";
import {
  getBannerRect,
  getExtractErrorMessage,
  getHeaderRegionRect,
  getPaddedBoxRect,
  hasExtractedText,
  IMPORT_ACCEPT,
  isSupportedImportType,
  isUsableBox,
  LETTERHEAD_EXTRACT_ENDPOINT,
  type LetterheadExtractResult,
  type LetterheadImportValues,
  toTextLetterheadValues,
} from "@/lib/letterhead-import";

interface LetterheadImportProps {
  organizationId: string;
  // Set when importing into an office's letterhead (permission is checked on
  // the office rather than the organization).
  officeId?: string;
  onImport: (values: LetterheadImportValues) => void;
  disabled?: boolean;
}

type Phase = "reading" | "review" | "error";
type ApplyTarget = "text" | "banner";

// The rendered crops, kept as canvases so the chosen one can be uploaded.
type Crops = {
  logo: HTMLCanvasElement | null;
  banner: HTMLCanvasElement;
};

const apiClient = new ApiClient();

// Paper (px at the ~1700px render width) kept around the trimmed logo.
const LOGO_TRIM_MARGIN = 6;
const UPLOAD_ERROR_MESSAGE = "Couldn't upload the image";
const OPEN_ERROR_MESSAGE =
  "We couldn't open that file. Try another PDF, PNG or JPEG.";

// The canvas helpers pull in pdfjs, so load them only when a file is picked.
const loadCanvasHelpers = () => import("@/lib/letterhead-import-canvas");

// "Import from document": reads the header of a letter the organization
// already uses and prefills the letterhead editor from it, as text fields or
// as a banner image. Nothing is saved until the surrounding form is.
export function LetterheadImport({
  organizationId,
  officeId,
  onImport,
  disabled = false,
}: LetterheadImportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("reading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [headerUrl, setHeaderUrl] = useState<string | null>(null);
  const [result, setResult] = useState<LetterheadExtractResult | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null);
  const [applying, setApplying] = useState<ApplyTarget | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropsRef = useRef<Crops | null>(null);
  // Bumped per file (and on close) so a slow read can't land in a newer one.
  const requestIdRef = useRef(0);

  const { upload } = useFileUpload({
    maxSize: 10 * 1024 * 1024,
    allowedTypes: ["image/png"],
  });

  const resetReview = () => {
    setErrorMessage(null);
    setHeaderUrl(null);
    setResult(null);
    setLogoPreviewUrl(null);
    setBannerPreviewUrl(null);
    cropsRef.current = null;
  };

  const handleOpenChange = (open: boolean) => {
    if (applying) {
      return;
    }
    if (!open) {
      requestIdRef.current += 1;
    }
    setIsOpen(open);
  };

  const handleChooseFile = () => {
    fileInputRef.current?.click();
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setPhase("error");
  };

  const readHeader = async (file: File) => {
    const requestId = ++requestIdRef.current;
    const isStale = () => requestId !== requestIdRef.current;

    resetReview();
    setPhase("reading");
    setIsOpen(true);

    let header: HTMLCanvasElement;
    let helpers: Awaited<ReturnType<typeof loadCanvasHelpers>>;
    let payload: Awaited<ReturnType<typeof helpers.encodeForExtract>>;
    try {
      helpers = await loadCanvasHelpers();
      const page = await helpers.renderFirstPage(file);
      header = helpers.cropCanvas(
        page,
        getHeaderRegionRect({ width: page.width, height: page.height }),
      );
      payload = await helpers.encodeForExtract(header);
    } catch (error) {
      console.error("Letterhead import: couldn't render the file", error);
      if (!isStale()) {
        showError(OPEN_ERROR_MESSAGE);
      }
      return;
    }
    if (isStale()) {
      return;
    }
    setHeaderUrl(header.toDataURL("image/png"));

    const { data, status } = await apiClient.post<LetterheadExtractResult>(
      LETTERHEAD_EXTRACT_ENDPOINT,
      { organizationId, officeId, ...payload },
    );
    if (isStale()) {
      return;
    }
    if (!data) {
      showError(getExtractErrorMessage(status));
      return;
    }

    const size = { width: header.width, height: header.height };
    // The box is loose around the mark: pad it, then trim the paper back off.
    const logo = isUsableBox(data.logoBox)
      ? helpers.trimPaper(
          helpers.cropCanvas(header, getPaddedBoxRect(data.logoBox, size)),
          LOGO_TRIM_MARGIN,
        )
      : null;
    const banner = helpers.cropCanvas(
      header,
      getBannerRect(data.headerBottom, size),
    );
    cropsRef.current = { logo, banner };
    setLogoPreviewUrl(logo?.toDataURL("image/png") ?? null);
    setBannerPreviewUrl(banner.toDataURL("image/png"));
    setResult(data);
    setPhase("review");
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    if (!isSupportedImportType(file.type)) {
      toast({ type: "error", description: "Choose a PDF, PNG or JPEG file." });
      return;
    }
    void readHeader(file);
  };

  // Uploads a crop with the same mechanism as the logo field; null on failure.
  const uploadCrop = async (canvas: HTMLCanvasElement, name: string) => {
    try {
      const { canvasToFile } = await loadCanvasHelpers();
      const uploaded = await upload(await canvasToFile(canvas, name));
      return uploaded.url;
    } catch (error) {
      console.error("Letterhead import: upload failed", error);
      return null;
    }
  };

  const finish = (values: LetterheadImportValues) => {
    onImport(values);
    setApplying(null);
    setIsOpen(false);
    toast({
      type: "success",
      description: "Letterhead imported. Check it, then save to keep it.",
    });
  };

  const handleUseText = async () => {
    const crops = cropsRef.current;
    if (!result || !crops) {
      return;
    }
    setApplying("text");
    let logoUrl: string | undefined;
    if (crops.logo) {
      logoUrl =
        (await uploadCrop(crops.logo, "letterhead-logo.png")) ?? undefined;
      if (!logoUrl) {
        // The text is still useful on its own; keep the current logo.
        toast({
          type: "error",
          description: `${UPLOAD_ERROR_MESSAGE}. The text was imported without the logo.`,
        });
      }
    }
    finish({ ...toTextLetterheadValues(result), logoUrl });
  };

  const handleUseBanner = async () => {
    const crops = cropsRef.current;
    if (!result || !crops) {
      return;
    }
    setApplying("banner");
    const logoUrl = await uploadCrop(crops.banner, "letterhead-banner.png");
    if (!logoUrl) {
      // A banner without its image is nothing; let them pick text instead.
      toast({ type: "error", description: `${UPLOAD_ERROR_MESSAGE}.` });
      setApplying(null);
      return;
    }
    finish({
      layout: "banner",
      color: normalizeLetterheadColor(result.color) ?? "",
      logoUrl,
    });
  };

  const textValues = result ? toTextLetterheadValues(result) : null;
  const canUseText = !!result && hasExtractedText(result);
  const hasMarginLogo = result?.layout === "columns" && !!logoPreviewUrl;
  const isApplying = applying !== null;

  return (
    <div className="flex flex-col gap-1.5">
      <div>
        <Button
          type="button"
          variant="glass"
          size="sm"
          onClick={handleChooseFile}
          disabled={disabled}
        >
          <FileUp aria-hidden className="mr-1.5 size-4" />
          Import from document
        </Button>
      </div>
      <p className="text-xs text-gray-550">
        Upload a letter you already use — we&apos;ll read its header.
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept={IMPORT_ACCEPT}
        onChange={handleFileSelect}
        disabled={disabled}
        className="hidden"
      />

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[90vh] w-[calc(100%-24px)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 py-4 pr-12 text-left">
            <DialogTitle>Import letterhead</DialogTitle>
            <DialogDescription>
              We read the header on the first page. Pick how to use it — you can
              still edit it before saving.
            </DialogDescription>
          </DialogHeader>

          <div className="min-w-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
            <section className="space-y-2">
              <h3 className="text-sm font-medium">From your document</h3>
              <div className="relative min-h-20 overflow-hidden rounded-xl bg-white ring-1 ring-black/5">
                {headerUrl && (
                  // A local data URL of the rendered page; next/image adds
                  // nothing here.
                  <img
                    src={headerUrl}
                    alt="Header of the uploaded document"
                    className="block h-auto w-full"
                  />
                )}
                {phase === "reading" && (
                  <div
                    role="status"
                    className="absolute inset-0 flex items-center justify-center gap-2 bg-white/75 text-sm font-medium text-zinc-700 backdrop-blur-[1px]"
                  >
                    <Loader2 aria-hidden className="size-4 animate-spin" />
                    Reading the header…
                  </div>
                )}
              </div>
            </section>

            {phase === "error" && errorMessage && (
              <p
                role="alert"
                className="rounded-xl bg-error-50 px-3 py-2 text-sm text-error-700 ring-1 ring-inset ring-error-200 dark:bg-red-950/40 dark:text-error-300 dark:ring-error-900"
              >
                {errorMessage}
              </p>
            )}

            {phase === "review" && result && textValues && (
              <>
                <section className="space-y-2">
                  <h3 className="text-sm font-medium">As a text letterhead</h3>
                  <div
                    className={cn(
                      "overflow-hidden rounded-xl bg-white p-4 text-zinc-900 shadow-sm ring-1 ring-black/5 dark:bg-zinc-900 dark:text-zinc-100",
                      hasMarginLogo && "md:pl-16",
                    )}
                  >
                    {canUseText ? (
                      <LetterheadBand
                        letterhead={{
                          layout: result.layout,
                          nameLines: parseLetterheadLines(textValues.lines),
                          contactLines: parseLetterheadLines(
                            textValues.contact,
                          ),
                          color: textValues.color || null,
                        }}
                        logoSrc={logoPreviewUrl}
                        className="mb-0"
                      />
                    ) : (
                      <p className="py-3 text-center text-xs text-gray-550">
                        We couldn&apos;t read any text in this header. Use it as
                        a banner image instead.
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-gray-550">
                    Editable lines, layout and color
                    {logoPreviewUrl
                      ? ", with the logo cut from the header"
                      : ""}
                    .
                  </p>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-medium">As a banner image</h3>
                  <div className="overflow-hidden rounded-xl bg-white p-2 ring-1 ring-black/5">
                    {bannerPreviewUrl && (
                      <img
                        src={bannerPreviewUrl}
                        alt="Header cropped as a banner"
                        className="block h-auto max-h-40 w-full object-contain"
                      />
                    )}
                  </div>
                  <p className="text-xs text-gray-550">
                    The header exactly as printed, as one image.
                  </p>
                </section>
              </>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-4 sm:px-6">
            {phase === "error" ? (
              <>
                <Button
                  type="button"
                  variant="glass"
                  onClick={() => handleOpenChange(false)}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  variant="brand"
                  onClick={handleChooseFile}
                >
                  Choose another file
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="glass"
                  className="flex-1 sm:flex-none"
                  onClick={handleUseBanner}
                  disabled={phase !== "review" || isApplying}
                >
                  {applying === "banner" ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    "Use as banner image"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="brand"
                  className="flex-1 sm:flex-none"
                  onClick={handleUseText}
                  disabled={!canUseText || isApplying}
                >
                  {applying === "text" ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    "Use as text letterhead"
                  )}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
