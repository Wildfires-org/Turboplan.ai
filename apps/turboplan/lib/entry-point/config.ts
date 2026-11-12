/**
 * What a signed-out visitor sees at `/`, chosen at build time by
 * `NEXT_PUBLIC_ENTRY_POINT`. `prompt` renders a prompt box there
 * (components/entry-point) that hands the visitor's project description to the
 * self-service signup; unset keeps the default, which sends signed-out
 * visitors at `/` to `/login`.
 *
 * Kept free of other imports: the Edge middleware reads it through
 * app/(auth)/auth.config.ts.
 */
export const entryPoint =
  process.env.NEXT_PUBLIC_ENTRY_POINT === "prompt" ? "prompt" : undefined;

export const isPromptEntryPoint = entryPoint === "prompt";
