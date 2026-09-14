"use client";

import { useState } from "react";

import type { AuthUser } from "@/lib/types/auth";

interface UseFormStateParams {
  isAuthenticated: boolean;
  user: AuthUser | null;
  urlEmail: string | null;
  urlProjectTitle: string;
}

export function useFormState({
  isAuthenticated,
  user,
  urlEmail,
  urlProjectTitle,
}: UseFormStateParams) {
  const [email, setEmail] = useState(
    isAuthenticated ? user?.email || "" : urlEmail || "",
  );
  const [projectTitle, setProjectTitle] = useState(urlProjectTitle);

  return {
    email,
    setEmail,
    projectTitle,
    setProjectTitle,
  };
}
