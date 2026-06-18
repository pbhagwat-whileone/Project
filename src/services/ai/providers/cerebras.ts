import Cerebras from "@cerebras/cerebras_cloud_sdk";
import type { EmailProvider, EmailGenerationConfig } from "./index";
import { generateWithFallback } from "../generation/generation";

let cerebrasClient: Cerebras | null = null;

function getCerebrasClient() {
  if (!cerebrasClient) {
    if (!process.env.CEREBRAS_API_KEY) {
      throw new Error("CEREBRAS_API_KEY is not set in the environment.");
    }
    cerebrasClient = new Cerebras({
      apiKey: process.env.CEREBRAS_API_KEY,
    });
  }
  return cerebrasClient;
}

export async function generateCerebras(prompt: string, model: string, isJson: boolean = false): Promise<string> {
  const ai = getCerebrasClient();

  const response = await ai.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: isJson ? "You are an expert copywriter. Respond in strict JSON format matching the requested schema. Do NOT include markdown blocks like ```json." : "You are an expert copywriter.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    max_tokens: 4096,
    // Note: If Cerebras supports response_format: { type: "json_object" }, we can add it here,
    // but relying on prompt instruction is safer across models for now.
  });

  const resp: any = response;

  if (!resp.choices || resp.choices.length === 0 || typeof resp.choices[0].message?.content !== "string") {
    console.error("CEREBRAS ERROR RESP:", JSON.stringify(resp, null, 2));
    throw new Error("Invalid response format from Cerebras");
  }

  let text = resp.choices[0].message.content.trim();
  if (isJson) {
    text = text.replace(/^```json/, "").replace(/```$/, "").trim();
  }
  return text;
}

export class CerebrasProvider implements EmailProvider {
  async generateEmail(
    config: EmailGenerationConfig
  ): Promise<{ subject: string; body: string }> {
    const response = await generateWithFallback(
      config.prompt,
      "EMAIL_GENERATION",
      { isJson: true, overrideProvider: "cerebras" }
    );

    const text = response.text?.trim();
    if (!text) {
      throw new Error("Empty response from Cerebras");
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
