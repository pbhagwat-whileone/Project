import Anthropic from "@anthropic-ai/sdk";
import type { EmailProvider, EmailGenerationConfig } from "./index";

let anthropicClient: Anthropic | null = null;

function getAnthropicClient() {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set in the environment.");
    }
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

export class ClaudeProvider implements EmailProvider {
  async generateEmail(
    config: EmailGenerationConfig
  ): Promise<{ subject: string; body: string }> {
    const ai = getAnthropicClient();

    const response = await ai.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1024,
      system: "You are an expert copywriter. Respond in strict JSON format matching the requested schema. Do NOT include markdown blocks like ```json.",
      messages: [
        {
          role: "user",
          content: config.prompt,
        },
      ],
    });

    if (response.content.length === 0 || response.content[0].type !== "text") {
      throw new Error("Invalid response format from Claude");
    }

    const text = response.content[0].text.trim();
    if (!text) {
      throw new Error("Empty response from Claude");
    }

    try {
      // Claude might wrap the output in markdown json block anyway, strip it if present
      const cleanedText = text.replace(/^```json/, "").replace(/```$/, "").trim();
      const parsed = JSON.parse(cleanedText) as { subject: string; body: string };
      
      if (!parsed.subject || !parsed.body) {
        throw new Error("Missing subject or body in Claude JSON response");
      }

      return parsed;
    } catch (e) {
      throw new Error("Failed to parse JSON response from Claude");
    }
  }
}
