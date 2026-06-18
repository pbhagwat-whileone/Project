import { generateWithFallback } from "@/services/ai/generation/generation";
import type { CompanyContext, CompanyContextRelevance } from "@/types/database";

export interface RelevanceEvaluationInput {
  conversationSummary?: string | null;
  discussionTopics?: string | null;
  companyContext: CompanyContext | null;
  relationshipMetadata: {
    lastContactDate?: string | null;
    totalMessages?: number;
    daysSinceLastInteraction?: number | null;
    relationshipStrength?: string | null;
    relationshipClassification?: string | null;
  };
}

export async function evaluateCompanyContextRelevance(
  input: RelevanceEvaluationInput
): Promise<CompanyContextRelevance | null> {
  if (!input.companyContext) return null;

  const prompt = `
You are evaluating whether recent company intelligence is genuinely useful and appropriate for an outreach email.
Our core philosophy: Relationship Context > Conversation History > Company Context > Generic Personalization.

Do not assume company news is relevant.
Recent company initiatives do not automatically justify outreach.
Relationship history must be considered first.
Conversation history must be considered before company context.
If the relationship is old and company context is unrelated to prior discussions, prefer ignore or light_reference.

Evaluate the relevance based on the following inputs:

--- INPUTS ---
Conversation Summary: ${input.conversationSummary || "None available."}
Discussion Topics: ${input.discussionTopics || "None available."}

Relationship Metadata:
- Last Contact Date: ${input.relationshipMetadata.lastContactDate || "Unknown"}
- Total Messages: ${input.relationshipMetadata.totalMessages || 0}
- Days Since Last Interaction: ${input.relationshipMetadata.daysSinceLastInteraction ?? "Unknown"}
- Relationship Strength/Classification: ${input.relationshipMetadata.relationshipClassification || "Unknown"}

Company Intelligence (from Tavily):
- Summary: ${input.companyContext.summary}
- Key Initiatives: ${input.companyContext.keyInitiatives?.join(", ") || "None"}
- Hiring Signals: ${input.companyContext.hiringSignals?.join(", ") || "None"}
- Business Priorities: ${input.companyContext.businessPriorities?.join(", ") || "None"}

--- RULES ---
1. Interaction Recency (daysSinceLastInteraction):
   0-180 days: Company context can be used heavily.
   181-365 days: Use carefully.
   366-730 days: Prefer light references.
   731+ days: Usually ignore or use only as a conversation starter.

2. Topic Alignment:
   Evaluate overlap between previous discussion topics and company initiatives. High overlap allows stronger usage. Low overlap demands lighter usage or ignoring.

3. Relationship Strength:
   Strong relationships can tolerate more contextual outreach. Weak relationships should avoid forcing company context.

--- REQUIRED OUTPUT FORMAT ---
You must return a raw JSON object (NO markdown formatting, NO \`\`\`json block). The JSON must exactly match this schema:

{
  "relevanceScore": number, // 0 to 100
  "useCompanyContext": boolean,
  "reasoning": string, // Detailed explanation of why you chose this recommendation based on the rules.
  "recommendedUsage": "ignore" | "light_reference" | "conversation_starter" | "primary_outreach_angle"
}

"ignore": Company context should not appear in the email.
"light_reference": Brief mention only. Do not build the email around it.
"conversation_starter": Can be used as a reason to reconnect, but still relationship-first.
"primary_outreach_angle": Allowed only when relationship is recent, topics align, and initiatives align.
`;

  try {
    const rawResult = await generateWithFallback(
      prompt,
      "COMPANY_CONTEXT_RELEVANCE",
      { isJson: true }
    );

    const parsed = JSON.parse(rawResult.text) as CompanyContextRelevance;
    return parsed;
  } catch (error) {
    console.error("Error evaluating company context relevance:", error);
    return null; // Fail safe
  }
}
