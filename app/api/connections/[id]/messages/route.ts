import { NextResponse } from "next/server";
import { createClient, requireUser } from "@/infrastructure/database/supabase/server";
import { createUrlPattern } from "@/lib/shared/formatUtils";
import { rankContactsWithMetrics, scorePosition } from "@/domains/companies/services/companyUtils";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const supabase = await createClient();

    // Fetch the connection to get the profile_url
    const { data: connection } = await supabase
      .from("connections")
      .select("id, first_name, last_name, company, position, email, profile_url")
      .eq("id", id)
      .single();

    if (!connection || !connection.profile_url) {
      return NextResponse.json({ messages: [], metrics: null });
    }

    const urlPattern = createUrlPattern(connection.profile_url);



    const combined = await supabase
      .from("linkedin_messages")
      .select("*")
      .or(`from_profile_url.ilike.${urlPattern},to_profile_url.ilike.${urlPattern}`)
      .order("date", { ascending: false });


    const messages = combined.data;

    const { data: dbMetrics } = await supabase
      .from("connection_relationship_metrics")
      .select("*")
      .eq("connection_id", id)
      .single();

    let returnedMetrics: any = dbMetrics || {
      connection_id: id,
      conversation_count: 0,
      relationship_classification: null,
      conversation_summary: null,
      message_count: 0,
      last_contact_date: null,
      relationship_score: 0
    };

    if (messages && messages.length > 0) {
      returnedMetrics.message_count = messages.length;
      returnedMetrics.last_contact_date = messages[0].date;
    } else {
      returnedMetrics.message_count = returnedMetrics.message_count || 0;
    }

    const rankedContact = rankContactsWithMetrics([{
      ...connection,
      score: scorePosition(connection.position)
    } as any], { [id]: returnedMetrics })[0];

    returnedMetrics.relationship_score = rankedContact.relationship_score;

    return NextResponse.json({ messages: messages || [], metrics: returnedMetrics });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load messages";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
