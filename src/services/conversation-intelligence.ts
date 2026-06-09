import { generateWithFallback } from "@/ai/generation";
import type { LinkedinMessage } from "@/types/database";

export type ConversationIntelligence = {
  relationship_summary: string;
  discussion_topics: string;
  interaction_timeline: string;
  recent_highlights: string;
  relationship_classification: "Cold Outreach" | "Warm Introduction" | "Former Colleague" | "Existing Contact" | "Partner" | "Client";
};

export async function generateConversationIntelligence(
  messages: LinkedinMessage[],
  contactName: string,
  contactCompany: string | null
): Promise<ConversationIntelligence> {
  if (!messages || messages.length === 0) {
    throw new Error("No messages provided for summarization");
  }

  // Sort oldest to newest for chronological reading
  const sorted = [...messages].sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());

  // Format transcript
  const transcript = sorted.map(m => {
    const dateStr = m.date ? new Date(m.date).toLocaleDateString() : "Unknown Date";
    // determine sender based on whether it was "from" the user or "to" the user
    // Since we don't have the user's exact profile URL here, we just provide the raw content and let the LLM infer
    return `[${dateStr}]\n${m.content}`;
  }).join("\n\n---\n\n");

  const prompt = `You are an expert executive assistant analyzing a LinkedIn conversation history between a user and a contact.

Contact Name: ${contactName}
Contact Company: ${contactCompany || "Unknown"}

Below is the chronological transcript of their LinkedIn messages:

${transcript}

Analyze this conversation and provide structured intelligence.
You MUST respond in pure JSON format matching this EXACT structure (do not include markdown block formatting):
{
  "relationship_summary": "A 2-3 sentence overall summary of the relationship and how they know each other.",
  "discussion_topics": "A comma-separated list of 3-5 main topics they have discussed.",
  "interaction_timeline": "A brief 1-2 sentence summary of when they last spoke and the frequency of interaction.",
  "recent_highlights": "1-2 sentences highlighting the most recent or most important action items, questions, or context from the latest messages.",
  "relationship_classification": "Must be exactly one of: Cold Outreach, Warm Introduction, Former Colleague, Existing Contact, Partner, Client"
}

Ensure the JSON is strictly valid. Do not include any other text.`;

  const res = await generateWithFallback(prompt, "CONVERSATION_SUMMARY");
  const rawText = res.text?.trim();
  
  if (!rawText) {
    throw new Error("Failed to generate intelligence from AI");
  }

  try {
    let jsonStr = rawText;
    if (jsonStr.includes("```json")) {
      jsonStr = jsonStr.split("```json")[1].split("```")[0].trim();
    } else if (jsonStr.includes("```")) {
      jsonStr = jsonStr.split("```")[1].split("```")[0].trim();
    }
    return JSON.parse(jsonStr) as ConversationIntelligence;
  } catch (err) {
    console.error("JSON parsing failed. Raw response:", rawText);
    throw new Error("Failed to parse intelligence JSON");
  }
}
