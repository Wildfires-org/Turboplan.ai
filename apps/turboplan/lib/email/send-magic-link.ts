import { getWebEnv } from "@wildfires-org/turboplan-env";

export interface SendMagicLinkEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send magic link email via the API server
 * This calls the internal email endpoint on the Hono server
 * Protected by INTERNAL_API_SECRET header validation
 */
export async function sendMagicLinkEmail(options: {
  to: string;
  magicLinkUrl: string;
  type: "verification" | "login";
}): Promise<SendMagicLinkEmailResult> {
  const ENV = getWebEnv();

  try {
    const response = await fetch(`${ENV.SERVER_URL}/internal/auth/magic-link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": ENV.INTERNAL_API_SECRET,
      },
      body: JSON.stringify(options),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("[Email] Failed to call email API:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}
