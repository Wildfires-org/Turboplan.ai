"use client";

import { useState } from "react";

import { ApiClient } from "./api-client";

const apiClient = new ApiClient();

interface ApiResponse {
  message: string;
  user?: {
    id: string;
  };
  userId?: string;
  timestamp?: string;
}

export function AuthDemo() {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string>("");

  const testApiCall = async (endpoint: string) => {
    setLoading(true);
    setResponse("");

    try {
      const { data, error } = await apiClient.get<ApiResponse>(endpoint);

      if (error) {
        setResponse(`❌ Error: ${error}`);
      } else if (data) {
        setResponse(`✅ Success: ${JSON.stringify(data, null, 2)}`);
      }
    } catch (err) {
      setResponse(
        `❌ Exception: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border rounded-lg p-6 space-y-4">
      <h3 className="text-lg font-semibold">🔐 Authentication Demo</h3>
      <p className="text-sm text-gray-600">
        Test authenticated API calls to the Hono server
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            testApiCall("http://localhost:3001/api/protected-api-demo-endpoint")
          }
          disabled={loading}
          style={{ border: "1px solid green" }}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Test `/api/protected-api-demo-endpoint`"}
        </button>
      </div>

      {response && (
        <div className="mt-4">
          <h4 className="text-sm font-medium mb-2">Response:</h4>
          <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto">
            {response}
          </pre>
        </div>
      )}
    </div>
  );
}
