import OpenAI from "openai";

let grokClient: OpenAI | null = null;

function getGrokClient() {
  if (!grokClient) {
    if (!process.env.XAI_API_KEY) {
      throw new Error("XAI_API_KEY is not set in the environment.");
    }
    grokClient = new OpenAI({
      apiKey: process.env.XAI_API_KEY,
      baseURL: "https://api.x.ai/v1",
    });
  }
  return grokClient;
}

export async function generateGrok(prompt: string, model: string, isJson: boolean = false): Promise<string> {
  const ai = getGrokClient();

  const response = await ai.chat.completions.create({
    model,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: isJson ? { type: "json_object" } : { type: "text" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from Grok");
  }

  return content;
}
