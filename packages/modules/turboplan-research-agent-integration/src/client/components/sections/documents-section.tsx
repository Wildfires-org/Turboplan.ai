"use client";

import { useCallback, useRef, useState } from "react";

import {
  Asterisk,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

import { ApiClient } from "@wildfires-org/turboplan-api-client";
import { DocumentPreviewDialog } from "@wildfires-org/turboplan-documents/client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Checkbox,
} from "@wildfires-org/turboplan-utils";

import {
  isBoxDownloadUrl,
  isPreviewableDocumentUrl,
} from "../../../document-preview-utils";
import type { DocumentItem } from "../../../types";
import { useSectionSaveRegistration } from "../../contexts/save-to-project-context";
import { useDocumentFolderSelection } from "../../hooks/use-document-folder-selection";
import { useSaveToProject } from "../../hooks/use-save-to-project";
import {
  ResearchSectionBody,
  ResearchSectionHeader,
  ResearchSectionRoot,
  SelectAllControl,
} from "../ui/research-section";
import {
  SectionItemCard,
  sectionItemSurfaceVariants,
} from "../ui/section-item";
import { SectionPill } from "../ui/section-pill";

const FOLDER_DOCS_LIMIT = 5;

const getHostname = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const getFileExtension = (doc: DocumentItem) => {
  if (!doc.url) {
    return null;
  }
  if (isBoxDownloadUrl(doc.url)) {
    return "PDF";
  }
  const path = doc.url.toLowerCase().split("?")[0];
  const ext = path.split(".").pop();
  if (ext === "pdf") {
    return "PDF";
  }
  if (ext === "doc") {
    return "DOC";
  }
  if (ext === "docx") {
    return "DOCX";
  }
  return null;
};

const isSaveableDocument = (doc: DocumentItem): boolean => {
  return !!doc.url;
};

const buildHeaderCount = (
  hasFolders: boolean,
  foldersCount: number,
  singlesCount: number,
  totalCount: number,
) => {
  if (!hasFolders) {
    return `${totalCount}`;
  }
  if (singlesCount > 0) {
    return `${foldersCount} project${foldersCount !== 1 ? "s" : ""}, ${singlesCount} other`;
  }
  return `${foldersCount} project${foldersCount !== 1 ? "s" : ""}`;
};

type DocumentsSectionProps = {
  messageId: string;
  projectId?: string;
  documents: DocumentItem[];
  onSaved?: () => void;
};

type DocumentRowProps = {
  doc: DocumentItem;
  isSelected: boolean;
  onToggle: () => void;
  onPreview: () => void;
  isSaving: boolean;
};

