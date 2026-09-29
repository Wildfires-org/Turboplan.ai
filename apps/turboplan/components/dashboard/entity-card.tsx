import Image from "next/image";
import Link from "next/link";

import { GLASS_CARD_LINK_CLASS } from "@/lib/glass";
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
        GLASS_CARD_LINK_CLASS,
        "flex h-[280px] flex-col",
        className,
      )}
    >
      {/* Cover inset in the glass shell. It takes whatever height the content
          leaves, so cards of every fixed height keep their text intact. */}
      <div className="flex min-h-0 flex-1 flex-col p-2 pb-0">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-brandAlt-100">
          <Image
            src={coverImageUrl || "/images/tile-placeholder.png"}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 400px"
          />
        </div>
      </div>

      <EntityCardBody
        badges={badges}
        title={title}
        description={description}
        progress={progress}
        metadata={metadata}
        footer={footer}
      />
    </Link>
  );
}

type EntityCardBodyProps = Pick<
  EntityCardProps,
  "badges" | "title" | "description" | "metadata" | "footer" | "progress"
>;

// Exported so the card skeleton renders the exact same box model.
export const ENTITY_CARD_BODY_CLASS =
  "flex shrink-0 flex-col gap-3 px-4 pb-4 pt-3.5";

function EntityCardBody({
  badges,
  title,
  description,
  metadata,
  footer,
  progress,
}: EntityCardBodyProps) {
  return (
    <div className={ENTITY_CARD_BODY_CLASS}>
      <div className="flex flex-col gap-1.5">
        {badges && (
          <div className="flex items-center justify-between">{badges}</div>
        )}
        <h3 className="line-clamp-1 text-[15px] font-medium leading-[22px] tracking-[-0.01em] text-foreground">
          {title}
        </h3>
        {description && (
          <p className="line-clamp-2 text-xs leading-[18px] text-gray-550">
            {description}
          </p>
        )}
      </div>

      {progress && <div>{progress}</div>}

      {metadata && (
        <div className="flex flex-wrap items-center gap-1.5">{metadata}</div>
      )}

      {footer && <div>{footer}</div>}
    </div>
  );
}
