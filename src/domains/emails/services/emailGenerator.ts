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
- Observation First: The opening MUST be based on a concrete signal. Start with a specific observation, not an introduction. Write as if continuing a thought already in progress. NEVER start with "I noticed...", "I came across...", "I am reaching out...", "I wanted to connect...", "I hope you are doing well...", "We would like to explore...".
- Lead with Engineering Insights, Not Business Statements: Prefer observations about architectures, workload behavior, infrastructure tradeoffs, performance bottlenecks, reliability challenges, scaling constraints, benchmarking findings, or deployment lessons. Avoid generic business language like "digital transformation", "innovation", "helping organizations", "business challenges", "market leadership", or "operational excellence". The email should sound like it was written by an engineer who understands systems, not a salesperson.
- Allow uncertainty and curiosity: Do not present assumptions as facts. Use phrases like "From the outside, it appears...", "It looks like...", "I suspect...", "One thing that stood out...", "It would be interesting to know...". Sound like a thoughtful practitioner.
- Minimize company name repetition: Mention the company name once in the introduction. After that, use "your team", "your platform", "the organization", etc.
- Demonstrate Expertise Before Mentioning Whileone: Do not introduce Whileone, services, capabilities, or offerings in the first half of the email. The recipient should infer technical credibility before reading about Whileone.
- Treat Technical Buyers as Peers: For engineering leaders, architects, SREs, and platform engineers, write as one technical professional speaking to another (engineer-to-engineer, practitioner-to-practitioner). Avoid vendor-to-buyer or consultant-to-client tones.
- Replace Service-Selling Language with Engineering Curiosity: Avoid "We would like to explore opportunities" or "We offer services". Prefer "Curious whether you've encountered something similar", "Interested to hear how your team approaches this", "Wondering if this has surfaced in your environment as well", "I'd be interested to compare notes".
- Use Project Findings Instead of Capability Statements: Avoid capability lists like "We provide benchmarking services" or "We specialize in performance engineering". Prefer concrete engineering experiences like "While analyzing token-generation bottlenecks in LLM inference workloads, we discovered...", "During a workload-porting effort from x86 to ARM, we found...", "A recent benchmarking project revealed...", "An observability study showed...", "During a chaos-engineering exercise, we uncovered...".
- Reward conversational tone: Prefer "One thing we learned from that project was...", "What surprised us was...", "The interesting finding ended up being...". Avoid "Our expertise enables...", "Our capabilities include...", "We provide solutions for...".
- Match Stories to Whileone's Actual Expertise: Prioritize Performance Engineering (benchmarking, workload characterization, tuning, microarchitecture analysis), AI Infrastructure (LLM inference, model serving, accelerator validation), Platform Engineering (ARM, x86, RISC-V, Kubernetes, workload porting), and Reliability Engineering (SRE, observability, chaos engineering). Do not generate generic software-development stories unless directly relevant.
- Prioritize Technical Credibility over Sales Messaging: If forced to choose between explaining a useful engineering insight or describing Whileone capabilities, ALWAYS prefer the engineering insight.
- One Angle: Every email should be explainable in one sentence. Do NOT mix multiple disparate angles in the same email.
- Conciseness & Structure Rules (CRITICAL):
  * Do not add extra sections.
  * Do not introduce long engineering essays.
  * Do not introduce multi-paragraph speculative analysis.
  * Do not spend more than 2-3 sentences on observations before transitioning to the Whileone project example.
  * Keep project stories concise.
  * Capability bullets should remain present when relevant.
  * The recipient should understand why they were contacted within the first few sentences.
  * The recipient should understand what Whileone does before reaching the CTA.
  * Optimize for reply rate, not thought leadership.
  * The recipient should understand: 1) Why they were contacted, 2) Why the Whileone example is relevant, 3) What Whileone does, 4) What action is being requested, within the first 60% of the email.
- Adapt language to the target company (TARGET_COMPANY_PLACEHOLDER):
  * Semiconductor (AMD, NVIDIA, Qualcomm, Intel, TSMC, Broadcom): prefer performance tuning, benchmarking, validation, ARM, RISC-V, HPC, scalability, reliability.
  * Cloud (AWS, Microsoft, Google, Oracle, Equinix): prefer cloud optimization, workload characterization, cloud cost management, scalability, reliability, performance.
  * AI: prefer AI infrastructure, ML workloads, performance optimization, intelligent frameworks, scalability.
  * Automotive/Manufacturing: prefer reliability, validation, optimization, engineering productivity, practical deployment.`;

const CAPABILITY_PRESENTATION_RULES = `Capability Presentation Rules:
- Preserve structured evidence: Do not remove bullet lists entirely. Use them as supporting evidence.
- Position bullet lists after the story: The bullets should reinforce the narrative rather than introduce the pitch.
- Use bullet lists as supporting evidence: Avoid generic introductions like "We provide:". Prefer "A few areas where we've spent considerable time include:".
- Prioritize outcome-oriented bullets: Focus on what was achieved rather than generic service descriptions. 
  * PREFER: "Identified microarchitectural bottlenecks impacting AI inference throughput", "Validated workload portability across ARM and x86 platforms", "Reduced infrastructure inefficiencies", "Built observability frameworks".
  * AVOID: "Performance engineering services", "AI optimization services", "Benchmarking services", "Consulting services".
