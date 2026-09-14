import { jwtVerify, SignJWT } from "jose";

const getSecret = () => {
  const secret = process.env.JWT_SIGNING_SECRET;
  if (!secret) {
    throw new Error("JWT_SIGNING_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
};

/**
 * Token purpose/scope for security isolation
 * - "general": Standard API token for all authenticated endpoints
 * - "upload": Short-lived token specifically for file uploads (query param safe)
 */
export type TokenPurpose = "general" | "upload";

export interface TokenPayload {
  id: string;
  /**
   * Optional user role from the profile, included so Hono routes can branch on
   * role without an extra DB lookup. Tokens issued without it (e.g. e2e tests)
   * still verify; consumers should fall back to a profile lookup when absent.
   */
  userRole?: string;
  purpose?: TokenPurpose;
  iat?: number;
  exp?: number;
}

export async function createToken(
  payload: Omit<TokenPayload, "iat" | "exp" | "purpose">,
): Promise<string> {
  const secret = getSecret();

  return await new SignJWT({ ...payload, purpose: "general" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    // Server API token lives for 15min, but apiClient has refresh token logic implemented
    .setExpirationTime("15m")
    .sign(secret);
}

/**
 * Create a short-lived upload token for file uploads
 *
 * This token has a limited scope and short expiry (5 minutes) for security:
 * - Can only be used for upload endpoints
 * - Safe to pass via query parameter (reduced exposure window)
 * - Cannot be used for other API operations
 */
export async function createUploadToken(
  payload: Omit<TokenPayload, "iat" | "exp" | "purpose">,
): Promise<string> {
  const secret = getSecret();

  return await new SignJWT({ ...payload, purpose: "upload" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m") // Short-lived for security
    .sign(secret);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  const secret = getSecret();
  try {
    const { payload } = await jwtVerify(token, secret);

    // Validate that the payload has the required properties
    if (typeof payload.id === "string") {
      return {
        id: payload.id,
        userRole:
          typeof payload.userRole === "string" ? payload.userRole : undefined,
        purpose: payload.purpose as TokenPurpose | undefined,
        iat: payload.iat,
        exp: payload.exp,
      };
    }

    console.error("Invalid token payload: missing id or email");
    return null;
  } catch (error) {
    console.error("JWT verification failed:", error);
    return null;
  }
}

export function extractTokenFromHeader(
  authHeader: string | undefined,
): string | null {
  if (!authHeader) return null;

  if (authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  return null;
}
