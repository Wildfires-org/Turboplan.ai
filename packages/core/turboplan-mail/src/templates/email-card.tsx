import type { ReactNode } from "react";

import { Img, Section, Text } from "@react-email/components";

import { getBeaverUrl, getHandIconUrl } from "./email-images";

interface BrandCardProps {
  children: ReactNode;
}

/**
 * Solid brand-green card wrapper shared across all email templates.
 */
export const BrandCard = ({ children }: BrandCardProps) => {
  return <Section style={brandCard}>{children}</Section>;
};

interface GreetingPillProps {
  children: ReactNode;
}

/**
 * Small centered pill containing a hand icon and greeting text.
 * Uses a presentation table for email-safe centering.
 */
export const GreetingPill = ({ children }: GreetingPillProps) => {
  return (
    <table
      role="presentation"
      cellPadding="0"
      cellSpacing="0"
      align="center"
      style={pillTable}
    >
      <tr>
        <td style={pillTd}>
          <Img
            src={getHandIconUrl()}
            width="12"
            height="12"
            alt=""
            style={pillIcon}
          />
          <span style={pillText}>{children}</span>
        </td>
      </tr>
    </table>
  );
};

interface CtaButtonProps {
  href: string;
  label: string;
}

/**
 * White CTA button with green text and a trailing arrow, with the beaver
 * mascot beside it sitting flush on the card's bottom edge. Must be the last
 * element in the card. Uses a two-cell table instead of negative margins,
 * which Gmail and Outlook strip. The mascot is hidden on narrow screens.
 * Keeps the className="cta-link" + nested span pattern for dark-mode defense.
 */
export const CtaButton = ({ href, label }: CtaButtonProps) => {
  return (
    <table
      role="presentation"
      cellPadding="0"
      cellSpacing="0"
      width="100%"
      style={ctaTable}
    >
      <tr>
        <td style={ctaCell}>
          <table
            role="presentation"
            cellPadding="0"
            cellSpacing="0"
            width="100%"
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
        </td>
        <td width="107" className="card-mascot" style={mascotCell}>
          <Img
            src={getBeaverUrl()}
            width="107"
            height="109"
            alt="Beaver mascot"
            style={mascotImage}
          />
        </td>
      </tr>
    </table>
  );
};

interface DisclaimerProps {
  children: ReactNode;
}

/**
 * Muted disclaimer text shown below the card.
 */
export const Disclaimer = ({ children }: DisclaimerProps) => {
  return <Text style={disclaimer}>{children}</Text>;
};

interface FallbackUrlProps {
  url: string;
}

/**
 * "Trouble with the button" fallback label plus the raw URL box.
 */
export const FallbackUrl = ({ url }: FallbackUrlProps) => {
  return (
    <>
      <Text style={fallbackLabel}>
        If you're having trouble with the button, copy and paste this URL into
        your browser:
      </Text>
      <Section style={fallbackUrlBox}>
        <Text style={fallbackUrlText}>{url}</Text>
      </Section>
    </>
  );
};

// Styles
const brandCard = {
  backgroundColor: "#3ccf88",
  borderRadius: "12px",
  // No bottom padding so the mascot sits flush with the card's bottom edge
  padding: "42px 42px 0",
  textAlign: "center" as const,
  marginBottom: "30px",
  overflow: "hidden" as const,
};

const pillTable = {
  margin: "0 auto 18px",
};

const pillTd = {
  backgroundColor: "#dcfaee",
  background:
    "linear-gradient(252.28deg, rgba(220, 250, 238, 0.49) 43.66%, #dcfaee 100.16%)",
  borderRadius: "48px",
  padding: "6px 8px",
  textAlign: "center" as const,
  verticalAlign: "middle" as const,
};

const pillIcon = {
  display: "inline-block",
  verticalAlign: "middle" as const,
  marginRight: "6px",
};

const pillText = {
  fontSize: "12px",
  lineHeight: "16px",
  color: "#4b5563",
  letterSpacing: "0.4px",
  fontWeight: "400" as const,
  verticalAlign: "middle" as const,
};

const ctaTable = {
  width: "100%",
  margin: "0",
};

const ctaCell = {
  verticalAlign: "bottom" as const,
  paddingBottom: "28px",
};

const ctaButtonTd = {
  backgroundColor: "#ffffff",
  borderRadius: "6px",
  padding: "12px 32px",
  textAlign: "center" as const,
};

const ctaLink = {
  color: "#1b845c",
  fontSize: "14px",
  fontWeight: "600" as const,
  lineHeight: "20px",
  textDecoration: "none",
  display: "inline-block",
  width: "100%",
};

const ctaSpan = {
  color: "#1b845c",
  textDecoration: "none",
};

const ctaArrow = {
  marginLeft: "10px",
};

const mascotCell = {
  width: "107px",
  paddingLeft: "12px",
  verticalAlign: "bottom" as const,
  // Kill the baseline descender gap so the mascot touches the card edge
  fontSize: "0",
  lineHeight: "0",
};

const mascotImage = {
  display: "block",
};

const disclaimer = {
  fontSize: "12px",
  fontWeight: "500" as const,
  color: "#9ca3af",
  textAlign: "center" as const,
  lineHeight: "16px",
  letterSpacing: "0.24px",
  margin: "0 0 30px",
};

const fallbackLabel = {
  fontSize: "12px",
  fontWeight: "500" as const,
  color: "#262626",
  textAlign: "center" as const,
  lineHeight: "16px",
  letterSpacing: "0.24px",
  margin: "0 0 12px",
};

const fallbackUrlBox = {
  backgroundColor: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "6px",
  padding: "6px 0",
};

const fallbackUrlText = {
  fontSize: "12px",
  fontWeight: "500" as const,
  color: "#80bfff",
  textAlign: "center" as const,
  letterSpacing: "0.24px",
  lineHeight: "16px",
  margin: "0",
  wordBreak: "break-all" as const,
};
