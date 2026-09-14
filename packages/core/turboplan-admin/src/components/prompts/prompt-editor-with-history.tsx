"use client";

import { useCallback, useState } from "react";

import { usePrompt } from "../../hooks/use-prompts";
import { PromptEditor } from "./prompt-editor";
import { VersionHistory } from "./version-history";

interface PromptEditorWithHistoryProps {
  name: string;
}

export function PromptEditorWithHistory({
  name,
}: PromptEditorWithHistoryProps) {
  const { prompt, refreshPrompt } = usePrompt(name);
  const [selectedVersionNumber, setSelectedVersionNumber] = useState<
    number | null
  >(null);

  const handleRefresh = useCallback(async () => {
    setSelectedVersionNumber(null);
    await refreshPrompt();
  }, [refreshPrompt]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
      <div>
        <PromptEditor
          name={name}
          selectedVersionNumber={selectedVersionNumber}
        />
      </div>
      <div className="lg:sticky lg:top-6 lg:self-start">
        <VersionHistory
          promptName={name}
          versions={prompt?.versions || []}
          selectedVersionNumber={selectedVersionNumber}
          onSelectVersion={setSelectedVersionNumber}
          onRollback={handleRefresh}
        />
      </div>
    </div>
  );
}
