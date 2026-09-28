import { afterEach, beforeEach } from "node:test";

export type FetchCall = {
  url: string;
  method: string;
  headers: Record<string, string>;
  redirect: RequestRedirect | undefined;
  hasSignal: boolean;
};

type Handler = (call: FetchCall) => Response | Promise<Response>;

/**
 * Replace global fetch for the enclosing describe block. Tests never touch
 * the network: every URL they use is an IP literal or a blocked hostname, so
 * the SSRF guard does not need DNS either.
 */
export const useMockFetch = () => {
  const originalFetch = globalThis.fetch;
  const calls: FetchCall[] = [];
  let handler: Handler = () => new Response(null, { status: 500 });

  beforeEach(() => {
    calls.length = 0;
    globalThis.fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const call: FetchCall = {
        url: String(input),
        method: init?.method ?? "GET",
        headers: { ...(init?.headers as Record<string, string> | undefined) },
        redirect: init?.redirect,
        hasSignal: !!init?.signal,
      };
      calls.push(call);
      return handler(call);
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  return {
    calls,
    respondWith: (next: Handler) => {
      handler = next;
    },
  };
};

export const redirectTo = (location: string, status = 302) =>
  new Response(null, { status, headers: { location } });
