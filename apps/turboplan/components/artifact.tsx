"use client";

import {
  type Dispatch,
  memo,
  type SetStateAction,
  useEffect,
  useState,
} from "react";

import type { UIMessage } from "ai";
import dynamic from "next/dynamic";

import type { Attachment } from "@wildfires-org/turboplan-chat-actions/types";
import {
  isMapPackageEnabled,
  isTasksPackageEnabled,
} from "@wildfires-org/turboplan-feature-flags";
import { mapArtifact } from "@wildfires-org/turboplan-map/client";
import { tasksArtifact } from "@wildfires-org/turboplan-tasks/artifact/client";

import { textArtifact } from "@/artifacts/text/client";
import { useArtifactSelector } from "@/hooks/use-artifact";
import type { ChatHelpers } from "@/hooks/use-chat-compat";
import type { ArtifactPanelProps } from "./artifact-panel";

// Build artifact definitions array conditionally based on feature flags
// Note: Imports are always present, but artifacts are only included if their feature flag is enabled
// This allows for proper tree-shaking in production builds
const baseDefinitions = [textArtifact];

export const artifactDefinitions = [
  ...baseDefinitions,
  ...(isTasksPackageEnabled() ? [tasksArtifact] : []),
  ...(isMapPackageEnabled() ? [mapArtifact] : []),
];
export type ArtifactKind = (typeof artifactDefinitions)[number]["kind"];

export interface UIArtifact {
  title: string;
  documentId: string;
  kind: ArtifactKind;
  content: string;
  isVisible: boolean;
  status: "streaming" | "idle";
  boundingBox: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}
const ArtifactPanel = dynamic(
  () => import("./artifact-panel").then((mod) => mod.ArtifactPanel),
  {
    ssr: false,
    loading: () => null,
  },
);

interface ArtifactProps {
  chatId: string;
  input: string;
  setInput: ChatHelpers["setInput"];
  status: ChatHelpers["status"];
  stop: ChatHelpers["stop"];
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<UIMessage>;
  setMessages: ChatHelpers["setMessages"];
  append: ChatHelpers["append"];
  handleSubmit: ChatHelpers["handleSubmit"];
  reload: ChatHelpers["reload"];
  isReadonly: boolean;
  projectId?: string;
}

function PureArtifact(props: ArtifactProps) {
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);
  const [hasOpened, setHasOpened] = useState(isArtifactVisible);

  useEffect(() => {
    if (isArtifactVisible) {
      setHasOpened(true);
    }
  }, [isArtifactVisible]);

  if (!hasOpened) {
    return null;
  }

  return <ArtifactPanel {...(props as ArtifactPanelProps)} />;
}

export const Artifact = memo(PureArtifact, (prevProps, nextProps) => {
  if (prevProps.status !== nextProps.status) return false;
  if (prevProps.projectId !== nextProps.projectId) return false;
  if (prevProps.input !== nextProps.input) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;

  return true;
});
