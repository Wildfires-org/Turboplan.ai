import { assertPublicTarget } from "../http/utils/resolve-guard";

type RequestInput = {
  url: string;
  webhookSecret: string;
  body: unknown;
};

type ProgressInput = {
  targetApiUrl: string;
  webhookSecret: string;
  runId: string;
  message: string;
};

export type TargetApiClient = {
  request: (input: RequestInput) => Promise<Response>;
  sendProgress: (input: ProgressInput) => Promise<void>;
};

// Callbacks authenticate with the per-run webhook secret only. No shared
// server credential is sent, so a caller-controlled targetApiUrl cannot be used
// to exfiltrate anything the caller does not already possess.
export const createTargetApiClient = (): TargetApiClient => {
  const request = async (input: RequestInput): Promise<Response> => {
    // Re-check at fetch time, not just at validation time: a run can outlive
    // the DNS answer that was checked when it started, so a long-lived run's
    // callback host could be re-pointed at private space in between. Still a
    // check rather than a pin — see the TOCTOU note in http/utils/resolve-guard.
    const guardError = await assertPublicTarget(input.url);
    if (guardError) {
      throw new Error(`Request to ${input.url} blocked: ${guardError}`);
    }

    const res = await fetch(input.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": input.webhookSecret,
      },
      body: JSON.stringify(input.body),
      // Never follow a redirect: fetch would re-send the secret header to a
      // target that assertPublicTarget never checked.
      redirect: "error",
    });
    if (!res.ok) {
      throw new Error(
        `Request to ${input.url} failed: ${res.status} ${res.statusText}`,
      );
    }
    return res;
  };

  const sendProgress = async (input: ProgressInput): Promise<void> => {
    const url = `${input.targetApiUrl}/bootstrapper/project/progress`;
    await request({
      url,
      webhookSecret: input.webhookSecret,
      body: { runId: input.runId, message: input.message },
    });
  };

  return { request, sendProgress };
};
