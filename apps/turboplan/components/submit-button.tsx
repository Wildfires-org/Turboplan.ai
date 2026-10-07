"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@wildfires-org/turboplan-utils";

import { LoaderIcon } from "@/components/icons";

export const SubmitButton = ({
  children,
  isSuccessful,
}: {
  children: React.ReactNode;
  isSuccessful: boolean;
}) => {
  const { pending } = useFormStatus();

  return (
    <Button
      type={pending ? "button" : "submit"}
      aria-disabled={pending || isSuccessful}
      disabled={pending || isSuccessful}
      variant="brand"
      className="relative h-10 w-full text-[15px] font-medium"
    >
      {children}

      {(pending || isSuccessful) && (
        <span className="animate-spin absolute right-4">
          <LoaderIcon />
        </span>
      )}

      <output aria-live="polite" className="sr-only">
        {pending || isSuccessful ? "Loading" : "Submit form"}
      </output>
    </Button>
  );
};
