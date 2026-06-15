import { generateWithFallback } from "@/ai/generation";
import type { RelationshipIntelligence } from "@/types/database";

export interface RelationshipEvaluationInput {
  conversationSummary?: string | null;
  discussionTopics?: string | null;
  interactionTimeline?: string | null;
  recentHighlights?: string | null;
  messageCount?: number;
  lastInteractionDate?: string | null;
  relationshipScore?: string | null;
  relationshipClassification?: string | null;
  connectionOwnerName?: string | null;
  engagementQuality?: string | null;
}

export async function evaluateRelationshipIntelligence(
  input: RelationshipEvaluationInput
): Promise<RelationshipIntelligence> {
  if (
    input.relationshipClassification === "no_conversation_history" ||
    (!input.conversationSummary && (!input.messageCount || input.messageCount === 0))
  ) {
    return {
      relationshipType: "cold-outreach",
      confidence: 100,
      reasoning: "No prior conversation history detected.",
      outreachGoal: "cold_introduction",
      capabilityProminence: "high"
    };
  }

  const prompt = `
You are an expert Relationship Intelligence evaluator for a B2B technology consultancy.
Your job is to analyze the conversation history and metadata between us and a prospect, and automatically classify the exact state of the relationship.

This intelligence will completely drive how our outreach email is generated.

--- INPUTS ---
Conversation Summary: ${input.conversationSummary || "None available."}
Discussion Topics: ${input.discussionTopics || "None available."}
Interaction Timeline: ${input.interactionTimeline || "None available."}
Recent Highlights: ${input.recentHighlights || "None available."}
Message Count: ${input.messageCount || 0}
Last Interaction Date: ${input.lastInteractionDate || "Unknown"}
Engagement Quality: ${input.engagementQuality || "Unknown"}
Raw Classification/Score: ${input.relationshipClassification || "Unknown"} (Score: ${input.relationshipScore || "N/A"})
Connection Owner: ${input.connectionOwnerName || "Unknown"}

--- REQUIRED OUTPUT FORMAT ---
You must return a raw JSON object (NO markdown formatting, NO \`\`\`json block). The JSON must exactly match this schema:

{
  "relationshipType": "cold-outreach" | "dormant-relationship" | "warm-relationship" | "active-relationship" | "past-customer" | "referral-relationship",
  "confidence": number, // 0 to 100
  "reasoning": string, // Detailed explanation of why you chose this classification and goal based on the history.
  "outreachGoal": "reconnect" | "follow_up" | "introduction_request" | "opportunity_exploration" | "partnership_discussion" | "cold_introduction",
  "capabilityProminence": "low" | "medium" | "high"
}

--- RELATIONSHIP TYPES DEFINITIONS ---
"cold-outreach": No prior interaction, or extremely generic/unresponsive connection.
"dormant-relationship": We interacted in the past, but there has been a significant gap in time (e.g., > 6-12 months).
"warm-relationship": Recent positive interactions, casual catchups, but no active deal.
"active-relationship": Frequent, ongoing back-and-forth explicitly about business challenges or active collaboration.
"past-customer": Explicit mention in the history that we successfully delivered a project or they were a client.
"referral-relationship": The connection owner or history explicitly mentions that someone referred them or made an introduction.

--- CAPABILITY PROMINENCE RULES ---
"low": Use for dormant relationships or purely referral-based intros where pushing capabilities hard will ruin the rapport. Focus primarily on the relationship.
"medium": Use for warm relationships where capabilities can be naturally woven into recent discussion topics.
"high": Use for cold-outreach (must establish value immediately) and active-relationships/past-customers (where they are ready to talk solutions).
`;

  try {
    const rawResult = await generateWithFallback(
      prompt,
      "RELATIONSHIP_INTELLIGENCE",
      { isJson: true }
    );

    const parsed = JSON.parse(rawResult.text) as RelationshipIntelligence;
    
    // Ensure we have fallback if model outputs something unexpected
    if (!parsed.relationshipType) {
      parsed.relationshipType = "cold-outreach";
      parsed.capabilityProminence = "high";
    }
    
    return parsed;
  } catch (error) {
    console.error("Error evaluating relationship intelligence:", error);
    return {
      relationshipType: "cold-outreach",
      confidence: 0,
      reasoning: "Fallback due to evaluation error.",
      outreachGoal: "cold_introduction",
      capabilityProminence: "high"
    };
  }
}
