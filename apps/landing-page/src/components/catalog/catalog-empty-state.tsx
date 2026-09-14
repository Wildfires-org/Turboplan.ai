import type { ReactNode } from "react";

import Image, { type StaticImageData } from "next/image";

interface CatalogEmptyStateProps {
  backgroundImage: StaticImageData;
  beaverImage: StaticImageData;
  beaverAlt: string;
  title: string;
  description: string;
  actionButton: ReactNode;
}

export function CatalogEmptyState({
  backgroundImage,
  beaverImage,
  beaverAlt,
  title,
  description,
  actionButton,
}: CatalogEmptyStateProps) {
  return (
    <div className="relative rounded-xl border border-neutral-grey overflow-hidden">
      <Image
        src={backgroundImage}
        alt=""
        fill
        className="object-cover object-center opacity-40"
        aria-hidden
      />
      <div className="relative z-10 flex flex-col items-center justify-center py-16 px-6 text-center">
        <Image
          src={beaverImage}
          alt={beaverAlt}
          width={140}
          height={140}
          className="mb-4"
        />
        <h3 className="text-lg font-semibold text-neutral-black mb-2">
          {title}
        </h3>
        <p className="text-sm text-neutral-grey3 max-w-md mb-6">
          {description}
        </p>
        {actionButton}
      </div>
    </div>
  );
}
