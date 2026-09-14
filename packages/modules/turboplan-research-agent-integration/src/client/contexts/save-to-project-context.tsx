"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { toast } from "sonner";

export type SaveSectionDetail = {
  sectionKey: string;
  savedCount: number;
  itemNames: string[];
};

export type SaveDetails = {
  totalSaved: number;
  sections: SaveSectionDetail[];
};

type SectionSaveRegistration = {
  sectionKey: string;
  selectedCount: number;
  save: () => Promise<{ savedCount: number; itemNames: string[] } | null>;
  clear: () => void;
};

type SaveToProjectContextValue = {
  totalSelectedCount: number;
  isSaving: boolean;
  saveAll: () => Promise<void>;
  lastSaveResult: { totalSaved: number } | null;
  clearLastSaveResult: () => void;
};

type RegisterFn = (registration: SectionSaveRegistration) => void;
type UnregisterFn = (sectionKey: string) => void;

type SaveToProjectInternalContextValue = SaveToProjectContextValue & {
  register: RegisterFn;
  unregister: UnregisterFn;
};

const SaveToProjectContext =
  createContext<SaveToProjectInternalContextValue | null>(null);

type SaveToProjectProviderProps = {
  onSaved?: (details: SaveDetails) => void;
  children: ReactNode;
};

export const SaveToProjectProvider = ({
  onSaved,
  children,
}: SaveToProjectProviderProps) => {
  const registrationsRef = useRef<Map<string, SectionSaveRegistration>>(
    new Map(),
  );
  const [, setRenderTick] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaveResult, setLastSaveResult] = useState<{
    totalSaved: number;
  } | null>(null);

  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  const forceUpdate = useCallback(() => {
    setRenderTick((prev) => prev + 1);
  }, []);

  const register: RegisterFn = useCallback(
    (registration) => {
      registrationsRef.current.set(registration.sectionKey, registration);
      forceUpdate();
    },
    [forceUpdate],
  );

  const unregister: UnregisterFn = useCallback(
    (sectionKey) => {
      registrationsRef.current.delete(sectionKey);
      forceUpdate();
    },
    [forceUpdate],
  );

  const totalSelectedCount = Array.from(
    registrationsRef.current.values(),
  ).reduce((sum, reg) => sum + reg.selectedCount, 0);

  const saveAll = useCallback(async () => {
    const activeRegistrations = Array.from(
      registrationsRef.current.values(),
    ).filter((reg) => reg.selectedCount > 0);

    if (activeRegistrations.length === 0) {
      return;
    }

    setIsSaving(true);

    try {
      const results = await Promise.allSettled(
        activeRegistrations.map((reg) => reg.save()),
      );

      let totalSaved = 0;
      let hasFailure = false;
      const sections: SaveSectionDetail[] = [];

      results.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value !== null) {
          totalSaved += result.value.savedCount;
          sections.push({
            sectionKey: activeRegistrations[index].sectionKey,
            savedCount: result.value.savedCount,
            itemNames: result.value.itemNames,
          });
          activeRegistrations[index].clear();
        } else {
          hasFailure = true;
        }
      });

      setLastSaveResult({ totalSaved });

      if (hasFailure) {
        toast.error("Failed to save some items to project");
      }

      onSavedRef.current?.({ totalSaved, sections });
    } finally {
      setIsSaving(false);
    }
  }, []);

  const clearLastSaveResult = useCallback(() => {
    setLastSaveResult(null);
  }, []);

  const value: SaveToProjectInternalContextValue = {
    totalSelectedCount,
    isSaving,
    saveAll,
    lastSaveResult,
    clearLastSaveResult,
    register,
    unregister,
  };

  return (
    <SaveToProjectContext.Provider value={value}>
      {children}
    </SaveToProjectContext.Provider>
  );
};

export const useSaveToProjectContext = (): SaveToProjectContextValue => {
  const context = useContext(SaveToProjectContext);

  if (!context) {
    throw new Error(
      "useSaveToProjectContext must be used within a SaveToProjectProvider",
    );
  }

  const { register: _, unregister: __, ...publicApi } = context;
  return publicApi;
};

export const useSectionSaveRegistration = (
  sectionKey: string,
  selectedCount: number,
  save: () => Promise<{ savedCount: number; itemNames: string[] } | null>,
  clear: () => void,
) => {
  const context = useContext(SaveToProjectContext);

  if (!context) {
    throw new Error(
      "useSectionSaveRegistration must be used within a SaveToProjectProvider",
    );
  }

  const { register, unregister } = context;

  const saveRef = useRef(save);
  saveRef.current = save;

  const clearRef = useRef(clear);
  clearRef.current = clear;

  useEffect(() => {
    register({
      sectionKey,
      selectedCount,
      save: () => saveRef.current(),
      clear: () => clearRef.current(),
    });
  }, [sectionKey, selectedCount, register]);

  useEffect(() => {
    return () => {
      unregister(sectionKey);
    };
  }, [sectionKey, unregister]);
};
