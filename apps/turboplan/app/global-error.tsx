"use client";

import { useEffect } from "react";

import * as Sentry from "@sentry/nextjs";
import { Geist } from "next/font/google";

import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

const GlobalError = ({ error, reset }: GlobalErrorProps) => {
  useEffect(() => {
    console.error(error);
    // Server-side errors (digest set) are already captured via onRequestError
    // with the full stack — the client only sees a redacted stub.
    if (!error.digest) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <html lang="en" className={geist.variable}>
      <body className="font-[family-name:var(--font-geist)] bg-[#f4f9f7] m-0">
        <div className="flex min-h-dvh w-screen items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl shadow-[0px_4px_4px_0px_rgba(0,0,0,0.1)] p-9 w-full max-w-[456px]">
            <div className="flex flex-col items-center gap-[30px]">
              <div className="flex flex-col items-center gap-9 w-full">
                <div className="flex flex-col items-center gap-[18px] w-full max-w-[384px]">
                  <h1 className="text-2xl font-semibold text-neutral-900 text-center">
                    Something went wrong!
                  </h1>
                  <p className="text-sm text-gray-400 text-center leading-5">
                    An unexpected error occurred. Please try refreshing the
                    page.
                  </p>
                </div>

                <div className="flex items-start gap-1.5">
                  <button
                    type="button"
                    onClick={() => window.history.back()}
                    className="inline-flex items-center justify-center rounded-md px-4 py-2 text-[15px] font-medium text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
                  >
                    Go back
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex items-center justify-center rounded-md bg-[#1B845C] hover:bg-[#156647] text-white px-4 py-2 text-[15px] font-medium min-w-[201px] transition-colors cursor-pointer"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
};

export default GlobalError;
