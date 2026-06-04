import { generateWithFallback } from "../generation";
import type { EmailProvider, EmailGenerationConfig } from "./index";

export class GeminiProvider implements EmailProvider {
  async generateEmail(
    config: EmailGenerationConfig
  ): Promise<{ subject: string; body: string }> {
    const response = await generateWithFallback(
      config.prompt,
      "EMAIL_GENERATION",
      { isJson: true }
    );

    const text = response.text?.trim();
    if (!text) {
      throw new Error("Empty response from Gemini");
    }

    const parsed = JSON.parse(text) as { subject: string; body: string };
    if (!parsed.subject || !parsed.body) {
      throw new Error("Invalid email format from Gemini");
    }

    return parsed;
  }
}
