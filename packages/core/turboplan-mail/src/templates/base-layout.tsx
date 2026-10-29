import type { ReactNode } from "react";

import {
  Body,
  Container,
  Font,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import { getAppName } from "@wildfires-org/turboplan-env";

import { getBeaverUrl, getLogoUrl } from "./email-images";

/**
 * Insert zero-width non-joiners around dots in domain-like text
 * to prevent email clients from auto-linking them.
 */
export function preventAutoLink(text: string): string {
  return text.replace(/\./g, "‌.‌");
}

export type EmailTone = "brand" | "warning" | "danger";

interface BaseLayoutProps {
  /** Preview text shown in email clients */
  preview: string;
  /** Eyebrow label above the heading (e.g., "Workspace Invitation") */
  label: string;
  /** Colors the hero band and eyebrow, e.g. "warning" for billing alerts */
  tone?: EmailTone;
  /** Muted note below the card (why the recipient got this email) */
  footer?: ReactNode;
  /** Main content of the card */
  children: ReactNode;
}

const TONES = {
  brand: { hero: "#e6f4ec", eyebrowBg: "#e6f4ec", eyebrowText: "#156647" },
  warning: { hero: "#fdf0dc", eyebrowBg: "#fdf0dc", eyebrowText: "#a5560f" },
  danger: { hero: "#f3f5f4", eyebrowBg: "#fdecec", eyebrowText: "#b42318" },
} as const;

/**
 * Base layout for all emails: logo header, a white card opening with a
 * tinted hero band where the beaver mascot sits on the edge, an eyebrow
 * label, the content, and a muted footer below the card.
 */
export function BaseLayout({
  preview,
  label,
  tone = "brand",
  footer,
  children,
}: BaseLayoutProps) {
  const appName = getAppName();
  const colors = TONES[tone];

  return (
    <Html>
      <Head>
        {/*
         * Each <Font> emits a global `* { font-family: ... }` rule, so the
         * Inter fonts must come last to win as the document default.
         * Geist Mono is only used by elements that set it explicitly.
         */}
        <Font
          fontFamily="Geist Mono"
          fallbackFontFamily="monospace"
          webFont={{
            url: "https://fonts.gstatic.com/s/geistmono/v6/or3yQ6H-1_WfwkMZI_qYPLs1a-t7PU0AbeHjL65U5Cl4PuCTfNg.woff2",
            format: "woff2",
          }}
          fontWeight={600}
          fontStyle="normal"
        />
        <Font
          fontFamily="Inter"
          fallbackFontFamily="Helvetica"
          webFont={{
            url: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
        <Font
          fontFamily="Inter"
          fallbackFontFamily="Helvetica"
          webFont={{
            url: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYAZ9hiJ-Ek-_EeA.woff2",
            format: "woff2",
          }}
          fontWeight={500}
          fontStyle="normal"
        />
        <Font
          fontFamily="Inter"
          fallbackFontFamily="Helvetica"
          webFont={{
            url: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fAZ9hiJ-Ek-_EeA.woff2",
            format: "woff2",
          }}
          fontWeight={600}
          fontStyle="normal"
        />

        {/* Opt out of dark mode color transformations */}
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light only" />

        {/* Prevent email clients from auto-linking domain names */}
        <meta
          name="format-detection"
          content="telephone=no, date=no, email=no, address=no"
        />
        <style>{`
          :root { color-scheme: light only; }
          a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
          @media (prefers-color-scheme: dark) {
            .cta-link { color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }
          }
          [data-ogsc] .cta-link { color: #ffffff !important; -webkit-text-fill-color: #ffffff !important; }
          @media (max-width: 480px) {
            .email-content { padding: 32px 24px 28px !important; }
            .email-heading { font-size: 24px !important; line-height: 32px !important; }
          }
        `}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            {/*
             * The alt is the only place the product name appears verbatim:
             * the visible text runs through preventAutoLink, which puts
             * zero-width characters around the dot. Keep it, so blocked
             * images still show the brand and filters can read it.
             */}
            <Img
              src={getLogoUrl()}
              width="28"
              height="28"
              alt={appName}
              style={logoImage}
            />
            <span style={appNameText}>{preventAutoLink(appName)}</span>
          </Section>

          <Section style={card}>
            <Section style={{ ...hero, backgroundColor: colors.hero }}>
              <Img
                src={getBeaverUrl()}
                width="96"
                height="98"
                alt=""
                style={heroImage}
              />
            </Section>

            <Section style={content} className="email-content">
              <table
                role="presentation"
                cellPadding="0"
                cellSpacing="0"
                align="center"
                style={eyebrowTable}
              >
                <tr>
                  <td
                    style={{
                      ...eyebrow,
                      backgroundColor: colors.eyebrowBg,
                      color: colors.eyebrowText,
                    }}
                  >
                    {label}
                  </td>
                </tr>
              </table>

              {children}
            </Section>
          </Section>

          {footer && <Text style={footerNote}>{footer}</Text>}
          <Text style={footerBrand}>{preventAutoLink(appName)}</Text>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const main = {
  backgroundColor: "#f2f5f3",
  fontFamily: "Inter, Helvetica, Arial, sans-serif",
  padding: "40px 12px",
  margin: "0",
};

const container = {
  margin: "0 auto",
  maxWidth: "560px",
};

const header = {
  textAlign: "center" as const,
  padding: "0 0 24px",
};

const logoImage = {
  display: "inline-block",
  verticalAlign: "middle",
  marginRight: "8px",
};

const appNameText = {
  fontFamily: "'Geist Mono', monospace",
  fontSize: "20px",
  fontWeight: "600" as const,
  color: "#111827",
  letterSpacing: "-1px",
  verticalAlign: "middle",
};

const card = {
  backgroundColor: "#ffffff",
  borderRadius: "16px",
  border: "1px solid #e3e9e5",
  boxShadow:
    "0 1px 2px rgba(16, 24, 20, 0.04), 0 8px 24px rgba(16, 24, 20, 0.06)",
  overflow: "hidden" as const,
};

const hero = {
  textAlign: "center" as const,
  // No bottom padding so the mascot sits flush on the band's bottom edge
  padding: "28px 0 0",
  fontSize: "0",
  lineHeight: "0",
  borderRadius: "16px 16px 0 0",
};

const heroImage = {
  display: "block",
  margin: "0 auto",
};

const content = {
  padding: "36px 44px 32px",
  textAlign: "center" as const,
};

const eyebrowTable = {
  margin: "0 auto 16px",
};

const eyebrow = {
  borderRadius: "999px",
  padding: "4px 12px",
  fontSize: "11px",
  lineHeight: "16px",
  fontWeight: "600" as const,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
};

const footerNote = {
  fontSize: "12px",
  lineHeight: "18px",
  color: "#6b7280",
  textAlign: "center" as const,
  margin: "24px 24px 8px",
};

const footerBrand = {
  fontSize: "12px",
  lineHeight: "18px",
  color: "#9ca3af",
  textAlign: "center" as const,
  margin: "0 0 8px",
};
