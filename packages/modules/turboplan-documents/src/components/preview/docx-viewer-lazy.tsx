"use client";

import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";

export const DocxViewerLazy = dynamic(
  () => import("./docx-viewer").then((mod) => ({ default: mod.DocxViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    ),
  },
);
