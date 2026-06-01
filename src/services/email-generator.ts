import { getGeminiClient, GEMINI_MODEL } from "@/ai/gemini";
import type { MatchedChunk } from "@/types/database";
import type { RankedContact } from "@/types/database";

export type EmailGenerationInput = {
  targetCompany: string;
  contact: RankedContact;
  projects: MatchedChunk[];
  prospectNotes?: string;
};

export type GeneratedEmailContent = {
  subject: string;
  body: string;
};

export async function generateOutreachEmail(
  input: EmailGenerationInput
): Promise<GeneratedEmailContent> {
  const ai = getGeminiClient();
  const contactName = [input.contact.first_name, input.contact.last_name]
    .filter(Boolean)
    .join(" ");

  const projectContext = input.projects
    .map(
      (p, i) =>
        `Project ${i + 1}: ${p.project_name ?? "Unknown"} (${p.industry ?? "General"})\nSummary: ${p.chunk_text.slice(0, 400)}`
    )
    .join("\n\n");

  const prompt = `You are drafting a professional B2B outreach email for WhileOne, a technology consultancy.

Target company: ${input.targetCompany}
Contact: ${contactName}
Contact title: ${input.contact.position ?? "Unknown"}

Relevant WhileOne project knowledge (ONLY reference facts from this context — do not invent case studies, metrics, or clients):
${projectContext || "No specific project context available — keep the email general about WhileOne's AI and software capabilities."}

${input.prospectNotes ? `Prospect notes:\n${input.prospectNotes}` : ""}

Requirements:
- Professional, warm, concise tone
- Personalized to the contact's role and company
- Mention 1-2 relevant projects only if supported by the context above
- Do NOT fabricate claims, results, or partnerships
- Include a clear but soft call-to-action for a brief conversation
- Sign off as "The WhileOne Team"

Respond in JSON only with this exact shape:
{"subject": "...", "body": "..."}`;

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error("Empty response from email generator");
  }

  const parsed = JSON.parse(text) as GeneratedEmailContent;
  if (!parsed.subject || !parsed.body) {
    throw new Error("Invalid email format from model");
  }

  return parsed;
}
