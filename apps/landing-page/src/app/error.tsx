"use client";

import { useEffect } from "react";

import * as Sentry from "@sentry/nextjs";
import { ChevronDown, TriangleAlert } from "lucide-react";
import Link from "next/link";

import {
  GLASS_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@/components/catalog/catalog-layout";
import { StatusPanel } from "@/components/shared/status-panel";
import { getLogger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { routing } from "@/utils/routing";

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
    <StatusPanel
      icon={TriangleAlert}
      eyebrow="Error"
      title="Something went wrong"
      lead="An unexpected error has occurred. Try again, and if it keeps happening please report the details below."
      actions={
        <>
          <button
            type="button"
            onClick={reset}
            className={cn(PRIMARY_BUTTON_CLASS, "h-11")}
          >
            Try again
          </button>
          <Link
            href={routing.home()}
            className={cn(GLASS_BUTTON_CLASS, "h-11")}
          >
            Go to homepage
          </Link>
        </>
      }
    >
      <details className="group glass-inset mt-8 rounded-2xl text-left">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 font-inter text-[14px] font-medium text-egray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 [&::-webkit-details-marker]:hidden">
          Error details
          <ChevronDown
            aria-hidden
            className="size-4 text-egray-700 transition-transform duration-200 ease-out-expo group-open:rotate-180 motion-reduce:transition-none"
          />
        </summary>
        <div className="space-y-3 px-4 pb-4 font-inter text-[14px] leading-[20px] text-egray-700">
          <p className="break-words">
            <span className="font-medium text-egray-900">Message:</span>{" "}
            {error.message}
          </p>
          {error.digest && (
            <p className="break-words">
              <span className="font-medium text-egray-900">Digest:</span>{" "}
              {error.digest}
            </p>
          )}
          {error.stack && (
            <pre className="max-h-64 overflow-auto rounded-xl bg-brandAlt-100 p-3 font-mono text-[12px] leading-[18px]">
              {error.stack}
            </pre>
          )}
        </div>
      </details>
    </StatusPanel>
  );
}
