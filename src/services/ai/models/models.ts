export type TaskType =
  | "COMPANY_CLASSIFICATION"
  | "RECOMMENDATION_REASONING"
  | "EMAIL_GENERATION"
  | "EMAIL_REFINEMENT"
  | "SUMMARY_GENERATION"
  | "PROJECT_RELEVANCE"
  | "COMPANY_FIT_ANALYSIS"
  | "RECOMMENDATION_SCORING"
  | "CONVERSATION_SUMMARY"
  | "EMBEDDINGS"
  | "COMPANY_CONTEXT_INTELLIGENCE"
  | "COMPANY_CONTEXT_RELEVANCE"
  | "RELATIONSHIP_INTELLIGENCE"
  | "PROFILE_ENRICHMENT_INTELLIGENCE"
  | "STAKEHOLDER_STRATEGY"
  | "COMPANY_STAKEHOLDER_STRATEGY"
  | "EVENTS_INTELLIGENCE";

export type ProviderType = "gemini" | "cerebras";

export type TaskConfig = {
  provider: ProviderType;
  models: string[];
};

export const PROVIDERS = [
  { value: "gemini", label: "Gemini" },
  { value: "cerebras", label: "Cerebras" },
] as const;

export const PROVIDER_MODELS: Record<ProviderType, string[]> = {
  gemini: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
  cerebras: ["gpt-oss-120b", "zai-glm-4.7"],
};

export const TASK_MODEL_CONFIG: Record<TaskType, TaskConfig> = {
  COMPANY_CLASSIFICATION: {
    provider: "cerebras",
    models: ["gpt-oss-120b", "zai-glm-4.7"],
  },
  RECOMMENDATION_REASONING: {
    provider: "cerebras",
    models: ["gpt-oss-120b", "zai-glm-4.7"],
  },
  EMAIL_GENERATION: {
    provider: "gemini",
    models: ["gemini-2.5-flash", "gemini-2.0-flash"],
  },
  EMAIL_REFINEMENT: {
    provider: "gemini",
    models: ["gemini-2.5-flash", "gemini-2.0-flash"],
  },
  SUMMARY_GENERATION: {
    provider: "cerebras",
    models: ["gpt-oss-120b", "zai-glm-4.7"],
  },
  PROJECT_RELEVANCE: {
    provider: "cerebras",
    models: ["gpt-oss-120b", "zai-glm-4.7"],
  },
  COMPANY_FIT_ANALYSIS: {
    provider: "cerebras",
    models: ["gpt-oss-120b", "zai-glm-4.7"],
  },
  RECOMMENDATION_SCORING: {
    provider: "cerebras",
    models: ["gpt-oss-120b", "zai-glm-4.7"],
  },
  CONVERSATION_SUMMARY: {
    provider: "cerebras",
    models: ["gpt-oss-120b", "zai-glm-4.7"],
  },
  EMBEDDINGS: {
    provider: "gemini",
    models: ["gemini-embedding-001"],
  },
  COMPANY_CONTEXT_INTELLIGENCE: {
    provider: "cerebras",
    models: ["gpt-oss-120b", "zai-glm-4.7"],
  },
  COMPANY_CONTEXT_RELEVANCE: {
    provider: "cerebras",
    models: ["gpt-oss-120b", "zai-glm-4.7"],
  },
  RELATIONSHIP_INTELLIGENCE: {
    provider: "cerebras",
    models: ["gpt-oss-120b", "zai-glm-4.7"],
  },
  PROFILE_ENRICHMENT_INTELLIGENCE: {
    provider: "cerebras",
    models: ["gpt-oss-120b", "zai-glm-4.7"],
  },
  STAKEHOLDER_STRATEGY: {
    provider: "cerebras",
    models: ["gpt-oss-120b", "zai-glm-4.7"],
  },
  COMPANY_STAKEHOLDER_STRATEGY: {
    provider: "cerebras",
    models: ["gpt-oss-120b", "zai-glm-4.7"],
  },
  EVENTS_INTELLIGENCE: {
    provider: "cerebras",
    models: ["gpt-oss-120b", "zai-glm-4.7"],
  },
};
