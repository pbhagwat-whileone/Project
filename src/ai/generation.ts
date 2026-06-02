import { getGeminiClient } from "./gemini";
import { FALLBACK_CHAINS, TaskType } from "./models";
import { GenerateContentResponse, GenerateContentConfig } from "@google/genai";

type ModelStatus = {
  unavailableUntil: number;
};
const modelHealth: Record<string, ModelStatus> = {};
const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

export async function generateWithFallback(
  prompt: string,
  task: TaskType,
  config?: GenerateContentConfig
): Promise<GenerateContentResponse> {
  const chain = FALLBACK_CHAINS[task];
  if (!chain || chain.length === 0) {
    throw new Error(`No fallback chain configured for task: ${task}`);
  }

  if (chain.every(m => modelHealth[m]?.unavailableUntil > Date.now())) {
    throw new Error(`All models in fallback chain for task ${task} are currently in cooldown due to quota limits.`);
  }

  const ai = getGeminiClient();
  let lastError: any;

  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    const status = modelHealth[model];
    if (status && status.unavailableUntil > Date.now()) {
      console.warn(`[Gemini Fallback] Skipping ${model} due to active cooldown.`);
      continue;
    }

    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config,
      });
      console.log(`[Gemini] Task ${task} succeeded using model: ${model}`);
      return response;
    } catch (error: any) {
      lastError = error;
      const msg = error?.message?.toLowerCase() || "";
      const status = error?.status || error?.code;
      
      const isQuotaError =
        status === 429 ||
        msg.includes("429") ||
        msg.includes("quota") ||
        msg.includes("rate limit") ||
        msg.includes("too many requests") ||
        msg.includes("exhausted");

      if (isQuotaError && i < chain.length - 1) {
        modelHealth[model] = { unavailableUntil: Date.now() + COOLDOWN_MS };
        console.warn(
          `[Gemini Fallback] Model ${model} failed for task ${task} due to rate limits/quota. Trying next model...`
        );
        continue;
      } else if (isQuotaError) {
        modelHealth[model] = { unavailableUntil: Date.now() + COOLDOWN_MS };
        console.error(
          `[Gemini] Model ${model} failed for task ${task}. Quota error: true. Exhausted chain.`
        );
        throw error;
      } else {
        console.error(
          `[Gemini] Model ${model} failed for task ${task}. Quota error: ${isQuotaError}. Error:`,
          error
        );
        throw error;
      }
    }
  }

  throw new Error(
    `All models in fallback chain for task ${task} failed. Last error: ${lastError?.message}`
  );
}
