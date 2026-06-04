import { getGeminiClient } from "./gemini";
import { TASK_MODEL_CONFIG, TaskType, PROVIDER_MODELS, ProviderType } from "./models";
import { generateOpenAI } from "./providers/openai";
import { generateGrok } from "./providers/grok";
import { generateClaude } from "./providers/claude";

type ModelStatus = {
  unavailableUntil: number;
};
const modelHealth: Record<string, ModelStatus> = {};
const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

export async function generateWithFallback(
  prompt: string,
  task: TaskType,
  options?: { isJson?: boolean; overrideProvider?: ProviderType; overrideModel?: string }
): Promise<{ text: string }> {
  const config = TASK_MODEL_CONFIG[task];
  if (!config) {
    throw new Error(`No TASK_MODEL_CONFIG configured for task: ${task}`);
  }

  const provider = options?.overrideProvider || config.provider;
  let chain = options?.overrideProvider
    ? PROVIDER_MODELS[options.overrideProvider]
    : config.models;

  if (options?.overrideModel) {
    const startIndex = chain.indexOf(options.overrideModel);
    if (startIndex !== -1) {
      chain = chain.slice(startIndex);
    } else {
      chain = [options.overrideModel];
    }
  }

  if (!chain || chain.length === 0) {
    throw new Error(`No fallback chain configured for task: ${task} with provider: ${provider}`);
  }

  if (chain.every((m) => modelHealth[m]?.unavailableUntil > Date.now())) {
    throw new Error(
      `All models in fallback chain for task ${task} are currently in cooldown due to quota limits.`
    );
  }

  let lastError: any;

  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    const status = modelHealth[model];
    if (status && status.unavailableUntil > Date.now()) {
      continue;
    }

    try {
      let text: string;
      if (provider === "gemini") {
        const ai = getGeminiClient();
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: options?.isJson
            ? { responseMimeType: "application/json" }
            : undefined,
        });
        text = response.text || "";
      } else if (provider === "openai") {
        text = await generateOpenAI(prompt, model, options?.isJson);
      } else if (provider === "grok") {
        text = await generateGrok(prompt, model, options?.isJson);
      } else if (provider === "claude") {
        text = await generateClaude(prompt, model, options?.isJson);
      } else {
        throw new Error(`Unknown provider: ${provider}`);
      }

      console.log(`[LLM] Task: ${task} Provider: ${provider} Model: ${model}`);
      return { text };
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
          `[LLM Fallback]\nProvider: ${provider}\nModel: ${model}\nReason: Rate Limit\nTrying: ${chain[i + 1]}`
        );
        continue;
      } else if (isQuotaError) {
        modelHealth[model] = { unavailableUntil: Date.now() + COOLDOWN_MS };
        throw error;
      } else {
        throw error;
      }
    }
  }

  throw new Error(
    `All models in fallback chain for task ${task} failed. Last error: ${lastError?.message}`
  );
}
