import { FileText } from "lucide-react";

interface AttachedDocumentsProps {
  names: string[];
}

/**
 * The landing-page documents a self-service link would add to the new
 * project. Shown before anything is created, because the link may not be the
 * user's own.
 */
export function AttachedDocuments({ names }: AttachedDocumentsProps) {
  return (
    <div>
      <p
        id="attached-documents-label"
        className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1"
      >
        Attached documents
      </p>
      <ul
        aria-labelledby="attached-documents-label"
        className="space-y-1 rounded-md bg-gray-50 px-3 py-2 dark:bg-zinc-800"
      >
        {names.map((name, index) => (
          <li
            // Two different files can share a name
            key={`${index}-${name}`}
            className="flex min-w-0 items-center gap-2 text-sm text-gray-600 dark:text-zinc-400"
          >
            <FileText aria-hidden className="size-4 shrink-0" />
            {/* Isolated so right-to-left text in a name cannot reorder the
                text around it; the title shows the name in full. */}
            <bdi className="min-w-0 truncate" title={name}>
              {name}
            </bdi>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
        {names.length === 1 ? "This document" : "These documents"} will be added
        to the new project. Only continue if you attached{" "}
        {names.length === 1 ? "it" : "them"}.
      </p>
    </div>
  );
}
