import type { MatchedChunk, RankedContact } from "@/types/database";
import { getEmailProvider } from "@/ai/providers/factory";
import { getEmailSkill } from "@/services/email-skills";

const OUTCOME_KEYWORDS = [
  "improved", "reduced", "accelerated", "optimized", "increased", 
  "saved", "performance", "efficiency", "cost", "latency", 
  "throughput", "scalability", "reliability", "automation", "productivity"
];

function extractOutcomeContext(text: string): string {
  if (!text) return "";
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  const outcomeSentences = sentences.filter(s => 
    OUTCOME_KEYWORDS.some(k => s.toLowerCase().includes(k))
  );
  
  let result = outcomeSentences.join(" ").trim();
  
  if (result.length < 400) {
     if (result.length === 0) {
       return text.slice(0, 400);
     }
     const nonOutcome = sentences.filter(s => !outcomeSentences.includes(s));
     for (const s of nonOutcome) {
       if (result.length >= 400) break;
       result += " " + s.trim();
     }
  }
  
  return result.slice(0, 400).trim();
}

export type EmailGenerationInput = {
  targetCompany: string;
  contact: RankedContact;
  projects: MatchedChunk[];
  prospectNotes?: string;
  recommendationReason?: string;
  relationshipType?: string;
  provider?: string;
  model?: string;
  relationshipSummary?: string;
  discussionTopics?: string;
  interactionTimeline?: string;
  recentHighlights?: string;
  messageCount?: number;
  lastInteractionDate?: string;
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
        `Project ${i + 1}: ${p.project_name ?? "Unknown"}\nSummary: ${extractOutcomeContext(p.chunk_text)}`
    )
    .join("\n\n");

  const relationship = input.relationshipType || "Unknown Relationship";
  const skillMarkdown = await getEmailSkill(relationship);

  let relationshipContext = "";
  if (input.relationshipSummary || input.messageCount) {
    relationshipContext = `\nPrior Interaction History:\n`;
    if (input.messageCount) {
      relationshipContext += `- We have exchanged ${input.messageCount} messages. ${input.interactionTimeline ? input.interactionTimeline : `Last interaction: ${input.lastInteractionDate ? new Date(input.lastInteractionDate).toLocaleDateString() : 'unknown'}.`}\n`;
    }
    if (input.relationshipSummary) {
      relationshipContext += `- Relationship Summary: ${input.relationshipSummary}\n`;
    }
    if (input.discussionTopics) {
      relationshipContext += `- Topics Discussed: ${input.discussionTopics}\n`;
    }
    if (input.recentHighlights) {
      relationshipContext += `- Recent Highlights: ${input.recentHighlights}\n`;
    }
    relationshipContext += `\nUse this history to personalize the email naturally. Acknowledge our past conversations where relevant, but do not inject raw message logs. Keep it highly professional.`;
  }

  const prompt = `You are drafting a B2B outreach email for Whileone, a technology consultancy.
  
Follow this email strategy precisely:
---
${skillMarkdown}
---

Target company: ${input.targetCompany}
Contact: ${contactName}
Contact title: ${input.contact.position ?? "Unknown"}
Relationship Context: ${relationship}${relationshipContext}

Relevant Whileone project knowledge (ONLY reference facts from this context — do not invent case studies, metrics, or clients):
${projectContext || "No specific project context available — keep the email general about Whileone's AI and software capabilities."}

${input.recommendationReason ? `Why this company is recommended:\n${input.recommendationReason}\n` : ""}
${input.prospectNotes ? `Additional notes:\n${input.prospectNotes}` : ""}

Whileone Messaging & Vocabulary:
- Use Whileone core vocabulary naturally when relevant (do NOT force keywords or sound like marketing copy): Reliable AI, AI-powered solutions, ML-powered solutions, performance tuning, workload characterization, unbiased benchmarking, cloud optimization, simplified cloud cost management, intelligent frameworks, in-house developed frameworks, deep domain expertise, practical experience, engineering productivity, reliability, performance optimization, scalability, HPC, edge computing, ER&D.
- Adapt language to the target company (${input.targetCompany}):
  * Semiconductor (AMD, NVIDIA, Qualcomm, Intel, TSMC, Broadcom): prefer performance tuning, benchmarking, validation, ARM, RISC-V, HPC, scalability, reliability.
  * Cloud (AWS, Microsoft, Google, Oracle, Equinix): prefer cloud optimization, workload characterization, cloud cost management, scalability, reliability, performance.
  * AI: prefer AI infrastructure, ML workloads, performance optimization, intelligent frameworks, scalability.
  * Automotive/Manufacturing: prefer reliability, validation, optimization, engineering productivity, practical deployment.
- Implicitly reflect the vision of being a trusted partner in Cloud, HPC, AI, and Edge, without explicitly quoting it.
- Implicitly reflect the mission (delivering measurable business value, reliable engineering services, intelligent frameworks, deep domain expertise, practical implementation) without mechanical repetition.
- Outcome-Driven Messaging Rule: Always lead with value before implementation details. For example, prefer "reduced validation effort" over "implemented automated testing", "improved workload efficiency" over "developed optimization tooling", "accelerated performance analysis" over "built benchmarking frameworks".

Requirements:
- Subject line must be 5-9 words, curiosity-driven, highly relevant, and NOT spammy.
- Incorporate the company name (${input.targetCompany}) into the subject line naturally if possible. Prioritize in this order: 1) Relevance 2) Company Name 3) Curiosity 4) Brevity.
- Do NOT use clickbait or generic phrases like "Introduction from Whileone", "Quick Chat", "Exploring Opportunities", "Following Up", or "Checking In".
- Good examples: "Thought this might be relevant for AMD", "A pattern we're seeing across NVIDIA teams", "Observation from recent benchmarking work at Intel".
- Implicitly position Whileone as a domain expert using evidence, NOT generic claims (never say "world-class" or "leading consultancy").
- Reflect core Whileone themes naturally: unbiased, practical, simplified, outcome-oriented (delivering measurable business value through reliable AI and deep domain expertise).
- Extract and highlight customer benefits and measurable improvements from the project context if available.
- Keep references concise and do not invent metrics.
- Entire email must be 120-150 words maximum (prefer 80-130 words) and mobile-friendly with short sentences.
- Avoid paragraph-heavy layouts. Use an opening sentence, followed by a maximum of 3 short bullet points summarizing relevant expertise or outcomes, followed by a CTA.
- Use actual bullet symbols (•) for bulleted lists. Do NOT use asterisks (*) or hyphens (-).
- Instead of showing the raw link, use the exact phrase "Contact Us" as a markdown hyperlink pointing to the CTA at the end of the email: [Contact Us](https://calendly.com/snatu-whileone/30min)
- Sign off as "The Whileone Team".

Respond in JSON only with this exact shape:
{"subject": "...", "body": "..."}`;

  const providerName = input.provider;
  const provider = getEmailProvider();
  
  return provider.generateEmail({ 
    prompt, 
    provider: providerName, 
    model: input.model 
  });
}

