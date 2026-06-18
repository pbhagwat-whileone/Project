import type { MatchedChunk, RankedContact, CompanyContext, CompanyContextRelevance, RelationshipIntelligence } from "@/types/database";
import { getEmailProvider } from "@/services/ai/providers/factory";
import { getEmailSkill } from "@/domains/emails/services/emailSkills";

const OUTCOME_KEYWORDS = [
  "improved", "reduced", "accelerated", "optimized", "increased", 
  "saved", "performance", "efficiency", "cost", "latency", 
  "throughput", "scalability", "reliability", "automation", "productivity",
  "burden", "visibility", "observability"
];

const WHILEONE_MESSAGING_RULES = `Whileone Messaging & Vocabulary:
- Observation First: The opening MUST be based on a concrete signal (e.g., Hiring Signal, Company Initiative). NEVER use generic consultant-like openings like "I've observed...", "Many organizations...", or "A common challenge...".
- One Angle: Every email should be explainable in one sentence. Do NOT mix multiple disparate angles in the same email.
- Projects Support the Story: Projects should validate the outreach angle, NOT become the angle. Describe projects in terms of business, engineering, or operational outcomes, NOT technical implementation details (unless reaching out to a deeply technical IC).
- Business Outcomes > Technical Details: Prefer outcomes like "Reduced validation effort", "Improved reliability", "Accelerated deployment", "Reduced operational burden", "Improved observability", "Enhanced scalability" over technical jargon like "Socket optimization" or "Kernel tuning".
- Use Whileone core vocabulary naturally when relevant (do NOT force keywords or sound like marketing copy): Reliable AI, AI-powered solutions, ML-powered solutions, performance tuning, workload characterization, unbiased benchmarking, cloud optimization, simplified cloud cost management, intelligent frameworks, in-house developed frameworks, deep domain expertise, practical experience, engineering productivity, reliability, performance optimization, scalability, HPC, edge computing, ER&D.
- Adapt language to the target company (TARGET_COMPANY_PLACEHOLDER):
  * Semiconductor (AMD, NVIDIA, Qualcomm, Intel, TSMC, Broadcom): prefer performance tuning, benchmarking, validation, ARM, RISC-V, HPC, scalability, reliability.
  * Cloud (AWS, Microsoft, Google, Oracle, Equinix): prefer cloud optimization, workload characterization, cloud cost management, scalability, reliability, performance.
  * AI: prefer AI infrastructure, ML workloads, performance optimization, intelligent frameworks, scalability.
  * Automotive/Manufacturing: prefer reliability, validation, optimization, engineering productivity, practical deployment.
- Implicitly reflect the vision of being a trusted partner in Cloud, HPC, AI, and Edge, without explicitly quoting it.
- Implicitly reflect the mission (delivering measurable business value, reliable engineering services, intelligent frameworks, deep domain expertise, practical implementation) without mechanical repetition.
- Outcome-Driven Messaging Rule: Always lead with value before implementation details. For example, prefer "reduced validation effort" over "implemented automated testing", "improved workload efficiency" over "developed optimization tooling", "accelerated performance analysis" over "built benchmarking frameworks".`;

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
  relationshipIntelligence?: RelationshipIntelligence | null;
  provider?: string;
  model?: string;
  relationshipSummary?: string;
  discussionTopics?: string;
  interactionTimeline?: string;
  recentHighlights?: string;
  messageCount?: number;
  lastInteractionDate?: string;
  connectionOwnerName?: string;
  keyInterests?: string[] | null;
  businessContext?: string | null;
  actionItems?: string[] | null;
  engagementQuality?: string | null;
  recommendedOutreachAngle?: string | null;
  personalizationPoints?: string[] | null;
  persistentContext?: string | null;
  timeBoundContext?: string | null;
  companyContext?: CompanyContext | null;
  companyContextRelevance?: CompanyContextRelevance | null;
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

  const relationship = input.relationshipIntelligence?.relationshipType || "cold-outreach";
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
    if (input.businessContext) {
      relationshipContext += `- Business Context: ${input.businessContext}\n`;
    }
    if (input.discussionTopics) {
      relationshipContext += `- Topics Discussed: ${input.discussionTopics}\n`;
    }
    if (input.keyInterests && input.keyInterests.length > 0) {
      relationshipContext += `- Key Interests: ${input.keyInterests.join(", ")}\n`;
    }
    if (input.actionItems && input.actionItems.length > 0) {
      relationshipContext += `- Unfinished Action Items: ${input.actionItems.join(", ")}\n`;
    }
    if (input.personalizationPoints && input.personalizationPoints.length > 0) {
      relationshipContext += `- Personalization Points: ${input.personalizationPoints.join(", ")}\n`;
    }
    if (input.recentHighlights) {
      relationshipContext += `- Recent Highlights: ${input.recentHighlights}\n`;
    }
    if (input.engagementQuality) {
      relationshipContext += `- Historical Engagement Quality: ${input.engagementQuality}\n`;
    }
    if (input.persistentContext) {
      relationshipContext += `- Persistent Context: ${input.persistentContext}\n`;
    }
    
    let daysSinceLastInteraction = 0;
    if (input.lastInteractionDate) {
      daysSinceLastInteraction = Math.floor((new Date().getTime() - new Date(input.lastInteractionDate).getTime()) / (1000 * 3600 * 24));
    }

    if (input.timeBoundContext) {
      if (daysSinceLastInteraction > 365) {
        // Ignore timeBoundContext entirely as per rules
      } else if (daysSinceLastInteraction > 180) {
        relationshipContext += `- Time-Bound Context (CRITICAL TEMPORAL RULE: These events are over 180 days old! Treat them strictly as historical context. Do NOT reference them as current or upcoming. Example: write "Hope your past trip went well", NOT "Looking forward to your trip"): ${input.timeBoundContext}\n`;
      } else {
        relationshipContext += `- Time-Bound Context: ${input.timeBoundContext}\n`;
      }
    }

    if (input.recommendedOutreachAngle) {
      relationshipContext += `- RECOMMENDED OUTREACH ANGLE: ${input.recommendedOutreachAngle}\n`;
    }
    relationshipContext += `\nCRITICAL CONVERSATION RULE: Use this intelligence ONLY if it directly supports the selected outreach angle. Do NOT summarize past conversations or recount history. Do not let this drive the body of the email. Use it primarily for familiarity level, greeting, and CTA wording. Never assume future plans from old conversations are still valid.`;
  }

  const prompt = `You are drafting a B2B outreach email for Whileone, a technology consultancy.

CORE PRINCIPLE:
The purpose of the email is NOT to summarize all available intelligence. The purpose is to create interest in a conversation.
MENTAL MODEL: Context ↓ Select Best Angle ↓ Find Best Proof ↓ Write Email.

INTERNAL PLANNING STAGE:
Before writing the email body, determine:
- WHY THIS PERSON?
- WHY THIS COMPANY?
- WHY NOW?
- WHAT IS THE SINGLE BEST OUTREACH ANGLE?
- WHAT IS THE STRONGEST PROOF POINT?
Provide your reasoning in the "internal_planning" JSON field. Do not output this reasoning in the email body.

EMAIL STRUCTURE:
Every email should strictly follow these blocks:
Block 1 — Greeting (e.g., "Hello Deepak,", "Hope you are doing well.")
Block 2 — Reason For Outreach (One sentence answering "Why am I receiving this email?". e.g., "I noticed Cisco is actively hiring for SRE roles.")
Block 3 — Relevant Industry Challenge (Optional. Only if it strengthens the angle. Max 2 sentences. Never use generic consultant language.)
Block 4 — WhileOne Proof (The most important block. Use ONE: Customer Success Story, Relevant Project, Technical Asset. This should feel like "Here's why we're relevant", NOT "Here's what we sell".)
Block 5 — Supporting Evidence (Choose ONE: Customer Outcome, Service Capability, or Technical Asset. Max 3 bullets.)
Block 6 — CTA (Simple. e.g., "Would you be open to a brief discussion?")
Block 7 — Attachment Mention (Always include: "I am attaching our corporate overview and technical capabilities presentation for your reference.")

SUBJECT LINE RULES:
Subject should come from: Company Signal + Outreach Angle.
Examples: "Cisco and SRE Operations", "Thoughts on Cloud Reliability".
Avoid generic topics unless those exact topics appear in signals.

CONTEXT USAGE RULES:
- Relationship Intelligence: Use only for greeting, familiarity level, and CTA wording. Never drive the body.
- Conversation Intelligence: Use only if it directly supports the outreach angle. Do not summarize conversations or recount history.
- Company Context: Primary purpose is "Why now?". Use one signal only. Do not dump context.
- Profile Intelligence: Primary purpose is to select outreach angle. Do not list tags.
- Matching Projects: Purpose is Proof, not Topic. Project proves credibility.

Target company: ${input.targetCompany}
Contact: ${contactName}
Contact title: ${input.contact.position ?? "Unknown"}

PROFILE INTELLIGENCE:
${input.contact.location ? `Location: ${input.contact.location}` : ""}
${input.contact.technology_tags?.length ? `Technology Tags: ${input.contact.technology_tags.join(", ")}` : ""}
${input.contact.expertise_tags?.length ? `Expertise Tags: ${input.contact.expertise_tags.join(", ")}` : ""}
${input.contact.activity_signals?.length ? `Activity Signals: ${input.contact.activity_signals.join("; ")}` : ""}

COMPANY CONTEXT:
${input.companyContext ? `Summary: ${input.companyContext.summary}
Key Initiatives: ${input.companyContext.keyInitiatives.join(", ")}
Technology Signals: ${input.companyContext.technologySignals.join(", ")}
Hiring Signals: ${input.companyContext.hiringSignals.join(", ")}` : "None"}

RELATIONSHIP & CONVERSATION INTELLIGENCE:
Relationship Type: ${relationship}
${relationshipContext}

MATCHING PROJECTS (PROOF):
${projectContext || "No specific matching projects available."}

${WHILEONE_MESSAGING_RULES.replace("TARGET_COMPANY_PLACEHOLDER", input.targetCompany)}

SKILL STRATEGY (Adjust Tone & Familiarity based on this):
---
${skillMarkdown}
---

SUCCESS CRITERIA:
A human sales leader reading the email should think: "They understand what I work on. They have done something relevant. This is worth a reply." Not "This sounds like an AI summarizing a project database."
Use actual bullet symbols (•) for bulleted lists. Instead of showing the raw link, use the exact phrase "Contact Us" as a markdown hyperlink pointing to the CTA at the end of the email: [Contact Us](https://calendly.com/snatu-whileone/30min)
Sign off as "The Whileone Team".

Respond in JSON only with this exact shape:
{
  "internal_planning": "Your internal reasoning answering the 5 planning questions",
  "subject": "...",
  "body": "..."
}`;

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
Your task is to refine an existing email draft based on specific user instructions while strictly adhering to the selected email strategy and new Strategic Redesign principles.

