import Image from "next/image";

import { cn } from "@/lib/utils";
import { PAGE_CONTAINER, PAGE_GUTTER } from "./ui/layout";

interface Logo {
  name: string;
  src: string;
  width: number;
  height: number;
  // Rendered height class. Logos differ wildly in shape (wide wordmark vs.
  // square badge), so each one is tuned to look optically equal.
  heightClass: string;
}

// width/height are the SVGs' intrinsic sizes (keeps the aspect ratio).
// Order alternates wordmarks and badges so look-alikes (the two National
// Forest trapezoids, the two shields) never sit side by side — including
// across the loop seam, where the last logo meets the first.
const LOGOS: Logo[] = [
  {
    name: "Wildfires",
    src: "/images/logos/wildfires.svg",
    width: 130,
    height: 26,
    heightClass: "h-5",
  },
  {
    name: "Partner 3",
    src: "/images/logos/partner-3.svg",
    width: 56,
    height: 34,
    heightClass: "h-8",
  },
  {
    name: "Partner 6",
    src: "/images/logos/partner-6.svg",
    width: 132,
    height: 54,
    heightClass: "h-9",
  },
  {
    name: "USFS",
    src: "/images/logos/usfs.svg",
    width: 42,
    height: 42,
    heightClass: "h-9",
  },
  {
    name: "Partner 7",
    src: "/images/logos/partner-7.svg",
    width: 87,
    height: 32,
    heightClass: "h-7",
  },
  {
    name: "Partner 4",
    src: "/images/logos/partner-4.svg",
    width: 56,
    height: 34,
    heightClass: "h-8",
  },
  {
    name: "Partner 5",
    src: "/images/logos/partner-5.svg",
    width: 33,
    height: 44,
    heightClass: "h-10",
  },
];

// Four copies: the first is the real list, the rest are decorative. The
// animation shifts the track by -50% (two copies, ~1.76k px), so each half is
// wider than the 1200px container and the right edge never runs dry.
const COPY_COUNT = 4;

// Each copy carries a trailing gap (pr = gap) so copy N ends exactly where
// copy N+1 begins and the loop point is seamless.
const LIST_SPACING = "gap-14 pr-14 sm:gap-[72px] sm:pr-[72px]";

const EDGE_FADE =
  "[mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)] [-webkit-mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]";

export function LogoMarquee() {
  return (
    <section aria-label="Partners" className={PAGE_GUTTER}>
      {/* Separators span the content container only, not the page. */}
      <div
        className={cn(
          PAGE_CONTAINER,
          "border-y border-brandAlt-200 py-8 sm:py-10",
        )}
      >
        <div
          className={cn(
            "group overflow-hidden",
            EDGE_FADE,
            "motion-reduce:[mask-image:none] motion-reduce:[-webkit-mask-image:none]",
          )}
        >
          <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused] motion-reduce:w-full motion-reduce:animate-none">
            {Array.from({ length: COPY_COUNT }, (_, copy) => {
              const isDuplicate = copy > 0;

              return (
                <ul
                  key={copy}
                  aria-hidden={isDuplicate || undefined}
                  className={cn(
                    "flex shrink-0 items-center",
                    LIST_SPACING,
                    isDuplicate
                      ? "motion-reduce:hidden"
                      : "motion-reduce:w-full motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:gap-y-6 motion-reduce:pr-0 sm:motion-reduce:pr-0",
                  )}
                >
                  {LOGOS.map((logo) => (
                    <li key={logo.name} className="flex shrink-0 items-center">
                      <Image
                        src={logo.src}
                        alt={isDuplicate ? "" : logo.name}
                        width={logo.width}
                        height={logo.height}
                        className={cn(
                          "w-auto object-contain",
                          logo.heightClass,
                        )}
                      />
                    </li>
                  ))}
                </ul>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
