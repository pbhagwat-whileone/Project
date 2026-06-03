import type { MatchedChunk, RankedContact } from "@/types/database";
import { getEmailProvider } from "@/ai/providers/factory";
import { getEmailSkill } from "@/services/email-skills";

export type EmailGenerationInput = {
  targetCompany: string;
  contact: RankedContact;
  projects: MatchedChunk[];
  prospectNotes?: string;
  recommendationReason?: string;
  relationshipType?: string;
  provider?: string;
};

export type GeneratedEmailContent = {
  subject: string;
  body: string;
};

export async function generateOutreachEmail(
  input: EmailGenerationInput
): Promise<GeneratedEmailContent> {
  const contactName = [input.contact.first_name, input.contact.last_name]
    .filter(Boolean)
    .join(" ");

  const projectContext = input.projects
    .map(
      (p, i) =>
        `Project ${i + 1}: ${p.project_name ?? "Unknown"}\nSummary: ${p.chunk_text.slice(0, 400)}`
    )
    .join("\n\n");

  const relationship = input.relationshipType || "Unknown Relationship";
  const skillMarkdown = await getEmailSkill(relationship);

  const prompt = `You are drafting a B2B outreach email for WhileOne, a technology consultancy.
  
Follow this email strategy precisely:
---
${skillMarkdown}
---

Target company: ${input.targetCompany}
Contact: ${contactName}
Contact title: ${input.contact.position ?? "Unknown"}
Relationship Context: ${relationship}

Relevant WhileOne project knowledge (ONLY reference facts from this context — do not invent case studies, metrics, or clients):
${projectContext || "No specific project context available — keep the email general about WhileOne's AI and software capabilities."}

${input.recommendationReason ? `Why this company is recommended:\n${input.recommendationReason}\n` : ""}
${input.prospectNotes ? `Additional notes:\n${input.prospectNotes}` : ""}

Requirements:
- Personalized to the contact's role and company
- Mention 1-2 relevant projects only if supported by the context above
- Do NOT fabricate claims, results, or partnerships
- Sign off as "The WhileOne Team"

Respond in JSON only with this exact shape:
{"subject": "...", "body": "..."}`;

  const providerName = input.provider || "gemini";
  const provider = getEmailProvider(providerName);
  
  return provider.generateEmail({ prompt });
}

export async function refineOutreachEmail(
  currentSubject: string,
  currentBody: string,
  instructions: string,
  providerName: string = "gemini",
  context?: {
    company: string;
    contactName: string;
    relationship: string;
  }
): Promise<GeneratedEmailContent> {
  const relationship = context?.relationship || "Unknown Relationship";
  const skillMarkdown = await getEmailSkill(relationship);

  const prompt = `You are a professional B2B outreach copywriter for WhileOne.
Your task is to refine an existing email draft based on specific user instructions while strictly adhering to the selected email strategy.

Follow this email strategy precisely:
---
${skillMarkdown}
---

${context ? `Context:
Target Company: ${context.company}
Contact Name: ${context.contactName}
Relationship: ${context.relationship}` : ""}

Current Email Subject:
${currentSubject}

Current Email Body:
${currentBody}

Refinement Instructions from User:
"${instructions}"

Apply the instructions carefully to the existing draft. 
- Do NOT generate a completely unrelated email. Modify the existing one.
- Preserve factual project references or names unless instructed otherwise.
- Keep the sign-off as "The WhileOne Team".

Respond in JSON only with this exact shape (with the updated subject and body):
{"subject": "...", "body": "..."}`;

  const provider = getEmailProvider(providerName);
  
  return provider.generateEmail({ prompt, isRefinement: true });
}
