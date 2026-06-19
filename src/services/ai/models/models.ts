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

export type ProviderType = "gemini";

export type TaskConfig = {
  provider: ProviderType;
  models: string[];
};

export const PROVIDERS = [
  { value: "gemini", label: "Gemini" },
] as const;

export const PROVIDER_MODELS: Record<ProviderType, string[]> = {
  gemini: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
};

export const TASK_MODEL_CONFIG: Record<TaskType, TaskConfig> = {
  COMPANY_CLASSIFICATION: {
    provider: "gemini",
    models: ["gemini-2.5-flash", "gemini-2.0-flash"],
  },
  RECOMMENDATION_REASONING: {
    provider: "gemini",
    models: ["gemini-2.5-flash", "gemini-2.0-flash"],
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
    provider: "gemini",
    models: ["gemini-2.5-flash", "gemini-2.0-flash"],
  },
  PROJECT_RELEVANCE: {
    provider: "gemini",
    models: ["gemini-2.5-flash", "gemini-2.0-flash"],
  },
  COMPANY_FIT_ANALYSIS: {
    provider: "gemini",
    models: ["gemini-2.5-flash", "gemini-2.0-flash"],
  },
  RECOMMENDATION_SCORING: {
    provider: "gemini",
    models: ["gemini-2.5-flash", "gemini-2.0-flash"],
  },
  CONVERSATION_SUMMARY: {
    provider: "gemini",
    models: ["gemini-2.5-flash", "gemini-2.0-flash"],
  },
  EMBEDDINGS: {
    provider: "gemini",
    models: ["gemini-embedding-001"],
  },
  COMPANY_CONTEXT_INTELLIGENCE: {
    provider: "gemini",
    models: ["gemini-2.5-flash", "gemini-2.0-flash"],
  },
  COMPANY_CONTEXT_RELEVANCE: {
    provider: "gemini",
    models: ["gemini-2.5-flash", "gemini-2.0-flash"],
  },
  RELATIONSHIP_INTELLIGENCE: {
    provider: "gemini",
    models: ["gemini-2.5-flash", "gemini-2.0-flash"],
  },
  PROFILE_ENRICHMENT_INTELLIGENCE: {
    provider: "gemini",
    models: ["gemini-2.5-flash", "gemini-2.0-flash"],
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
    provider: "gemini",
    models: ["gemini-2.5-flash", "gemini-2.0-flash"],
  },
};
