"use client";

import { useRouter } from "next/navigation";

interface GoBackButtonProps {
  className?: string;
}

export const GoBackButton = ({ className }: GoBackButtonProps) => {
  const router = useRouter();

  return (
    <button type="button" onClick={() => router.back()} className={className}>
      Go back
    </button>
  );
};