EMAIL STRUCTURE:
Every email should strictly follow these blocks:
Block 1 — Greeting (e.g., "Hello Deepak,", "Hope you are doing well.")
Block 2 — Reason For Outreach (One sentence answering "Why am I receiving this email?". e.g., "I noticed Cisco is actively hiring for SRE roles.")
Block 3 — Relevant Industry Challenge (Optional. Only if it strengthens the angle. Max 2 sentences.)
Block 4 — WhileOne Proof (Use ONE: Customer Success Story, Relevant Project, Technical Asset.)
Block 5 — Supporting Evidence (Choose ONE: Customer Outcome, Service Capability, or Technical Asset. Max 3 bullets.)
Block 6 — CTA (Simple.)
Block 7 — Attachment Mention (Always include: "I am attaching our corporate overview and technical capabilities presentation for your reference.")

SUBJECT LINE RULES:
Subject should come from: Company Signal + Outreach Angle.
Examples: "Cisco and SRE Operations", "Thoughts on Cloud Reliability".

SKILL STRATEGY (Adjust Tone & Familiarity based on this):
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

${WHILEONE_MESSAGING_RULES.replace("TARGET_COMPANY_PLACEHOLDER", context ? context.company : "their company")}

Apply the instructions carefully to the existing draft. Do NOT generate a completely unrelated email. Modify the existing one, but enforce the strict email structure and strategy rules.
- The purpose of this outreach is business development.
- Preserve factual project references or names unless instructed otherwise.
- Use actual bullet symbols (•) for bulleted lists. Do NOT use asterisks (*) or hyphens (-).
- Instead of showing the raw link, use the exact phrase "Contact Us" as a markdown hyperlink pointing to the CTA at the end of the email: [Contact Us](https://calendly.com/snatu-whileone/30min)
- Sign off as "The Whileone Team".

Respond in JSON only with this exact shape (with the updated subject and body):
{
  "internal_planning": "Your reasoning for the refinement",
  "subject": "...",
  "body": "..."
}`;

  const provider = getEmailProvider();
  
  return provider.generateEmail({ 
    prompt, 
    isRefinement: true, 
    provider: providerName, 
    model: modelName 
  });
}
