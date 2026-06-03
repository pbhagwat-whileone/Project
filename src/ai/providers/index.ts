export interface EmailGenerationConfig {
  prompt: string;
  isRefinement?: boolean;
}

export interface EmailProvider {
  generateEmail(config: EmailGenerationConfig): Promise<{ subject: string; body: string }>;
}
