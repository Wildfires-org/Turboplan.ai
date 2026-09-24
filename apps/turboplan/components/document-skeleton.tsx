"use client";

export const DocumentSkeleton = () => {
  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="rounded-lg animate-pulse motion-reduce:animate-none h-12 bg-brandAlt-200/70 w-1/2" />
      <div className="rounded-lg animate-pulse motion-reduce:animate-none h-5 bg-brandAlt-200/70 w-full" />
      <div className="rounded-lg animate-pulse motion-reduce:animate-none h-5 bg-brandAlt-200/70 w-full" />
      <div className="rounded-lg animate-pulse motion-reduce:animate-none h-5 bg-brandAlt-200/70 w-1/3" />
      <div className="rounded-lg animate-pulse motion-reduce:animate-none h-5 bg-transparent w-52" />
      <div className="rounded-lg animate-pulse motion-reduce:animate-none h-8 bg-brandAlt-200/70 w-52" />
      <div className="rounded-lg animate-pulse motion-reduce:animate-none h-5 bg-brandAlt-200/70 w-2/3" />
    </div>
  );
};

export const InlineDocumentSkeleton = () => {
  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="rounded-lg animate-pulse motion-reduce:animate-none h-4 bg-brandAlt-200/70 w-48" />
      <div className="rounded-lg animate-pulse motion-reduce:animate-none h-4 bg-brandAlt-200/70 w-3/4" />
      <div className="rounded-lg animate-pulse motion-reduce:animate-none h-4 bg-brandAlt-200/70 w-1/2" />
      <div className="rounded-lg animate-pulse motion-reduce:animate-none h-4 bg-brandAlt-200/70 w-64" />
      <div className="rounded-lg animate-pulse motion-reduce:animate-none h-4 bg-brandAlt-200/70 w-40" />
      <div className="rounded-lg animate-pulse motion-reduce:animate-none h-4 bg-brandAlt-200/70 w-36" />
      <div className="rounded-lg animate-pulse motion-reduce:animate-none h-4 bg-brandAlt-200/70 w-64" />
    </div>
  );
};
