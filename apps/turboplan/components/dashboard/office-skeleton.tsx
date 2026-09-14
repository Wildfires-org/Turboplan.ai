interface OfficeSkeletonProps {
  count?: number;
}

export function OfficeSkeleton({ count = 6 }: OfficeSkeletonProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={`skeleton-${i}`}
          className="relative flex h-[280px] flex-col justify-end overflow-hidden rounded-md border border-gray-200 bg-white p-6 animate-pulse"
        >
          {/* Cover image placeholder */}
          <div className="absolute inset-x-0 top-0 h-[210px] bg-gray-200" />

          {/* Gradient overlay (matches EntityCard) */}
          <div className="absolute inset-x-0 top-[60px] h-[150px] bg-gradient-to-b from-transparent to-white" />

          {/* Content skeleton */}
          <div className="relative flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              {/* Badge placeholder */}
              <div className="flex items-center gap-2">
                <div className="h-5 w-16 rounded-full bg-gray-200" />
              </div>

              {/* Title placeholder */}
              <div className="h-5 w-3/4 rounded bg-gray-200" />

              {/* Description placeholders */}
              <div className="flex flex-col gap-1">
                <div className="h-3 w-full rounded bg-gray-200" />
                <div className="h-3 w-2/3 rounded bg-gray-200" />
              </div>
            </div>

            {/* Metadata chips placeholder */}
            <div className="flex items-center gap-2">
              <div className="h-6 w-20 rounded-full bg-gray-200" />
              <div className="h-6 w-24 rounded-full bg-gray-200" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
