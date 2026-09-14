import { headers } from "next/headers";

import { getWebEnv } from "@wildfires-org/turboplan-env";

import { LogoutRunner } from "./logout-runner";
import { isTrustedFetchSite, resolveRedirectTo } from "./redirect-guards";

type LogoutPageProps = {
  // Next delivers string[] when the query key is repeated
  // (/logout?callbackUrl=a&callbackUrl=b) — take the first value, don't crash.
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
};

const isTrustedNavigation = async (): Promise<boolean> =>
  isTrustedFetchSite((await headers()).get("sec-fetch-site"));

const LogoutPage = async ({ searchParams }: LogoutPageProps) => {
  const { callbackUrl: rawCallbackUrl } = await searchParams;
  const callbackUrl = Array.isArray(rawCallbackUrl)
    ? rawCallbackUrl[0]
    : rawCallbackUrl;

  return (
    <LogoutRunner
      redirectTo={resolveRedirectTo(callbackUrl, getWebEnv().LANDING_URL)}
      autoRun={await isTrustedNavigation()}
    />
  );
};

export default LogoutPage;