- Match bullets to recipient context:
  * AI companies: AI infrastructure, LLM inference, accelerator benchmarking, workload characterization, model-serving performance.
  * Semiconductor companies: silicon validation, firmware, architecture analysis, benchmarking, performance-per-watt.
  * Cloud and infrastructure companies: observability, SRE, platform engineering, scalability, workload optimization.
  * Enterprise software companies: platform reliability, modernization, AI governance, operational performance, cloud-scale architecture.
- Limit bullet lists: Use 3-5 bullets maximum. They should be concise and highly relevant to the recipient's context. Do not generate large capability catalogs.
- Keep the CTA conversational: End with curiosity rather than a sales request. 
  * EXAMPLES: "Curious whether you've encountered similar challenges.", "Interested to hear how your team is approaching this.", "Wondering if similar bottlenecks have surfaced in your environment.", "Would be interested to compare notes on this area."
  * AVOID: "Schedule a meeting.", "Book time on my calendar.", "Explore collaboration opportunities.", "Discuss our services."`;

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

  const primaryProject = input.projects.length > 0 ? input.projects[0] : null;



  let projectContext = "No specific matching projects available.";
  if (primaryProject) {
    projectContext = `PRIMARY PROJECT

Name:
${primaryProject.project_name ?? "Unknown"}

Summary:
${primaryProject.project_summary || extractOutcomeContext(primaryProject.chunk_text)}`;
  }



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
Every email should strictly follow this flow (do not use block headers in the output):
1. Greeting: Natural and brief (e.g., "Hi Deepak," or "Hello Deepak,")
2. Observation: Start with a specific observation about the recipient's architecture, workload, or infrastructure. Write as if continuing a thought. Keep it brief (2-3 sentences max) before transitioning.
3. Engineering Insight: Allow a technical insight or challenge to emerge from the observation. Treat them as a peer.
4. Relevant Project Experience: Share a concrete finding from a past project (e.g., "We recently worked on analyzing token-generation performance..."). Keep project stories concise. 

IMPORTANT:
The PRIMARY PROJECT has already been selected by the recommendation engine.
Do not choose a different project.
If you reference a Whileone project, reference the PRIMARY PROJECT.
Do not ignore the PRIMARY PROJECT in favor of lower-ranked projects.

5. Lesson Learned: Share what was discovered briefly. Reward conversational tone ("What surprised us was...").
6. Supporting Capability Summary (bullets): Introduce 3-5 outcome-oriented bullets that reinforce the narrative. Use phrases like "A few areas where we've spent considerable time include:". Focus on specific technical achievements. Connect the lesson to their context and introduce what Whileone does here.
7. Conversational Question (CTA): A simple question replacing sales language with curiosity ("Curious whether you've encountered similar challenges"). DO NOT ask for a meeting or calendar time.
8. Attachment Mention: Always include: "I am attaching our corporate overview and technical capabilities presentation for your reference."

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

${CAPABILITY_PRESENTATION_RULES}

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

  const generated = await provider.generateEmail({
    prompt,
    provider: providerName,
    model: input.model
  });

  let selectedBlogUrl: string | null = null;
  for (const project of input.projects) {
    if (project.blog_url) {
      selectedBlogUrl = project.blog_url;
      break;
    }
  }

  if (selectedBlogUrl && !generated.body.includes(selectedBlogUrl)) {
    const attachmentMention = "I am attaching our corporate overview";
    const urlSection = `Relevant Link:\n${selectedBlogUrl}\n\n`;
    
    if (generated.body.includes(attachmentMention)) {
      generated.body = generated.body.replace(attachmentMention, urlSection + attachmentMention);
    } else {
      generated.body += `\n\n${urlSection.trim()}`;
    }
  }

  return generated;
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
Every email should strictly follow this flow (do not use block headers in the output):
1. Greeting: Natural and brief.
2. Observation: Start with a specific observation about the recipient's architecture, workload, or infrastructure. Write as if continuing a thought. Keep it brief (2-3 sentences max) before transitioning.
3. Engineering Insight: Allow a technical insight or challenge to emerge from the observation. Treat them as a peer.
4. Relevant Project Experience: Share a concrete finding from a past project (e.g., "We recently worked on analyzing token-generation performance..."). Keep project stories concise. 

IMPORTANT:
The PRIMARY PROJECT has already been selected by the recommendation engine.
Do not choose a different project.
If you reference a Whileone project, reference the PRIMARY PROJECT.
Do not ignore the PRIMARY PROJECT in favor of lower-ranked projects.

5. Lesson Learned: Share what was discovered briefly. Reward conversational tone ("What surprised us was...").
6. Supporting Capability Summary (bullets): Introduce 3-5 outcome-oriented bullets that reinforce the narrative. Use phrases like "A few areas where we've spent considerable time include:". Focus on specific technical achievements. Connect the lesson to their context and introduce what Whileone does here.
7. Conversational Question (CTA): A simple question replacing sales language with curiosity ("Curious whether you've encountered similar challenges"). DO NOT ask for a meeting or calendar time.
8. Attachment Mention: Always include: "I am attaching our corporate overview and technical capabilities presentation for your reference."

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

${CAPABILITY_PRESENTATION_RULES}

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
