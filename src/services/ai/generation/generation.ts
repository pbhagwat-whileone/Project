import { getGeminiClient } from "./gemini";
import { TASK_MODEL_CONFIG, TaskType, PROVIDER_MODELS, ProviderType } from "../models/models";
import { generateClaude } from "../providers/claude";
import { generateCerebras } from "../providers/cerebras";

type ModelStatus = {
  unavailableUntil: number;
};
const modelHealth: Record<string, ModelStatus> = {};
const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

export function isTaskAvailable(task: TaskType, options?: { overrideProvider?: ProviderType }): boolean {
  const config = TASK_MODEL_CONFIG[task];
  if (!config) return false;

  const chain = options?.overrideProvider
    ? PROVIDER_MODELS[options.overrideProvider]
    : config.models;

  if (!chain || chain.length === 0) return false;

  return !chain.every((m) => modelHealth[m]?.unavailableUntil > Date.now());
}

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

  if (provider === "cerebras") {
    const validModels = PROVIDER_MODELS["cerebras"];
    for (const m of chain) {
      if (!validModels.includes(m)) {
        throw new Error(`Invalid model '${m}' configured for task '${task}' with provider 'cerebras'. Valid models are: ${validModels.join(", ")}`);
      }
    }
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

    const startTime = Date.now();

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
      } else if (provider === "claude") {
        text = await generateClaude(prompt, model, options?.isJson);
      } else if (provider === "cerebras") {
        text = await generateCerebras(prompt, model, options?.isJson);
      } else {
        throw new Error(`Unknown provider: ${provider}`);
      }

      const duration = Date.now() - startTime;
      return { text };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[AI] Task=${task} Provider=${provider} Model=${model} Duration=${duration}ms Success=false Error=${error?.message}`);

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
