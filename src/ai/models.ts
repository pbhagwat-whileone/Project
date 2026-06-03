export type TaskType =
  | "METADATA_EXTRACTION"
  | "COMPANY_CLASSIFICATION"
  | "RECOMMENDATION_REASONING"
  | "PROSPECT_ANALYSIS"
  | "EMAIL_GENERATION"
  | "EMBEDDINGS";

export const MODELS = {
  METADATA_EXTRACTION: "gemini-2.5-flash",
  COMPANY_CLASSIFICATION: "gemini-2.5-flash",
  RECOMMENDATION_REASONING: "gemini-2.5-flash",
  PROSPECT_ANALYSIS: "gemini-2.5-flash",
  EMAIL_GENERATION: "gemini-2.5-pro",
  EMBEDDINGS: "gemini-embedding-001",
};

export const FALLBACK_CHAINS: Record<TaskType, string[]> = {
  METADATA_EXTRACTION: ["gemini-2.5-flash", "gemini-2.0-flash"],
  COMPANY_CLASSIFICATION: ["gemini-2.5-flash", "gemini-2.0-flash"],
  RECOMMENDATION_REASONING: ["gemini-2.5-flash", "gemini-2.0-flash"],
  PROSPECT_ANALYSIS: ["gemini-2.5-flash", "gemini-2.0-flash"],
  EMAIL_GENERATION: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
  EMBEDDINGS: ["gemini-embedding-001"],
};
