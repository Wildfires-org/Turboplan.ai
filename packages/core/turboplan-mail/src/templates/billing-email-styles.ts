/**
 * Shared style constants for billing notification emails (payment failed,
 * usage alert, discount ending). React-email renders these inline, so a
 * single source keeps the three templates visually identical by construction.
 */

export const title = {
  fontSize: "36px",
  fontFamily: "'Geist Mono', monospace",
  color: "#1b845c",
  textAlign: "center" as const,
  letterSpacing: "-2.52px",
  padding: "18px 0",
  margin: "0",
  fontWeight: "500" as const,
};

export const card = {
  background: "linear-gradient(180deg, #f3c98b 0%, #e0913f 100%)",
  borderRadius: "12px",
  padding: "42px",
  textAlign: "center" as const,
  marginBottom: "30px",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  overflow: "hidden" as const,
};

export const mascotImage = {
  margin: "0 auto 24px",
  display: "block",
};

export const badgeTable = {
  width: "100%",
  margin: "0 0 24px",
};

export const badge = {
  display: "inline-block",
  backgroundColor: "#fff7ed",
  border: "1px solid #fed7aa",
  borderRadius: "9999px",
  padding: "4px 16px",
  fontSize: "14px",
  fontWeight: "600" as const,
  color: "#c2410c",
};

export const bodyText = {
  fontSize: "14px",
  lineHeight: "20px",
  color: "#ffffff",
  textAlign: "center" as const,
  margin: "0 0 16px",
};

export const bodyTextLight = {
  fontSize: "14px",
  lineHeight: "20px",
  color: "#ffffff",
  opacity: "0.8",
  textAlign: "center" as const,
  margin: "0 0 36px",
};

export const ctaTable = {
  width: "100%",
  margin: "0 0 36px",
};

export const ctaButtonTd = {
  backgroundColor: "#000000",
  borderRadius: "6px",
  padding: "12px 0",
  textAlign: "center" as const,
};

export const ctaLink = {
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "400" as const,
  textDecoration: "none",
  display: "inline-block",
  width: "100%",
};

export const signatureText = {
  fontSize: "14px",
  fontWeight: "600" as const,
  color: "#ffffff",
  textAlign: "center" as const,
  lineHeight: "22px",
  margin: "0",
};

export const disclaimer = {
  fontSize: "12px",
  fontWeight: "500" as const,
  color: "#9ca3af",
  textAlign: "center" as const,
  lineHeight: "16px",
  letterSpacing: "0.24px",
  margin: "0 0 30px",
};

export const fallbackLabel = {
  fontSize: "12px",
  fontWeight: "500" as const,
  color: "#262626",
  textAlign: "center" as const,
  lineHeight: "16px",
  letterSpacing: "0.24px",
  margin: "0 0 8px",
};

export const fallbackUrlBox = {
  backgroundColor: "#f5f5f5",
  borderRadius: "6px",
  padding: "12px 16px",
};

export const fallbackUrl = {
  fontSize: "12px",
  color: "#525252",
  textAlign: "center" as const,
  margin: "0",
  wordBreak: "break-all" as const,
};
