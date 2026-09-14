// Utility for making authenticated API calls to the Hono server

import { getServerUrl } from "@wildfires-org/turboplan-env";

interface ApiClientConfig {
  baseUrl?: string;
}

/**
 * Result of an {@link ApiClient} request. `code` and `status` expose the
 * machine-readable error code and HTTP status from a non-OK JSON response so
 * callers can branch on a specific failure (e.g. `code === "UPGRADE_REQUIRED"`)
 * rather than string-matching the human-readable `error` message.
 */
export interface ApiClientResult<T> {
  data: T | null;
  error: string | null;
  code: string | null;
  status: number | null;
}

export class ApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private tokenRefreshPromise: Promise<string | null> | null = null;

  constructor(config?: ApiClientConfig) {
    this.baseUrl = config?.baseUrl || "";
  }

  private getBaseUrl(): string {
    const SERVER_URL = getServerUrl();

    if (!this.baseUrl && !SERVER_URL) {
      throw new Error("Missing API client base URL");
    }

    return this.baseUrl || SERVER_URL;
  }

  private getServerUrl(): string {
    const SERVER_URL = getServerUrl();

    if (!SERVER_URL) {
      throw new Error("Missing SERVER_URL environment variable");
    }

    return SERVER_URL;
  }

  async getToken(): Promise<string | null> {
    // Return valid token, otherwise clear any expired token
    if (this.token && this.isTokenValid(this.token)) {
      return this.token;
    } else if (this.token) {
      console.log("Token expired, refreshing...");
      this.token = null;
    }

    // If a refresh is already in progress, wait for it
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    // Start a new token refresh
    this.tokenRefreshPromise = this.refreshToken();

    try {
      const token = await this.tokenRefreshPromise;
      return token;
    } finally {
      // Clear the promise when done (success or failure)
      this.tokenRefreshPromise = null;
    }
  }

  private isTokenValid(token: string): boolean {
    try {
      // Decode token to check expiration
      // We use a simple decode here just to check exp claim
      // The actual validation happens server-side
      const parts = token.split(".");
      if (parts.length !== 3) return false;

      const payload = JSON.parse(atob(parts[1]));
      if (!payload.exp) return true; // No expiration, consider valid

      // Check if token expires in the next 30 seconds (buffer time)
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = payload.exp;
      const bufferTime = 30; // 30 seconds buffer

      return expiresAt > now + bufferTime;
    } catch (error) {
      console.error("Error checking token validity:", error);
      return false;
    }
  }

  private async refreshToken(): Promise<string | null> {
    try {
      const response = await fetch(`${this.getServerUrl()}/api/auth/token`, {
        method: "GET",
        credentials: "include", // Required: sends cookies cross-origin
      });

      if (!response.ok) {
        throw new Error("Failed to get token");
      }

      const data = await response.json();
      this.token = data.token;
      return this.token;
    } catch (error) {
      console.error("Token fetch error:", error);
      this.token = null;
      return null;
    }
  }

  async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {},
    isRetry = false,
  ): Promise<ApiClientResult<T>> {
    try {
      const token = await this.getToken();

      if (!token) {
        return {
          data: null,
          error: "Authentication required",
          code: null,
          status: null,
        };
      }

      const url = `${this.getBaseUrl()}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      // Handle 401 responses by trying to refresh token once
      if (response.status === 401 && !isRetry) {
        console.log("Token expired, attempting to refresh...");

        // Clear current token and try to get a new one
        this.token = null;
        const newToken = await this.getToken();

        if (newToken) {
          // Retry the request with new token
          return this.request<T>(endpoint, options, true);
        } else {
          return {
            data: null,
            error: "Failed to refresh authentication token",
            code: null,
            status: 401,
          };
        }
      }

      if (!response.ok) {
        const errorText = await response.text();

        // Try to parse as JSON and extract error message + machine-readable code
        let errorMessage: string;
        let errorCode: string | null = null;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || errorText;
          errorCode =
            typeof errorJson.code === "string" ? errorJson.code : null;
        } catch {
          // Not JSON, use raw text but make it user-friendly
          errorMessage =
            response.status >= 500
              ? "Something went wrong. Please try again later."
              : errorText || "Request failed";
        }

        return {
          data: null,
          error: errorMessage,
          code: errorCode,
          status: response.status,
        };
      }

      const data = await response.json();
      return { data, error: null, code: null, status: response.status };
    } catch (error) {
      console.error("API request error:", error);
      return {
        data: null,
        error: error instanceof Error ? error.message : "Unknown error",
        code: null,
        status: null,
      };
    }
  }

  async get<T = unknown>(endpoint: string): Promise<ApiClientResult<T>> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  async post<T = unknown>(
    endpoint: string,
    body?: unknown,
  ): Promise<ApiClientResult<T>> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T = unknown>(
    endpoint: string,
    body?: unknown,
  ): Promise<ApiClientResult<T>> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T = unknown>(
    endpoint: string,
    body?: unknown,
  ): Promise<ApiClientResult<T>> {
    return this.request<T>(endpoint, {
      method: "DELETE",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T = unknown>(
    endpoint: string,
    body?: unknown,
  ): Promise<ApiClientResult<T>> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  // Clear token (for logout)
  clearToken(): void {
    this.token = null;
  }
}
