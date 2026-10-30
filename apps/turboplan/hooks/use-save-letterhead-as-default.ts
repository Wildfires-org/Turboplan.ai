import useSWR, { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";

import { fetcher } from "@wildfires-org/turboplan-api-client";

import { toast } from "@/components/toast";
import { revalidateDefaultLetterheadGrid } from "@/hooks/use-default-letterhead-grid";
import { useDocumentLetterhead } from "@/hooks/use-document-letterhead";
import {
  defaultLetterheadGridUrl,
  letterheadSaveTarget,
  type ProjectLetterheadTarget,
  projectLetterheadTargetUrl,
  saveAsDefaultLetterheadCopy,
} from "@/lib/default-letterhead-grid";
import {
  LetterheadSaveError,
  saveLetterheadAsDefaultFetcher,
} from "@/lib/export/letterhead";

interface UseSaveLetterheadAsDefaultOptions {
  projectId: string;
  documentId: string;
  // Asks where the copy could go only while the action may be offered.
  enabled: boolean;
}

// The server refuses every copy it cannot save the same way (404): in
// practice a copy that does not pass the editor's checks, which saving it in
// the editor fixes.
const NOT_SAVABLE_MESSAGE =
  "This letterhead can't be saved as a default yet — open it in the editor, save it, and try again.";

const saveErrorMessage = (error: unknown) => {
  if (error instanceof LetterheadSaveError && error.status === 404) {
    return NOT_SAVABLE_MESSAGE;
  }
  return error instanceof Error ? error.message : "Failed to save letterhead";
};

/**
 * "Save as organization letterhead" for a document's own copy: where it
 * would go for this project (the office or the organization, see
 * `letterheadSaveTarget`; null while unknown or when the user may change
 * neither — the action is then hidden), its words, and `save()`, which saves
 * the copy as stored (never unsaved edits), toasts, and refreshes the
 * caches the new default changes. Resolves whether it saved.
 */
export const useSaveLetterheadAsDefault = ({
  projectId,
  documentId,
  enabled,
}: UseSaveLetterheadAsDefaultOptions) => {
  const { mutate } = useSWRConfig();
  const { data: projectTarget } = useSWR<ProjectLetterheadTarget>(
    enabled ? projectLetterheadTargetUrl(projectId) : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const documentLetterhead = useDocumentLetterhead(projectId, documentId);
  const saveTarget = projectTarget
    ? letterheadSaveTarget(
        projectTarget,
        !!documentLetterhead?.defaultLetterhead,
      )
    : null;
  const copy = saveTarget ? saveAsDefaultLetterheadCopy(saveTarget) : null;
  const { trigger, isMutating } = useSWRMutation(
    saveTarget
      ? `${defaultLetterheadGridUrl(saveTarget.owner)}/from-document`
      : null,
    saveLetterheadAsDefaultFetcher,
  );

  const save = async (): Promise<boolean> => {
    if (!saveTarget || !copy) {
      return false;
    }
    try {
      const saved = await trigger({ projectId, documentId });
      // Also refreshes `letterhead-target`: the office may have a default of
      // its own now.
      revalidateDefaultLetterheadGrid(mutate, saveTarget.owner, saved);
    } catch (error) {
      toast({ type: "error", description: saveErrorMessage(error) });
      return false;
    }
    toast({ type: "success", description: copy.successMessage });
    return true;
  };

  return { copy, isSaving: isMutating, save };
};
