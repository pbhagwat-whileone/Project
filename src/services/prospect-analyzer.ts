import { generateWithFallback } from "@/ai/generation";
import type { Prospect } from "@/types/database";

export async function generateProspectAnalysis(
  prospect: Prospect
): Promise<string> {

  const prompt = `Analyze this prospective client for WhileOne, a technology consultancy specializing in AI, custom software, and digital transformation.

Company: ${prospect.company_name}
Website: ${prospect.website ?? "Unknown"}
Country: ${prospect.country ?? "Unknown"}
Industry: ${prospect.industry ?? "Unknown"}
Revenue range: ${prospect.revenue_range ?? "Unknown"}
Employee count: ${prospect.employee_count ?? "Unknown"}
Notes: ${prospect.notes ?? "None"}

Provide a structured analysis in markdown with these sections:
## Why This Company Is a Good Target
## Possible Business Challenges
## AI Opportunities
## Relevant WhileOne Services
## Suggested Outreach Angle

Be specific and actionable. Do not invent financial data not implied by the inputs.`;

  const response = await generateWithFallback(prompt, "PROSPECT_ANALYSIS");

  const text = response.text?.trim();
  if (!text) {
    throw new Error("Failed to generate prospect analysis");
  }

  return text;
}
