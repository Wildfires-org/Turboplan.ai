import type { ResearchAgentEnvType } from "@wildfires-org/turboplan-env";

export interface ResearchAgentVariables {
  env: ResearchAgentEnvType;
}

export interface ResearchAgentContext {
  Variables: ResearchAgentVariables;
}
