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

export type ProviderType = "gemini" | "claude" | "cerebras";

export type TaskConfig = {
  provider: ProviderType;
  models: string[];
};

export const PROVIDERS = [
  { value: "gemini", label: "Gemini" },
  { value: "claude", label: "Claude" },
  { value: "cerebras", label: "Cerebras" },
] as const;

export const PROVIDER_MODELS: Record<ProviderType, string[]> = {
  gemini: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
  claude: ["claude-sonnet", "claude-haiku"],
  cerebras: ["gpt-oss-120b"],
};

export const TASK_MODEL_CONFIG: Record<TaskType, TaskConfig> = {
  COMPANY_CLASSIFICATION: {
    provider: "gemini",
    models: ["gemini-2.5-flash", "gemini-2.0-flash"],
  },
  RECOMMENDATION_REASONING: {
    provider: "cerebras",
    models: ["gpt-oss-120b"],
  },
  EMAIL_GENERATION: {
    provider: "cerebras",
    models: ["gpt-oss-120b"],
  },
  EMAIL_REFINEMENT: {
    provider: "cerebras",
    models: ["gpt-oss-120b"],
  },
  SUMMARY_GENERATION: {
    provider: "cerebras",
    models: ["gpt-oss-120b"],
  },
  PROJECT_RELEVANCE: {
    provider: "cerebras",
    models: ["gpt-oss-120b"],
  },
  COMPANY_FIT_ANALYSIS: {
    provider: "cerebras",
    models: ["gpt-oss-120b"],
  },
  RECOMMENDATION_SCORING: {
    provider: "cerebras",
    models: ["gpt-oss-120b"],
  },
  CONVERSATION_SUMMARY: {
    provider: "cerebras",
    models: ["gpt-oss-120b"],
  },
  EMBEDDINGS: {
    provider: "gemini",
    models: ["gemini-embedding-001"],
  },
  COMPANY_CONTEXT_INTELLIGENCE: {
    provider: "cerebras",
    models: ["gpt-oss-120b"],
  },
  COMPANY_CONTEXT_RELEVANCE: {
    provider: "cerebras",
    models: ["gpt-oss-120b"],
  },
  RELATIONSHIP_INTELLIGENCE: {
    provider: "cerebras",
    models: ["gpt-oss-120b"],
  },
  PROFILE_ENRICHMENT_INTELLIGENCE: {
    provider: "cerebras",
    models: ["gpt-oss-120b"],
  },
  STAKEHOLDER_STRATEGY: {
    provider: "gemini",
    models: ["gemini-2.5-flash", "gemini-2.0-flash"],
  },
  COMPANY_STAKEHOLDER_STRATEGY: {
    provider: "gemini",
    models: ["gemini-2.5-flash", "gemini-2.0-flash"],
  },
  EVENTS_INTELLIGENCE: {
    provider: "cerebras",
    models: ["gpt-oss-120b"],
  },
};
