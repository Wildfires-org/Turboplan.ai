"use client";

import { useEffect } from "react";

import * as Sentry from "@sentry/nextjs";

import { ErrorPage } from "@/components/error-page";

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

const ErrorBoundary = ({ error, reset }: ErrorBoundaryProps) => {
  useEffect(() => {
    console.error(error);
    // Server-side errors (digest set) are already captured via onRequestError
    // with the full stack — the client only sees a redacted stub.
    if (!error.digest) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <ErrorPage
      title="Something went wrong!"
      description="An unexpected error occurred. Our beaver is working hard to fix things — try refreshing or head back to your projects."
      primaryAction={{ label: "Try again", onClick: reset }}
    />
  );
};

export default ErrorBoundary;
