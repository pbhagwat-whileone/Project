import type { EmailProvider } from "./index";
import { GeminiProvider } from "./gemini";
import { ClaudeProvider } from "./claude";

export function getEmailProvider(name: string): EmailProvider {
  switch (name.toLowerCase()) {
    case "claude":
      return new ClaudeProvider();
    case "gemini":
    default:
      return new GeminiProvider();
  }
}
