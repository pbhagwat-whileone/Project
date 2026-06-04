import { generateOutreachEmail } from "./src/services/email-generator";
import { TASK_MODEL_CONFIG } from "./src/ai/models";

async function runTest() {
  const input = {
    targetCompany: "Acme Corp",
    contact: { first_name: "John", last_name: "Doe", position: "CEO" } as any,
    projects: [],
  };

  const providers = ["gemini", "claude", "openai", "grok"] as const;

  for (const provider of providers) {
    console.log(`\n--- Testing ${provider} ---`);
    // Override the config temporarily for testing
    TASK_MODEL_CONFIG.EMAIL_GENERATION.provider = provider;
    
    // Set appropriate models for each provider test
    if (provider === "gemini") {
      TASK_MODEL_CONFIG.EMAIL_GENERATION.models = ["gemini-2.5-flash"];
    } else if (provider === "claude") {
      TASK_MODEL_CONFIG.EMAIL_GENERATION.models = ["claude-3-haiku-20240307"];
    } else if (provider === "openai") {
      TASK_MODEL_CONFIG.EMAIL_GENERATION.models = ["gpt-4o-mini"]; // gpt-5 doesn't actually exist yet, so we use a real one
    } else if (provider === "grok") {
      TASK_MODEL_CONFIG.EMAIL_GENERATION.models = ["grok-2-latest"]; // real grok model for testing
    }

    try {
      const email = await generateOutreachEmail(input);
      console.log(`Success! Subject: ${email.subject}`);
    } catch (e: any) {
      console.log(`Failed: ${e.message}`);
    }
  }
}

runTest();
