export interface EmailGenerationConfig {
  prompt: string;
  isRefinement?: boolean;
  provider?: string;
  model?: string;
}

export interface EmailProvider {
  generateEmail(config: EmailGenerationConfig): Promise<{ subject: string; body: string }>;
}
