import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

type EntityCardProps = {
  href: string;
  coverImageUrl?: string | null;
  badges?: React.ReactNode;
  title: string;
  description?: string | null;
  metadata?: React.ReactNode;
  footer?: React.ReactNode;
  progress?: React.ReactNode;
  className?: string;
};

export function EntityCard({
  href,
  coverImageUrl,
  badges,
  title,
  description,
  metadata,
  footer,
  progress,
  className,
}: EntityCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex h-[280px] flex-col justify-end overflow-hidden rounded-md border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md",
        className,
      )}
    >
      {/* Cover image area */}
      <div className="absolute inset-x-0 top-0 h-[210px] overflow-hidden">
        <Image
          src={coverImageUrl || "/images/tile-placeholder.png"}
          alt=""
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="320px"
        />
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-x-0 top-[62px] h-[143px] bg-gradient-to-b from-transparent via-white to-white" />
      {/* Solid white below gradient so image never bleeds into content */}
      <div className="absolute inset-x-0 bottom-0 top-[205px] bg-white" />

      {/* Content */}
      <div className="relative flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          {badges && (
            <div className="flex items-center justify-between">{badges}</div>
          )}
          <h3 className="line-clamp-1 text-base font-medium text-gray-900">
            {title}
          </h3>
          {description && (
            <p className="line-clamp-2 text-xs leading-[18px] text-gray-900/60">
              {description}
            </p>
          )}
        </div>

        {progress && <div>{progress}</div>}

        {metadata && (
          <div className="flex flex-wrap items-center gap-2">{metadata}</div>
        )}

        {footer && <div>{footer}</div>}
      </div>
    </Link>
  );
}
