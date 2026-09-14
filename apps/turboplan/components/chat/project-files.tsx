export function ProjectFiles({ fileCount }: { fileCount: number }) {
  return (
    <div className="flex items-center ml-[10px] gap-2 border-2 border-black rounded-lg px-6 py-[10px]">
      <p className="text-sm font-medium">Project Files</p>
      <p className="size-5 text-xs font-medium flex items-center justify-center text-white bg-black rounded-full px-2 py-1">
        {fileCount}
      </p>
    </div>
  );
}
