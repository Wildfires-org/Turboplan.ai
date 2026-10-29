import type { ReactNode } from "react";

import { Heading, Hr, Section, Text } from "@react-email/components";

interface ChildrenProps {
  children: ReactNode;
}

/**
 * Main heading of the card, right below the eyebrow label.
 */
export const EmailHeading = ({ children }: ChildrenProps) => {
  return (
    <Heading as="h1" style={heading} className="email-heading">
      {children}
    </Heading>
  );
};

interface ParagraphProps extends ChildrenProps {
  /** Smaller, lighter text for secondary notes (e.g. link expiry) */
  muted?: boolean;
}

export const Paragraph = ({ children, muted = false }: ParagraphProps) => {
  return <Text style={muted ? mutedText : bodyText}>{children}</Text>;
};

/**
 * Left-aligned inset box for the details of a task, document or assignment.
 */
export const DetailsBox = ({ children }: ChildrenProps) => {
  return <Section style={detailsBox}>{children}</Section>;
};

export const DetailTitle = ({ children }: ChildrenProps) => {
  return <Text style={detailTitle}>{children}</Text>;
};

interface DetailItemProps {
  label: string;
  children: ReactNode;
}

export const DetailItem = ({ label, children }: DetailItemProps) => {
  return (
    <Text style={detailItem}>
      <span style={detailLabel}>{label}</span>
      {children}
    </Text>
  );
};

interface CtaButtonProps {
  href: string;
  label: string;
}

/**
 * Filled brand-green CTA matching the app's `btn-primary`. The gradient is a
 * progressive enhancement over the solid background color (Outlook).
 * Keeps the className="cta-link" + nested span pattern for dark-mode defense.
 */
export const CtaButton = ({ href, label }: CtaButtonProps) => {
  return (
    <table
      role="presentation"
      cellPadding="0"
      cellSpacing="0"
      align="center"
      style={ctaTable}
    >
      <tr>
        <td align="center" style={ctaButtonTd}>
          <a href={href} style={ctaLink} className="cta-link">
            <span style={ctaSpan} className="cta-link">
              {label}
              <span style={ctaArrow}>&rarr;</span>
            </span>
          </a>
        </td>
      </tr>
    </table>
  );
};

interface FallbackUrlProps {
  url: string;
}

/**
 * Divider plus the raw URL for when the button doesn't work.
 * Must be the last element in the card.
 */
export const FallbackUrl = ({ url }: FallbackUrlProps) => {
  return (
    <>
      <Hr style={divider} />
      <Text style={fallbackLabel}>
        Button not working? Paste this link into your browser:
      </Text>
      <Text style={fallbackUrlText}>
        <a href={url} style={fallbackLink}>
          {url}
        </a>
      </Text>
    </>
  );
};

// Styles
const heading = {
  fontSize: "28px",
  lineHeight: "36px",
  fontWeight: "600" as const,
  letterSpacing: "-0.02em",
  color: "#111827",
  textAlign: "center" as const,
  margin: "0 0 16px",
};

const bodyText = {
  fontSize: "15px",
  lineHeight: "24px",
  color: "#4b5563",
  textAlign: "center" as const,
  margin: "0 0 16px",
};

const mutedText = {
  fontSize: "13px",
  lineHeight: "20px",
  color: "#9ca3af",
  textAlign: "center" as const,
  margin: "0 0 16px",
};

const detailsBox = {
  backgroundColor: "#f7f9f8",
  border: "1px solid #e8eeea",
  borderRadius: "12px",
  padding: "16px 20px",
  margin: "8px 0 24px",
  textAlign: "left" as const,
};

const detailTitle = {
  fontSize: "16px",
  lineHeight: "24px",
  fontWeight: "600" as const,
  color: "#111827",
  margin: "0",
};

const detailItem = {
  fontSize: "14px",
  lineHeight: "20px",
  color: "#374151",
  margin: "8px 0 0",
};

const detailLabel = {
  color: "#6b7280",
  marginRight: "6px",
};

const ctaTable = {
  margin: "28px auto 8px",
};

const ctaButtonTd = {
  backgroundColor: "#1b845c",
  backgroundImage:
    "linear-gradient(135deg, #1d8a60 0%, #156647 65%, #0f4832 100%)",
  borderRadius: "10px",
  boxShadow: "0 6px 16px -8px rgba(15, 72, 50, 0.45)",
};

const ctaLink = {
  display: "inline-block",
  padding: "14px 32px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "600" as const,
  lineHeight: "20px",
  textDecoration: "none",
};

const ctaSpan = {
  color: "#ffffff",
  textDecoration: "none",
};

const ctaArrow = {
  marginLeft: "8px",
};

const divider = {
  borderColor: "#eef1ef",
  borderTopWidth: "1px",
  margin: "28px 0 20px",
};

const fallbackLabel = {
  fontSize: "12px",
  lineHeight: "18px",
  color: "#6b7280",
  textAlign: "center" as const,
  margin: "0 0 4px",
};

const fallbackUrlText = {
  fontSize: "12px",
  lineHeight: "18px",
  textAlign: "center" as const,
  margin: "0",
  wordBreak: "break-all" as const,
};

const fallbackLink = {
  color: "#1b845c",
  textDecoration: "underline",
};
