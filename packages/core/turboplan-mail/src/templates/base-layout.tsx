import type { ReactNode } from "react";

import {
  Body,
  Column,
  Container,
  Font,
  Head,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";

import { getAppName } from "@wildfires-org/turboplan-env";

import { getLogoUrl } from "./email-images";

/**
 * Insert zero-width non-joiners around dots in domain-like text
 * to prevent email clients from auto-linking them.
 */
export function preventAutoLink(text: string): string {
  return text.replace(/\./g, "\u200C.\u200C");
}

interface BaseLayoutProps {
  /** Preview text shown in email clients */
  preview: string;
  /** Label shown in the top-right corner (e.g., "Workspace Invitation") */
  label: string;
  /** Main content of the email */
  children: ReactNode;
}

/**
 * Base layout for all emails.
 * Provides consistent card-style layout with logo header and label.
 */
export function BaseLayout({ preview, label, children }: BaseLayoutProps) {
  const appName = getAppName();

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
            .cta-link { color: #1b845c !important; -webkit-text-fill-color: #1b845c !important; }
          }
          [data-ogsc] .cta-link { color: #1b845c !important; -webkit-text-fill-color: #1b845c !important; }
        `}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={card}>
          {/* Header Row: Logo + Label */}
          <Section style={headerSection}>
            <Row>
              <Column style={logoColumn}>
                <Img
                  src={getLogoUrl()}
                  width="32"
                  height="32"
                  alt={`${appName} logo`}
                  style={logoImage}
                />
                <span style={appNameText}>{preventAutoLink(appName)}</span>
              </Column>
              <Column style={labelColumn}>
                <Text style={labelText}>{label}</Text>
              </Column>
            </Row>
          </Section>

          {/* Content */}
          {children}
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const main = {
  backgroundColor: "#D1E6DE",
  fontFamily: "Inter, Helvetica, Arial, sans-serif",
  padding: "40px 0",
};

const card = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "30px",
  maxWidth: "595px",
  borderRadius: "12px",
  border: "1px solid #e5e7eb",
};

const headerSection = {
  marginBottom: "30px",
};

const logoColumn = {
  verticalAlign: "middle" as const,
};

const logoImage = {
  display: "inline-block",
  verticalAlign: "middle",
  marginRight: "10px",
};

const appNameText = {
  fontFamily: "'Geist Mono', monospace",
  fontSize: "22px",
  fontWeight: "600" as const,
  color: "#1f2937",
  letterSpacing: "-1.5px",
  verticalAlign: "middle",
};

const labelColumn = {
  textAlign: "right" as const,
  verticalAlign: "middle" as const,
};

const labelText = {
  fontSize: "18px",
  fontWeight: "500" as const,
  color: "#1b845c",
  margin: "0",
};
