import Image from "next/image";
import Link from "next/link";

import { ENTRY_PAGE_CONTENT } from "@/lib/entry-point/content";
import { PromptComposer } from "./prompt-composer";

interface EntryPageProps {
  /** `?projectDescription=` prefill, as the landing page accepts it. */
  initialPrompt?: string;
}

// The full Wildfires logo (mark + name). A fork replaces this file's contents
// in place (see lib/brand.ts).
const WILDFIRES_WORDMARK = "/brand/wildfires/wordmark.svg";

const PAGE_WIDTH_CLASS = "mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-10";

/**
 * What a signed-out visitor sees at `/` when the build sets
 * `NEXT_PUBLIC_ENTRY_POINT=prompt` (lib/entry-point/config.ts): a prompt box
 * that starts the self-service signup with the project already described.
 */
export function EntryPage({ initialPrompt }: EntryPageProps) {
  const content = ENTRY_PAGE_CONTENT;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip bg-brandAlt-100 text-gray-950">
      {/* Hairlines on the edges of the step cards, after the wildfires.org
          page grid. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-[1032px] -translate-x-1/2 border-x border-black/[0.05] lg:block"
      />

      <header className="relative">
        <div
          className={`${PAGE_WIDTH_CLASS} flex h-16 items-center justify-between gap-4 sm:h-20`}
        >
          <Link
            href="/"
            className="-m-1 flex items-center gap-2.5 rounded-md p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <Image
              src={WILDFIRES_WORDMARK}
              alt="Wildfires"
              width={157}
              height={32}
              priority
              unoptimized
              className="h-7 w-auto sm:h-8"
            />
          </Link>

          <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/login"
              className="rounded-full px-3 py-2 text-[15px] font-medium uppercase tracking-[0.04em] hover:bg-black/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              Sign in
            </Link>
            <a
              href={content.sourceCodeUrl}
              aria-label="Source code on GitHub"
              title="Source code on GitHub"
              className="flex size-11 items-center justify-center rounded-full hover:bg-black/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <GitHubMark />
            </a>
          </nav>
        </div>
      </header>

      <main className="relative flex-1">
        <section
          aria-labelledby="entry-headline"
          className="mx-auto w-full max-w-[880px] px-4 pb-16 pt-8 text-center sm:px-10 sm:pb-20 sm:pt-14 lg:pt-20"
        >
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[12px] font-medium uppercase leading-4 tracking-[0.08em] ring-1 ring-black/[0.08]">
            <span aria-hidden className="size-1.5 rounded-full bg-brand-500" />
            {content.badge}
          </p>
          <h1
            id="entry-headline"
            className="mt-6 text-balance text-[52px] font-semibold leading-[0.95] tracking-[-0.045em] sm:text-[80px] lg:text-[96px]"
          >
            {content.headline}
          </h1>
          <p className="mx-auto mt-6 max-w-[34rem] text-balance text-[18px] leading-normal text-gray-550 sm:text-[20px]">
            {content.lead}
          </p>

          <div className="mx-auto mt-10 max-w-[720px] sm:mt-12">
            <PromptComposer
              placeholder={content.placeholder}
              examplesLabel={content.examplesLabel}
              examples={content.examples}
              initialPrompt={initialPrompt}
            />
          </div>
        </section>

        <section
          aria-labelledby="entry-steps"
          className="mx-auto w-full max-w-[1080px] px-4 pb-20 sm:px-6 sm:pb-28"
        >
          <h2 id="entry-steps" className="sr-only">
            How it works
          </h2>
          <ol className="grid gap-4 sm:grid-cols-3 sm:gap-5">
            {content.steps.map((step, index) => (
              <li
                key={step.title}
                className="relative rounded-[20px] bg-white p-6 shadow-[0_24px_40px_-32px_rgba(11,13,15,0.4)] ring-1 ring-black/[0.06] sm:p-7"
              >
                <p className="text-[13px] font-medium tabular-nums tracking-[0.08em] text-brand-700">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-3 text-[19px] font-semibold leading-snug tracking-[-0.01em]">
                  {step.title}
                </h3>
                <p className="mt-2 text-[15px] leading-[1.55] text-gray-550">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="relative border-t border-black/[0.06]">
        <div
          className={`${PAGE_WIDTH_CLASS} flex flex-col gap-2 py-6 text-[14px] leading-5 text-gray-550 sm:flex-row sm:items-center sm:justify-between`}
        >
          <p>{content.footnote}</p>
          <a
            href={content.sourceCodeUrl}
            className="w-fit break-all font-medium text-gray-950 underline decoration-brand-500 decoration-2 underline-offset-4 hover:text-gray-550 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            {content.sourceCodeUrl.replace(/^https?:\/\//, "")}
          </a>
        </div>
      </footer>
    </div>
  );
}

const GitHubMark = () => {
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="size-6"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
};
