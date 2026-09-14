"use client";

import { useEffect, useMemo, useState } from "react";

import type { DocumentItem } from "../../types";

type FolderGroup = {
  name: string;
  description?: string;
  indices: number[];
};

type FolderState = {
  allSaved: boolean;
  unsavedIndices: number[];
  selectedCount: number;
  isChecked: boolean;
  isIndeterminate: boolean;
};

const isSelectable = (doc: DocumentItem) => {
  return !doc.saved && !!doc.url;
};

export const useDocumentFolderSelection = (documents: DocumentItem[]) => {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(),
  );

  const { folders, singles } = useMemo(() => {
    const folderMap = new Map<string, FolderGroup>();
    const singleIndices: number[] = [];

    documents.forEach((doc, index) => {
      if (doc.folder) {
        const existing = folderMap.get(doc.folder);
        if (existing) {
          existing.indices.push(index);
          if (!existing.description && doc.folderDescription) {
            existing.description = doc.folderDescription;
          }
        } else {
          folderMap.set(doc.folder, {
            name: doc.folder,
            description: doc.folderDescription,
            indices: [index],
          });
        }
      } else {
        singleIndices.push(index);
      }
    });

    return {
      folders: Array.from(folderMap.values()),
      singles: singleIndices,
    };
  }, [documents]);

  const hasFolders = folders.length > 0;

  useEffect(() => {
    setSelectedIndices((prev) => {
      const pruned = new Set<number>();
      for (const idx of prev) {
        if (idx < documents.length && isSelectable(documents[idx])) {
          pruned.add(idx);
        }
      }
      return pruned.size === prev.size ? prev : pruned;
    });
  }, [documents]);

  const selectableCount = useMemo(() => {
    return documents.filter((doc) => isSelectable(doc)).length;
  }, [documents]);

  const selectedCount = selectedIndices.size;

  const isAllSelected =
    selectableCount > 0 && selectedCount === selectableCount;

  const folderStates = useMemo(() => {
    const states = new Map<string, FolderState>();
    for (const folder of folders) {
      const unsavedIndices = folder.indices.filter((index) =>
        isSelectable(documents[index]),
      );
      const folderSelectedCount = unsavedIndices.filter((index) =>
        selectedIndices.has(index),
      ).length;
      states.set(folder.name, {
        allSaved: unsavedIndices.length === 0 && folder.indices.length > 0,
        unsavedIndices,
        selectedCount: folderSelectedCount,
        isChecked:
          unsavedIndices.length > 0 &&
          folderSelectedCount === unsavedIndices.length,
        isIndeterminate:
          folderSelectedCount > 0 &&
          folderSelectedCount < unsavedIndices.length,
      });
    }
    return states;
  }, [folders, documents, selectedIndices]);

  const getFolderState = (folderName: string): FolderState => {
    return (
      folderStates.get(folderName) ?? {
        allSaved: false,
        unsavedIndices: [],
        selectedCount: 0,
        isChecked: false,
        isIndeterminate: false,
      }
    );
  };

  const isDocumentSelected = (flatIndex: number) => {
    return selectedIndices.has(flatIndex);
  };

  const toggleFolder = (folderName: string) => {
    const folder = folders.find((f) => f.name === folderName);
    if (!folder) {
      return;
    }

    const selectableInFolder = folder.indices.filter((index) =>
      isSelectable(documents[index]),
    );

    if (selectableInFolder.length === 0) {
      return;
    }

    setSelectedIndices((previous) => {
      const next = new Set(previous);
      const allSelected = selectableInFolder.every((index) => next.has(index));

      if (allSelected) {
        for (const index of selectableInFolder) {
          next.delete(index);
        }
      } else {
        for (const index of selectableInFolder) {
          next.add(index);
        }
      }

      return next;
    });
  };

  const toggleDocument = (flatIndex: number) => {
    const doc = documents[flatIndex];
    if (!doc || !isSelectable(doc)) {
      return;
    }

    setSelectedIndices((previous) => {
      const next = new Set(previous);

      if (next.has(flatIndex)) {
        next.delete(flatIndex);
      } else {
        next.add(flatIndex);
      }

      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIndices((previous) => {
      const allSelectableIndices = documents
        .map((_, index) => index)
        .filter((index) => isSelectable(documents[index]));

      const allCurrentlySelected = allSelectableIndices.every((index) =>
        previous.has(index),
      );

      if (allCurrentlySelected) {
        return new Set<number>();
      }

      return new Set(allSelectableIndices);
    });
  };

  const clear = () => {
    setSelectedIndices(new Set());
  };

  return {
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
  };
};
