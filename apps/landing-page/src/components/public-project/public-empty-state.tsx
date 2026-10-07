interface PublicEmptyStateProps {
  title: string;
  message: string;
}

/** Empty state shared by the public project and template module sections. */
export function PublicEmptyState({ title, message }: PublicEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-brandAlt-100 px-4 py-8 text-center">
      <h3 className="mb-1 font-heading text-[18px] font-normal leading-[26px] text-egray-900">
        {title}
      </h3>
      <p className="max-w-md font-inter text-[14px] leading-[20px] text-egray-700">
        {message}
      </p>
    </div>
  );
}
