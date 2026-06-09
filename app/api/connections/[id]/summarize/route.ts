import { NextResponse } from "next/server";
import { createClient, requireUser } from "@/lib/supabase/server";
import { generateConversationIntelligence } from "@/services/conversation-intelligence";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const supabase = await createClient();

    // Fetch the connection
    const { data: connection } = await supabase
      .from("connections")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!connection || !connection.profile_url) {
      return NextResponse.json({ error: "Connection not found or missing profile URL" }, { status: 404 });
    }

    let urlPattern = "";
    try {
      const urlObj = new URL(connection.profile_url);
      const pathname = urlObj.pathname.replace(/\/$/, "").toLowerCase();
      urlPattern = `%${pathname}%`;
    } catch {
      const url = connection.profile_url.replace(/\/$/, "").toLowerCase();
      urlPattern = `%${url}%`;
    }

    // Fetch all messages for this connection
    const { data: messages } = await supabase
      .from("linkedin_messages")
      .select("*")
      .eq("user_id", user.id)
      .or(`from_profile_url.ilike.${urlPattern},to_profile_url.ilike.${urlPattern}`)
      .order("date", { ascending: true });

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "No messages found for this connection" }, { status: 400 });
    }

    const contactName = [connection.first_name, connection.last_name].filter(Boolean).join(" ");

    // Generate intelligence
    const intelligence = await generateConversationIntelligence(
      messages,
      contactName,
      connection.company
    );

    // Store in connection_relationship_metrics
    const { data: metrics, error: metricsError } = await supabase
      .from("connection_relationship_metrics")
      .upsert({
        connection_id: id,
        user_id: user.id,
        conversation_summary: intelligence.relationship_summary,
        discussion_topics: intelligence.discussion_topics,
        interaction_timeline: intelligence.interaction_timeline,
        recent_highlights: intelligence.recent_highlights,
        relationship_classification: intelligence.relationship_classification,
        message_count: messages.length,
        // keep conversation_count rough or calculate if needed
        updated_at: new Date().toISOString()
      }, { onConflict: "connection_id" })
      .select()
      .single();

    if (metricsError) throw metricsError;

    return NextResponse.json({ success: true, metrics });
  } catch (error) {
    console.error("Summarize Error:", error);
    const message = error instanceof Error ? error.message : "Failed to summarize conversation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
