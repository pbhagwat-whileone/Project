import type { EmailProvider, EmailGenerationConfig } from "./index";
import { generateWithFallback } from "../generation";

class ConfiguredEmailProvider implements EmailProvider {
  async generateEmail(
    config: EmailGenerationConfig
  ): Promise<{ subject: string; body: string }> {
    const response = await generateWithFallback(
      config.prompt,
      "EMAIL_GENERATION",
      { 
        isJson: true,
        overrideProvider: config.provider as any,
        overrideModel: config.model,
      }
    );

    const text = response.text?.trim();
    if (!text) {
      throw new Error("Empty response from AI Provider");
    }

    try {
      const parsed = JSON.parse(text) as { subject: string; body: string };
      if (!parsed.subject || !parsed.body) {
        throw new Error("Missing subject or body in JSON response");
      }
      return parsed;
    } catch (e) {
      throw new Error("Failed to parse JSON response");
    }
  }
}

export function getEmailProvider(name?: string): EmailProvider {
  // Provider routing is now handled centrally by TASK_MODEL_CONFIG in generation.ts
  return new ConfiguredEmailProvider();
}
