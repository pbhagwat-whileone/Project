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
  | "EMBEDDINGS";

export type ProviderType = "gemini" | "claude" | "openai" | "grok" | "cerebras";

export type TaskConfig = {
  provider: ProviderType;
  models: string[];
};

export const PROVIDERS = [
  { value: "gemini", label: "Gemini" },
  { value: "claude", label: "Claude" },
  { value: "openai", label: "OpenAI" },
  { value: "grok", label: "Grok" },
  { value: "cerebras", label: "Cerebras" },
] as const;

export const PROVIDER_MODELS: Record<ProviderType, string[]> = {
  gemini: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
  claude: ["claude-sonnet", "claude-haiku"],
  openai: ["gpt-5", "gpt-5-mini", "gpt-5-nano"],
  grok: ["grok-4", "grok-4-fast"],
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
};
