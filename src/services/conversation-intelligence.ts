import { generateWithFallback } from "@/ai/generation";
import type { LinkedinMessage } from "@/types/database";

export type ConversationIntelligence = {
  relationship_summary: string;
  discussion_topics: string[];
  interaction_timeline: string;
  recent_highlights: string;
  relationship_classification: "Cold Outreach" | "Warm Introduction" | "Former Colleague" | "Existing Contact" | "Partner" | "Client";
  key_interests: string[];
  business_context: string;
  action_items: string[];
  engagement_quality: "High" | "Medium" | "Low";
  recommended_outreach_angle: string;
  personalization_points: string[];
};

export async function generateConversationIntelligence(
  messages: LinkedinMessage[],
  contactName: string,
  contactCompany: string | null,
  connectionOwnerName?: string
): Promise<ConversationIntelligence> {
  if (!messages || messages.length === 0) {
    throw new Error("No messages provided for summarization");
  }

  // Sort oldest to newest for chronological reading
  const sorted = [...messages].sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());

  const totalMessages = sorted.length;
  const firstMessageDate = sorted[0].date ? new Date(sorted[0].date || 0) : new Date();
  const lastMessageDate = sorted[sorted.length - 1].date ? new Date(sorted[sorted.length - 1].date || 0) : new Date();
  
  const conversationDurationMs = lastMessageDate.getTime() - firstMessageDate.getTime();
  const conversationDurationYears = conversationDurationMs / (1000 * 60 * 60 * 24 * 365.25);
  const averageMessagesPerYear = conversationDurationYears > 0 ? (totalMessages / conversationDurationYears).toFixed(1) : totalMessages.toString();
  const daysSinceLastContact = Math.floor((new Date().getTime() - lastMessageDate.getTime()) / (1000 * 60 * 60 * 24));

  // Token Management: If too many messages, preserve chronology but truncate the middle
  let transcriptMessages = sorted;
  const MAX_MESSAGES = 40;
  let truncatedMessage = "";
  if (totalMessages > MAX_MESSAGES) {
    const keepFirst = 10;
    const keepLast = 30;
    const omittedCount = totalMessages - (keepFirst + keepLast);
    
    transcriptMessages = [
      ...sorted.slice(0, keepFirst),
      { ...sorted[keepFirst], content: `\n\n[... ${omittedCount} messages omitted to preserve context length ...]\n\n` } as any,
      ...sorted.slice(sorted.length - keepLast)
    ];
  }

  // Format transcript with sender names
  const ownerName = connectionOwnerName || "User";
  
  const transcript = transcriptMessages.map(m => {
    if ((m as any).content?.includes("messages omitted")) return (m as any).content;
    const dateStr = m.date ? new Date(m.date).toISOString().split('T')[0] : "Unknown Date";
    
    // Determine sender name based on from_name/to_name if available
    let senderName = "Unknown";
    if (m.from_name) {
      senderName = m.from_name;
    } else {
      // Fallback inference if from_name is missing (should not happen with new parser but just in case)
      // Usually we know who the contact is, and who the owner is.
      // We can just label it Sender/Receiver if we have no other data.
      senderName = "Sender";
    }

    return `================================================\n\nDate: ${dateStr}\n\n${senderName}:\n${m.content}\n\n================================================`;
  }).join("\n");

  const metadata = `Conversation Metadata

Contact Name: ${contactName}
Company: ${contactCompany || "Unknown"}

Total Messages: ${totalMessages}

First Interaction:
${firstMessageDate.toISOString().split('T')[0]}

Most Recent Interaction:
${lastMessageDate.toISOString().split('T')[0]}

Conversation Duration:
${conversationDurationYears > 0 ? conversationDurationYears.toFixed(1) + " years" : "< 1 year"}

Average Messages Per Year:
${averageMessagesPerYear}

Days Since Last Contact:
${daysSinceLastContact} days
`;

  const prompt = `You are an expert executive assistant analyzing a LinkedIn conversation history between ${ownerName} and a contact.

${metadata}

Below is the chronological transcript of their LinkedIn messages:

${transcript}

Analyze this conversation and provide structured intelligence.
You MUST respond in pure JSON format matching this EXACT structure (do not include markdown block formatting):
{
  "relationship_summary": "A 2-3 sentence overall summary of the relationship and how they know each other.",
  "discussion_topics": ["Topic 1", "Topic 2", "Topic 3"],
  "interaction_timeline": "A brief 1-2 sentence summary of when they last spoke and the frequency of interaction.",
  "recent_highlights": "1-2 sentences highlighting the most recent or most important action items, questions, or context from the latest messages.",
  "relationship_classification": "Must be exactly one of: Cold Outreach, Warm Introduction, Former Colleague, Existing Contact, Partner, Client",
  "key_interests": ["Interest 1", "Interest 2"],
  "business_context": "Concise explanation of what business topics have historically been discussed.",
  "action_items": ["Action 1", "Action 2"],
  "engagement_quality": "High, Medium, or Low",
  "recommended_outreach_angle": "A short recommendation describing the best way to re-engage this contact.",
  "personalization_points": ["Detail 1", "Detail 2"]
}

Ensure the JSON is strictly valid. Do not include any other text.`;

  const res = await generateWithFallback(prompt, "CONVERSATION_SUMMARY");
  const rawText = res.text?.trim();
  
  if (!rawText) {
    throw new Error("Failed to generate intelligence from AI");
  }

  try {
    let jsonStr = rawText;
    if (jsonStr.includes("\`\`\`json")) {
      jsonStr = jsonStr.split("\`\`\`json")[1].split("\`\`\`")[0].trim();
    } else if (jsonStr.includes("\`\`\`")) {
      jsonStr = jsonStr.split("\`\`\`")[1].split("\`\`\`")[0].trim();
    }
    return JSON.parse(jsonStr) as ConversationIntelligence;
  } catch (err) {
    console.error("JSON parsing failed. Raw response:", rawText);
    throw new Error("Failed to parse intelligence JSON");
  }
}

