"use client";

import { useEffect } from "react";

import * as Sentry from "@sentry/nextjs";

import { Button } from "@/components/ui/button";
import { getLogger } from "@/lib/logger";

const logger = getLogger("GenericClientError");

interface IErrorProps {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
}

export default function Error({ error, reset }: IErrorProps) {
  useEffect(() => {
    logger.error(error);
    // Server-side errors (digest set) are already captured via onRequestError
    // with the full stack — the client only sees a redacted stub.
    if (!error.digest) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <div className="flex flex-col gap-2 w-full">
      <h1>Unexpected error has occurred!</h1>
      <p>Please report the following:</p>
      <p>Error message: {error.message}</p>
      <p>Error Stack Trace:</p>
      <pre className="overflow-x-auto">{error.stack}</pre>
      <Button className="mt-2 bg-primaryGreen" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
