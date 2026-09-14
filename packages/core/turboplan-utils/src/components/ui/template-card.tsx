"use client";

import type { ReactNode } from "react";

import { ImageIcon, Info } from "lucide-react";
import Image from "next/image";

import { cn } from "../../tailwind";

export interface TemplateCardProps {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  /** Rendered in the top-right corner of the image area (e.g. "•••" menu button) */
  menuSlot?: ReactNode;
  /** Rendered below the description (e.g. "Start project" button) */
  actionSlot?: ReactNode;
  className?: string;
}

export function TemplateCard({
  name,
  description,
  imageUrl,
  menuSlot,
  actionSlot,
  className,
}: TemplateCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col bg-white rounded-xl border border-[#e8e8e8] overflow-hidden hover:shadow-md transition-shadow",
        className,
      )}
    >
      {/* Image area with gradient mask */}
      <div
        className="aspect-video bg-[#F8F9F9] relative"
        style={{
          maskImage: "linear-gradient(to bottom, black 80%, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, black 80%, transparent)",
        }}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon className="size-8 text-[#74777C]/40" />
          </div>
        )}
        {menuSlot && <div className="absolute top-3 right-3">{menuSlot}</div>}
      </div>

      <div className="flex flex-col flex-1 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Info className="w-4 h-4 shrink-0 text-[#74777C]" />
          <span
            className="text-sm font-medium text-gray-900 line-clamp-2"
            title={name}
          >
            {name}
          </span>
        </div>
        {description && (
          <p
            className="text-sm text-[#74777C] line-clamp-3"
            title={description}
          >
            {description}
          </p>
        )}
        <div className="mt-auto pt-4">{actionSlot}</div>
      </div>
    </div>
  );
}
