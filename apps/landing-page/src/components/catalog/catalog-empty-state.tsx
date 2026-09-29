import type { ReactNode } from "react";

import Image, { type StaticImageData } from "next/image";

interface CatalogEmptyStateProps {
  beaverImage: StaticImageData;
  beaverAlt: string;
  title: string;
  description: string;
  actionButton: ReactNode;
}

export function CatalogEmptyState({
  beaverImage,
  beaverAlt,
  title,
  description,
  actionButton,
}: CatalogEmptyStateProps) {
  return (
    <div className="glass-card flex flex-col items-center justify-center rounded-[28px] px-6 py-12 text-center sm:px-8 sm:py-14 lg:py-16">
      <Image
        src={beaverImage}
        alt={beaverAlt}
        width={120}
        height={120}
        className="mb-5 size-[100px] object-contain sm:size-[120px]"
      />
      <h3 className="mb-2 font-heading text-[22px] font-normal leading-[1.2] tracking-[-0.02em] text-egray-900 sm:text-[24px]">
        {title}
      </h3>
      <p className="mb-6 max-w-md font-inter text-[15px] leading-[22px] text-egray-700">
        {description}
      </p>
      {actionButton}
    </div>
  );
}
