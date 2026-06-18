import Anthropic from "@anthropic-ai/sdk";
import type { EmailProvider, EmailGenerationConfig } from "./index";
import { generateWithFallback } from "../generation/generation";

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

export async function generateClaude(prompt: string, model: string, isJson: boolean = false): Promise<string> {
  const ai = getAnthropicClient();

  const response = await ai.messages.create({
    model,
    max_tokens: 1024,
    system: isJson ? "You are an expert copywriter. Respond in strict JSON format matching the requested schema. Do NOT include markdown blocks like ```json." : undefined,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  if (response.content.length === 0 || response.content[0].type !== "text") {
    throw new Error("Invalid response format from Claude");
  }

  let text = response.content[0].text.trim();
  if (isJson) {
    text = text.replace(/^```json/, "").replace(/```$/, "").trim();
  }
  return text;
}

export class ClaudeProvider implements EmailProvider {
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
      throw new Error("Empty response from Claude");
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
