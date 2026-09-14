"use client";

import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";

export const PdfViewerLazy = dynamic(
  () => import("./pdf-viewer").then((mod) => ({ default: mod.PdfViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    ),
  },
);