export async function refineOutreachEmail(
  currentSubject: string,
  currentBody: string,
  instructions: string,
  providerName?: string,
  context?: {
    company: string;
    contactName: string;
    relationship: string;
  },
  modelName?: string
): Promise<GeneratedEmailContent> {
  const relationship = context?.relationship || "Unknown Relationship";
  const skillMarkdown = await getEmailSkill(relationship);

  const prompt = `You are a professional B2B outreach copywriter for Whileone.
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

Whileone Messaging & Vocabulary:
- Use Whileone core vocabulary naturally when relevant (do NOT force keywords or sound like marketing copy): Reliable AI, AI-powered solutions, ML-powered solutions, performance tuning, workload characterization, unbiased benchmarking, cloud optimization, simplified cloud cost management, intelligent frameworks, in-house developed frameworks, deep domain expertise, practical experience, engineering productivity, reliability, performance optimization, scalability, HPC, edge computing, ER&D.
- Adapt language to the target company (${context ? context.company : "their company"}):
  * Semiconductor (AMD, NVIDIA, Qualcomm, Intel, TSMC, Broadcom): prefer performance tuning, benchmarking, validation, ARM, RISC-V, HPC, scalability, reliability.
  * Cloud (AWS, Microsoft, Google, Oracle, Equinix): prefer cloud optimization, workload characterization, cloud cost management, scalability, reliability, performance.
  * AI: prefer AI infrastructure, ML workloads, performance optimization, intelligent frameworks, scalability.
  * Automotive/Manufacturing: prefer reliability, validation, optimization, engineering productivity, practical deployment.
- Implicitly reflect the vision of being a trusted partner in Cloud, HPC, AI, and Edge, without explicitly quoting it.
- Implicitly reflect the mission (delivering measurable business value, reliable engineering services, intelligent frameworks, deep domain expertise, practical implementation) without mechanical repetition.
- Outcome-Driven Messaging Rule: Always lead with value before implementation details. For example, prefer "reduced validation effort" over "implemented automated testing", "improved workload efficiency" over "developed optimization tooling", "accelerated performance analysis" over "built benchmarking frameworks".

Apply the instructions carefully to the existing draft. 
- Do NOT generate a completely unrelated email. Modify the existing one.
- Preserve factual project references or names unless instructed otherwise.
- Subject line must be 5-9 words, curiosity-driven, highly relevant, and NOT spammy.
- Incorporate the company name (${context ? context.company : "their company"}) into the subject line naturally if possible. Prioritize in this order: 1) Relevance 2) Company Name 3) Curiosity 4) Brevity.
- Do NOT use clickbait or generic phrases like "Introduction from Whileone", "Quick Chat", "Exploring Opportunities", "Following Up", or "Checking In".
- Implicitly position Whileone as a domain expert using evidence.
- Email must remain short (80-130 words) and mobile-friendly.
- Prefer a format with an opening, max 3 short bullet points, and a CTA.
- Use actual bullet symbols (•) for bulleted lists. Do NOT use asterisks (*) or hyphens (-).
- Instead of showing the raw link, use the exact phrase "Contact Us" as a markdown hyperlink pointing to the CTA at the end of the email: [Contact Us](https://calendly.com/snatu-whileone/30min)
- Sign off as "The Whileone Team".

Respond in JSON only with this exact shape (with the updated subject and body):
{"subject": "...", "body": "..."}`;

  const provider = getEmailProvider();
  
  return provider.generateEmail({ 
    prompt, 
    isRefinement: true, 
    provider: providerName, 
    model: modelName 
  });
}
