import { Text } from "@react-email/components";

import { getAppName } from "@wildfires-org/turboplan-env";

import { BaseLayout, preventAutoLink } from "./base-layout";
import {
  CardMascot,
  CtaButton,
  Disclaimer,
  FallbackUrl,
  GradientCard,
  GreetingPill,
} from "./email-card";

export type MagicLinkType = "verification" | "login";

export interface MagicLinkEmailProps {
  /** The magic link URL */
  magicLinkUrl: string;
  /** Type of magic link: 'verification' for new users, 'login' for returning users */
  type: MagicLinkType;
}

const getContent = (appName: string) =>
  ({
    verification: {
      preview: `Verify your email to get started with ${appName}`,
      label: "Verify Email",
      greeting: "Welcome!",
      body: `Thanks for signing up for ${appName}! Click the button below to verify your email address and get started.`,
      buttonText: "Verify Email",
      expiry: "This link will expire in 15 minutes.",
    },
    login: {
      preview: `Sign in to ${appName}`,
      label: "Sign In",
      greeting: "Welcome back!",
      body: "You requested a sign-in link. Click the button below to sign in to your account.",
      buttonText: "Sign In",
      expiry: "This link will expire in 15 minutes.",
    },
  }) as const;

/**
 * Magic link email for authentication (verification or login)
 */
export function MagicLinkEmail({ magicLinkUrl, type }: MagicLinkEmailProps) {
  const appName = getAppName();
  const safeAppName = preventAutoLink(appName);
  const content = getContent(safeAppName)[type];

  return (
    <BaseLayout preview={content.preview} label={content.label}>
      <GradientCard>
        <GreetingPill>{content.greeting}</GreetingPill>

        <Text style={bodyText}>{content.body}</Text>

        <CtaButton href={magicLinkUrl} label={content.buttonText} />

        <CardMascot />

        <Text style={expiryText}>{content.expiry}</Text>
      </GradientCard>

      <Disclaimer>
        If you didn't request this email, you can safely ignore it.
      </Disclaimer>

      <FallbackUrl url={magicLinkUrl} />
    </BaseLayout>
  );
}

// Styles
const bodyText = {
  fontSize: "14px",
  lineHeight: "20px",
  color: "rgba(255, 255, 255, 0.8)",
  textAlign: "center" as const,
  margin: "0 0 36px",
};

const expiryText = {
  fontSize: "12px",
  color: "rgba(255, 255, 255, 0.7)",
  textAlign: "center" as const,
  lineHeight: "16px",
  margin: "12px 0 36px",
};
