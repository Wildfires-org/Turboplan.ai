import { Section, Text } from "@react-email/components";

import { BaseLayout } from "./base-layout";
import {
  CardMascot,
  CtaButton,
  Disclaimer,
  FallbackUrl,
  GradientCard,
  GreetingPill,
} from "./email-card";

export interface SigningRequestEmailProps {
  recipientEmail: string;
  recipientName?: string;
  requesterName: string;
  documentTitle: string;
  projectName: string;
  signingUrl: string;
}

export function SigningRequestEmail({
  recipientEmail,
  recipientName,
  requesterName,
  documentTitle,
  projectName,
  signingUrl,
}: SigningRequestEmailProps) {
  const greeting = recipientName ? `Hello, ${recipientName}!` : "Hello!";

  return (
    <BaseLayout
      preview={`${requesterName} requested your signature on "${documentTitle}"`}
      label="Signature Request"
    >
      <GradientCard>
        <GreetingPill>{greeting}</GreetingPill>

        <Text style={bodyText}>
          <strong>{requesterName}</strong>
          <span style={bodyTextLight}>
            {" "}
            has requested your signature on a document in the{" "}
          </span>
          <strong>{projectName}</strong>
          <span style={bodyTextLight}> project.</span>
        </Text>

        <Section style={detailsBox}>
          <Text style={documentTitleStyle}>&#9998; {documentTitle}</Text>
          <Text style={detailItem}>Project: {projectName}</Text>
        </Section>

        <CtaButton href={signingUrl} label="Sign Document" />

        <CardMascot />
      </GradientCard>

      <Disclaimer>
        This notification was sent to {recipientEmail} because you are a member
        of the {projectName} project.
      </Disclaimer>

      <FallbackUrl url={signingUrl} />
    </BaseLayout>
  );
}

// Styles
const bodyText = {
  fontSize: "14px",
  lineHeight: "20px",
  color: "#ffffff",
  textAlign: "center" as const,
  margin: "0 0 24px",
};

const bodyTextLight = {
  color: "rgba(255, 255, 255, 0.8)",
};

const detailsBox = {
  backgroundColor: "rgba(255, 255, 255, 0.15)",
  borderRadius: "8px",
  padding: "16px",
  margin: "0 0 36px",
  textAlign: "left" as const,
};

const documentTitleStyle = {
  fontSize: "16px",
  fontWeight: "600" as const,
  lineHeight: "24px",
  color: "#ffffff",
  margin: "0 0 6px",
};

const detailItem = {
  fontSize: "13px",
  lineHeight: "20px",
  color: "rgba(255, 255, 255, 0.9)",
  margin: "0",
};