const DocumentRow = ({
  doc,
  isSelected,
  onToggle,
  onPreview,
  isSaving,
}: DocumentRowProps) => {
  const ext = getFileExtension(doc);
  const hostname = doc.url ? getHostname(doc.url) : null;

  return (
    <div className="flex items-start gap-3">
      <div className="pt-0.5 shrink-0">
        {doc.saved ? (
          <CheckCheck className="size-4 text-brand-700" />
        ) : isSaveableDocument(doc) ? (
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggle}
            disabled={isSaving}
            aria-label={`Select document ${doc.title}`}
            variant="dark"
          />
        ) : (
          <div className="size-4" />
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <button
          type="button"
          className="w-full text-left text-xs text-neutral-700 font-semibold leading-4 tracking-[0.12px] line-clamp-2 hover:underline underline-offset-2"
          onClick={onPreview}
        >
          {doc.title}
        </button>
        <div className="flex flex-wrap items-center gap-1.5">
          {ext && (
            <SectionPill icon={<FileText className="size-3" />}>
              {ext}
            </SectionPill>
          )}
          {!doc.saved && !isPreviewableDocumentUrl(doc.url) && (
            <SectionPill
              tone="warning"
              icon={<ExternalLink className="size-3" />}
            >
              Link only - not a downloadable file
            </SectionPill>
          )}
          {hostname && (
            <SectionPill icon={<Asterisk className="size-3" />}>
              {hostname}
            </SectionPill>
          )}
        </div>
      </div>
    </div>
  );
};

export function DocumentsSection({
  messageId,
  projectId,
  documents,
  onSaved,
}: DocumentsSectionProps) {
  const [previewDocIndex, setPreviewDocIndex] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [showAllDocsInFolder, setShowAllDocsInFolder] = useState<Set<string>>(
    new Set(),
  );
  const [accordionValue, setAccordionValue] = useState<string[] | null>(null);
  const previewRequestIdRef = useRef(0);
  const { save, isSaving } = useSaveToProject(
    messageId,
    "documents",
    projectId,
  );

  const {
    folders,
    singles,
    hasFolders,
    getFolderState,
    isDocumentSelected,
    toggleFolder,
    toggleDocument,
    toggleAll,
    selectedCount,
    selectableCount,
    isAllSelected,
    selectedIndices,
    clear,
  } = useDocumentFolderSelection(documents);

  const handleSave = useCallback(async () => {
    if (selectedCount === 0) {
      return null;
    }
    try {
      const itemNames = [...selectedIndices].map((i) => documents[i].title);
      const result = await save({ itemIndices: [...selectedIndices] });
      if (!result) {
        return null;
      }
      if (result.skipped?.length) {
        toast.warning(
          `${result.skipped.length} document(s) skipped — file size exceeds 50MB limit`,
        );
      }
      return { savedCount: result.savedCount, itemNames };
    } catch (error) {
      console.error("[DocumentsSection] Save failed:", error);
      return null;
    }
  }, [save, selectedCount, selectedIndices, documents]);

  useSectionSaveRegistration("documents", selectedCount, handleSave, clear);

  const handlePreviewOpen = (index: number) => {
    const doc = documents[index];
    if (!doc?.url) {
      return;
    }

    if (!isPreviewableDocumentUrl(doc.url)) {
      setRedirectUrl(doc.url);
      return;
    }

    const requestId = ++previewRequestIdRef.current;
    setPreviewDocIndex(index);

    if (doc.blobUrl || !isPreviewableDocumentUrl(doc.url) || !projectId) {
      setPreviewUrl(doc.blobUrl ?? doc.url);
      return;
    }

    setPreviewUrl(null);

    const apiClient = new ApiClient();
    apiClient
      .post<{ blobUrl: string | null }>(
        `/api/ai/research-agent/bootstrapper/project/${projectId}/messages/${messageId}/resolve-document-preview`,
        { documentIndex: index },
      )
      .then(({ data }) => {
        if (previewRequestIdRef.current !== requestId) {
          return;
        }
        setPreviewUrl(data?.blobUrl ?? doc.url);
        onSaved?.();
      })
      .catch((error) => {
        if (previewRequestIdRef.current !== requestId) {
          return;
        }
        console.error(
          "[DocumentsSection] Resolve document preview failed:",
          error,
        );
        setPreviewUrl(doc.url);
      });
  };

  const handleSavePreviewDocument = async () => {
    if (previewDocIndex === null) {
      return;
    }
    const previewIndex = previewDocIndex;

    const previewDocument = documents[previewIndex];
    if (!previewDocument || previewDocument.saved || !previewDocument.url) {
      return;
    }

    try {
      const result = await save({ itemIndices: [previewIndex] });
      if (!result) {
        return;
      }
      onSaved?.();
      if (result.skipped?.length) {
        toast.warning(
          `${result.skipped.length} document(s) skipped — file size exceeds 50MB limit`,
        );
        return;
      }
      setPreviewDocIndex(null);
      if (isDocumentSelected(previewIndex)) {
        toggleDocument(previewIndex);
      }
    } catch (error) {
      console.error("[DocumentsSection] Save failed:", error);
      toast.error("Failed to save documents to project");
    }
  };

  const isShowingAllDocs = (folderName: string) => {
    return showAllDocsInFolder.has(folderName);
  };

  const toggleShowAllDocs = (folderName: string) => {
    setShowAllDocsInFolder((previous) => {
      const next = new Set(previous);
      if (next.has(folderName)) {
        next.delete(folderName);
      } else {
        next.add(folderName);
      }
      return next;
    });
  };

  const headerCountLabel = buildHeaderCount(
    hasFolders,
    folders.length,
    singles.length,
    documents.length,
  );

  return (
    <ResearchSectionRoot tone="emerald">
      <ResearchSectionHeader
        tone="emerald"
        icon={<FileText className="size-4" />}
        title="Documents Found"
        count={headerCountLabel}
        actions={
          selectableCount > 0 ? (
            <SelectAllControl
              checked={isAllSelected}
              onChange={toggleAll}
              disabled={isSaving}
            />
          ) : undefined
        }
      />
      <ResearchSectionBody>
        {hasFolders && (
          <Accordion
            type="multiple"
            value={
              accordionValue ?? (folders.length > 0 ? [folders[0].name] : [])
            }
            onValueChange={setAccordionValue}
            className="flex flex-col gap-2"
          >
            {folders.map((folder) => {
              const folderState = getFolderState(folder.name);
              const isExpanded = isShowingAllDocs(folder.name);
              const visibleIndices = isExpanded
                ? folder.indices
                : folder.indices.slice(0, FOLDER_DOCS_LIMIT);
              const hasMore = folder.indices.length > FOLDER_DOCS_LIMIT;

              return (
                <AccordionItem
                  key={folder.name}
                  value={folder.name}
                  className={sectionItemSurfaceVariants()}
                >
                  <div className="flex items-start gap-3">
                    <div className="pt-0.5 shrink-0">
                      {folderState.allSaved ? (
                        <CheckCheck className="size-4 text-brand-700" />
                      ) : (
                        <Checkbox
                          checked={
                            folderState.isIndeterminate
                              ? "indeterminate"
                              : folderState.isChecked
                          }
                          onCheckedChange={() => toggleFolder(folder.name)}
                          disabled={
                            isSaving || folderState.unsavedIndices.length === 0
                          }
                          aria-label={`Select all documents in ${folder.name}`}
                          variant="dark"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <AccordionTrigger className="gap-3 p-0 text-left hover:no-underline">
                        <div className="min-w-0 flex-1">
                          <span className="text-xs text-neutral-700 font-semibold leading-4 line-clamp-2">
                            {folder.name}
                          </span>
                          {folder.description && (
                            <span className="text-xs text-gray-550 leading-4 block mt-0.5">
                              {folder.description}
                            </span>
                          )}
                        </div>
                        <div className="shrink-0 flex items-center justify-end">
                          <SectionPill
                            tone="secondary"
                            weight="strong"
                            align="center"
                            className="px-2"
                          >
                            {folder.indices.length} doc
                            {folder.indices.length !== 1 ? "s" : ""}
                          </SectionPill>
                        </div>
                      </AccordionTrigger>
                    </div>
                  </div>

                  <AccordionContent>
                    <div className="pt-2">
                      <div className="relative ml-3 pl-8">
                        <div
                          aria-hidden="true"
                          className="absolute left-2 top-0 bottom-0 w-px bg-neutral-200 dark:bg-neutral-800"
                        />
                        <div className="flex flex-col gap-2">
                          {visibleIndices.map((flatIndex) => {
                            const doc = documents[flatIndex];
                            return (
                              <DocumentRow
                                key={flatIndex}
                                doc={doc}
                                isSelected={isDocumentSelected(flatIndex)}
                                onToggle={() => toggleDocument(flatIndex)}
                                onPreview={() => handlePreviewOpen(flatIndex)}
                                isSaving={isSaving}
                              />
                            );
                          })}
                          {hasMore && (
                            <button
                              type="button"
                              className="flex items-center gap-1 text-xs text-gray-550 hover:text-foreground font-medium mt-1"
                              onClick={() => toggleShowAllDocs(folder.name)}
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="size-3" />
                                  Show less
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="size-3" />
                                  Show{" "}
                                  {folder.indices.length - FOLDER_DOCS_LIMIT}{" "}
                                  more
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}

        {!hasFolders &&
          documents.map((doc, index) => (
            <SectionItemCard key={index}>
              <DocumentRow
                doc={doc}
                isSelected={isDocumentSelected(index)}
                onToggle={() => toggleDocument(index)}
                onPreview={() => handlePreviewOpen(index)}
                isSaving={isSaving}
              />
            </SectionItemCard>
          ))}

        {hasFolders &&
          singles.length > 0 &&
          singles.map((flatIndex) => {
            const doc = documents[flatIndex];
            return (
              <SectionItemCard key={flatIndex}>
                <DocumentRow
                  doc={doc}
                  isSelected={isDocumentSelected(flatIndex)}
                  onToggle={() => toggleDocument(flatIndex)}
                  onPreview={() => handlePreviewOpen(flatIndex)}
                  isSaving={isSaving}
                />
              </SectionItemCard>
            );
          })}
      </ResearchSectionBody>

      {previewDocIndex !== null && documents[previewDocIndex]?.url && (
        <DocumentPreviewDialog
          id={`${messageId}-${previewDocIndex}`}
          filename={documents[previewDocIndex].title}
          url={documents[previewDocIndex].url}
          previewUrl={previewUrl}
          open
          onOpenChange={(open) => {
            if (!open) {
              previewRequestIdRef.current += 1;
              setPreviewDocIndex(null);
              setPreviewUrl(null);
            }
          }}
          addToProject={
            projectId &&
            !documents[previewDocIndex].saved &&
            !!documents[previewDocIndex].url
              ? {
                  isLoading: isSaving,
                  handler: () => {
                    void handleSavePreviewDocument();
                  },
                }
              : undefined
          }
        />
      )}
      <AlertDialog
        open={redirectUrl !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRedirectUrl(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Open external link</AlertDialogTitle>
            <AlertDialogDescription>
              You will be redirected to{" "}
              <span className="font-medium text-foreground">
                {redirectUrl ? getHostname(redirectUrl) : ""}
              </span>
              . This link will open in a new tab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (redirectUrl) {
                  window.open(redirectUrl, "_blank", "noopener,noreferrer");
                }
                setRedirectUrl(null);
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ResearchSectionRoot>
  );
}
