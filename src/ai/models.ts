export type TaskType =
  | "COMPANY_CLASSIFICATION"
  | "RECOMMENDATION_REASONING"
  | "EMAIL_GENERATION"
  | "EMBEDDINGS";

export type ProviderType = "gemini" | "claude" | "openai" | "grok";

export type TaskConfig = {
  provider: ProviderType;
  models: string[];
};

export const PROVIDER_MODELS: Record<ProviderType, string[]> = {
  gemini: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
  claude: ["claude-sonnet", "claude-haiku"],
  openai: ["gpt-5", "gpt-5-mini", "gpt-5-nano"],
  grok: ["grok-4", "grok-4-fast"],
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
    provider: "openai",
    models: ["gpt-5", "gpt-5-mini", "gpt-5-nano"],
  },
  EMBEDDINGS: {
    provider: "gemini",
    models: ["gemini-embedding-001"],
  },
};
