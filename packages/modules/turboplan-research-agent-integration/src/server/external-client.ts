import {
  getApiEnv,
  getLocalTunnelUrl,
  getServerUrl,
} from "@wildfires-org/turboplan-env";

type AgentSkill = "project-bootstrapper" | "project-cataloger";

type AgentRunRequest = {
  prompt: string;
  skill: AgentSkill;
  projectId?: string;
  webhookSecret?: string;
};

type AgentRunResponse = {
  runId: string;
};

type AgentRunStatusResponse = {
  status: string;
  lastError?: string;
};

type ClientResult<T> = { data: T; error: null } | { data: null; error: string };

class ResearchAgentClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    const env = getApiEnv();
    this.baseUrl = env.RESEARCH_AGENT_SERVICE_URL;
    this.apiKey = env.RESEARCH_AGENT_SERVICE_API_KEY;
  }

  async startRun(
    params: AgentRunRequest,
  ): Promise<ClientResult<AgentRunResponse>> {
    const url = `${this.baseUrl}/api/agent/run`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
        },
        body: JSON.stringify({
          ...params,
          // Local tunnel only works on local environments when LOCAL_TUNNEL_URL is set
          targetApiUrl: getLocalTunnelUrl() || getServerUrl(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[ResearchAgentClient] Request failed: ${response.status} - ${errorText}`,
        );
        return { data: null, error: `HTTP ${response.status}: ${errorText}` };
      }

      const data = (await response.json()) as AgentRunResponse;
      return { data, error: null };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[ResearchAgentClient] Request error:`, error);
      return { data: null, error: errorMessage };
    }
  }

  async addContext(
    runId: string,
    context: string,
  ): Promise<ClientResult<{ success: boolean }>> {
    const url = `${this.baseUrl}/api/agent/run/${runId}/add-context`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
        },
        body: JSON.stringify({ context }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[ResearchAgentClient] addContext failed: ${response.status} - ${errorText}`,
        );
        return { data: null, error: `HTTP ${response.status}: ${errorText}` };
      }

      return { data: { success: true }, error: null };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[ResearchAgentClient] addContext error:`, error);
      return { data: null, error: errorMessage };
    }
  }

  async getRunStatus(
    runId: string,
  ): Promise<ClientResult<AgentRunStatusResponse>> {
    const url = `${this.baseUrl}/api/agent/run/${runId}`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "x-api-key": this.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[ResearchAgentClient] getRunStatus failed: ${response.status} - ${errorText}`,
        );
        return { data: null, error: `HTTP ${response.status}: ${errorText}` };
      }

      const data = (await response.json()) as AgentRunStatusResponse;
      return { data, error: null };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[ResearchAgentClient] getRunStatus error:`, error);
      return { data: null, error: errorMessage };
    }
  }
}

// Singleton
let clientInstance: ResearchAgentClient | null = null;

export const getResearchAgentClient = (): ResearchAgentClient => {
  if (!clientInstance) {
    clientInstance = new ResearchAgentClient();
  }
  return clientInstance;
};

export type {
  AgentRunRequest,
  AgentRunResponse,
  AgentRunStatusResponse,
  ClientResult,
};
