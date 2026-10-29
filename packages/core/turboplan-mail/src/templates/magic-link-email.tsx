import { getAppName } from "@wildfires-org/turboplan-env";

import { BaseLayout, preventAutoLink } from "./base-layout";
import { CtaButton, EmailHeading, FallbackUrl, Paragraph } from "./email-card";

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
      heading: `Welcome to ${appName}`,
      body: "Thanks for signing up! Confirm your email address to finish setting up your account.",
      buttonText: "Verify Email",
      expiry: "This link expires in 15 minutes.",
    },
    login: {
      preview: `Sign in to ${appName}`,
      label: "Sign In",
      heading: "Welcome back",
      body: "You requested a sign-in link. Use the button below to sign in to your account.",
      buttonText: "Sign In",
      expiry: "This link expires in 15 minutes.",
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
    <BaseLayout
      preview={content.preview}
      label={content.label}
      footer="If you didn't request this email, you can safely ignore it."
    >
      <EmailHeading>{content.heading}</EmailHeading>
      <Paragraph>{content.body}</Paragraph>

      <CtaButton href={magicLinkUrl} label={content.buttonText} />
      <Paragraph muted>{content.expiry}</Paragraph>

      <FallbackUrl url={magicLinkUrl} />
    </BaseLayout>
  );
}
