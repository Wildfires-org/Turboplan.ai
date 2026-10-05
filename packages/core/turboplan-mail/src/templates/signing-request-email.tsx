import { BaseLayout } from "./base-layout";
import {
  CtaButton,
  DetailItem,
  DetailsBox,
  DetailTitle,
  EmailHeading,
  FallbackUrl,
  Paragraph,
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
  return (
    <BaseLayout
      preview={`${requesterName} requested your signature on "${documentTitle}"`}
      label="Signature Request"
      footer={`This notification was sent to ${recipientEmail} because you are a member of the ${projectName} project.`}
    >
      <EmailHeading>
        {recipientName
          ? `${recipientName}, your signature is needed`
          : "Your signature is needed"}
      </EmailHeading>

      <Paragraph>
        <strong style={strong}>{requesterName}</strong> has requested your
        signature on a document in the{" "}
        <strong style={strong}>{projectName}</strong> project.
      </Paragraph>

      <DetailsBox>
        <DetailTitle>{documentTitle}</DetailTitle>
        <DetailItem label="Project">{projectName}</DetailItem>
      </DetailsBox>

      <CtaButton href={signingUrl} label="Sign Document" />

      <FallbackUrl url={signingUrl} />
    </BaseLayout>
  );
}

// Styles
const strong = {
  color: "#111827",
};
