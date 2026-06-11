import type { MatchedChunk, RankedContact, CompanyContext, CompanyContextRelevance, RelationshipIntelligence } from "@/types/database";
import { getEmailProvider } from "@/ai/providers/factory";
import { getEmailSkill } from "@/services/email-skills";

const OUTCOME_KEYWORDS = [
  "improved", "reduced", "accelerated", "optimized", "increased", 
  "saved", "performance", "efficiency", "cost", "latency", 
  "throughput", "scalability", "reliability", "automation", "productivity"
];

const WHILEONE_MESSAGING_RULES = `Whileone Messaging & Vocabulary:
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
    relationshipContext += `\nCRITICAL: Use this rich interaction history to personalize the email naturally. Never assume that future plans mentioned in old conversations are still valid today. Treat them as expired information. For example, if there are relevant action items or business context, start the email by referencing them directly (e.g., "We previously discussed X..."). Acknowledge our past conversations where relevant, but do not inject raw message logs. Keep it highly professional.`;
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
${input.connectionOwnerName ? `Connection Owner: This contact belongs to ${input.connectionOwnerName}'s LinkedIn network.\n` : ""}
Relevant Whileone Matching Projects (ONLY reference facts from this context. Projects are the STRONGEST source of evidence. Do not invent case studies, metrics, or clients. Do not generate generic capability lists when relevant project evidence exists here):
${projectContext || "No specific matching projects available — keep the email general about Whileone's AI and software capabilities."}

${input.relationshipIntelligence ? `RELATIONSHIP INTELLIGENCE
Detected Relationship Type: ${input.relationshipIntelligence.relationshipType}
Outreach Goal: ${input.relationshipIntelligence.outreachGoal}
Capability Prominence: ${input.relationshipIntelligence.capabilityProminence.toUpperCase()}

CRITICAL CAPABILITY RULES:
- If Capability Prominence is LOW: Mention Whileone briefly only if extremely natural. Focus almost entirely on the relationship / goal.
- If Capability Prominence is MEDIUM: Weave Whileone capabilities organically into the recent context.
- If Capability Prominence is HIGH: Directly position Whileone as a solution to their initiatives. Use specific proof points.
` : ""}

${input.companyContextRelevance ? `COMPANY CONTEXT RELEVANCE
Score: ${input.companyContextRelevance.relevanceScore}
Recommended Usage: ${input.companyContextRelevance.recommendedUsage}
Reasoning: ${input.companyContextRelevance.reasoning}

CRITICAL CONTEXT RULES:
Follow the Recommended Usage exactly:
- If usage = ignore: Do NOT mention company context at all.
- If usage = light_reference: Use at most one brief reference.
- If usage = conversation_starter: Use company context only as a reason to reconnect.
- If usage = primary_outreach_angle: Company context may drive the main outreach angle.
` : ""}

${input.companyContext && input.companyContext.confidence !== "low" && (!input.companyContextRelevance || input.companyContextRelevance.recommendedUsage !== "ignore") ? `COMPANY CONTEXT
Summary: ${input.companyContext.summary}
${input.companyContext.keyInitiatives.length > 0 ? `Key Initiatives: ${input.companyContext.keyInitiatives.join(", ")}` : ""}
${input.companyContext.businessPriorities.length > 0 ? `Business Priorities: ${input.companyContext.businessPriorities.join(", ")}` : ""}
${input.companyContext.technologySignals.length > 0 ? `Technology Signals: ${input.companyContext.technologySignals.join(", ")}` : ""}
${input.companyContext.hiringSignals.length > 0 ? `Hiring Signals: ${input.companyContext.hiringSignals.join(", ")}` : ""}
${input.companyContext.outreachOpportunities.length > 0 ? `Outreach Opportunities: ${input.companyContext.outreachOpportunities.join(", ")}` : ""}
` : ""}

${input.recommendationReason ? `Why this company is recommended:\n${input.recommendationReason}\n` : ""}
${input.prospectNotes ? `Additional notes:\n${input.prospectNotes}` : ""}

${WHILEONE_MESSAGING_RULES.replace("TARGET_COMPANY_PLACEHOLDER", input.targetCompany)}
Requirements:
- The purpose of this outreach is business development. Do not merely reconnect.
- Demonstrate Whileone's credibility through relevant project evidence.
- If matching projects are available, include a concise bullet section containing 2-4 project-backed outcomes.
- Prefer measurable outcomes and numerical results whenever available.
- Project evidence should be specific enough to establish credibility but concise enough to remain mobile-friendly.
- Follow this exact CONTEXT HIERARCHY for generation:
  1. Introduction: Relationship Intelligence → Conversation History. Use conversation history primarily for opening, relationship framing, and setting the tone.
  2. Body: Company Context Intelligence → Matching Projects. Actively connect recent Company Context with Matching Projects. Do not list company developments and capabilities separately. Make the connection explicit (e.g. "Since you are building X, our work on Y is highly relevant").
  3. Credibility: Matching Project Outcomes. Project evidence should always take precedence over generic capability statements.
  4. CTA: Driven by Relationship Type and Outreach Goal.
- Subject line must be 5-9 words, curiosity-driven, highly relevant, and NOT spammy.
- Incorporate the company name (${input.targetCompany}) into the subject line naturally if possible. Prioritize in this order: 1) Relevance 2) Company Name 3) Curiosity 4) Brevity.
- Do NOT use clickbait or generic phrases like "Introduction from Whileone", "Quick Chat", "Exploring Opportunities", "Following Up", or "Checking In".
- Implicitly position Whileone as a domain expert using evidence from Matching Projects, NOT generic claims. Never say "We provide performance tuning services" or "We offer AI infrastructure expertise" if specific project evidence can be used instead.
- The offering section must be easy to scan. When discussing Whileone experience or relevant work, use concise bullet points.
  - Good Example: "At Whileone we've recently helped engineering teams:\n• Reduce validation effort by 40%...\n• Improve compiler reliability..."
- Use actual bullet symbols (•) for bulleted lists. Do NOT use asterisks (*) or hyphens (-).
- Keep references concise and do not invent metrics.
- Entire email must be 120-150 words maximum (prefer 80-130 words) and mobile-friendly with short sentences. Avoid large paragraphs describing capabilities.
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

${WHILEONE_MESSAGING_RULES.replace("TARGET_COMPANY_PLACEHOLDER", context ? context.company : "their company")}

Apply the instructions carefully to the existing draft. 
- The purpose of this outreach is business development. Do not merely reconnect.
- Demonstrate Whileone's credibility through relevant project evidence.
- If matching projects are available, include a concise bullet section containing 2-4 project-backed outcomes.
- Prefer measurable outcomes and numerical results whenever available.
- Project evidence should be specific enough to establish credibility but concise enough to remain mobile-friendly.
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
