import { NextResponse } from "next/server";
import { createClient, requireUser } from "@/lib/supabase/server";
import { createUrlPattern } from "@/utils/format-utils";

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
      .select("profile_url")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!connection || !connection.profile_url) {
      return NextResponse.json({ messages: [], metrics: null });
    }

    const urlPattern = createUrlPattern(connection.profile_url);



    const combined = await supabase
      .from("linkedin_messages")
      .select("*")
      .eq("user_id", user.id)
      .or(`from_profile_url.ilike.${urlPattern},to_profile_url.ilike.${urlPattern}`)
      .order("date", { ascending: false });


    const messages = combined.data;

    const { data: metrics } = await supabase
      .from("connection_relationship_metrics")
      .select("*")
      .eq("connection_id", id)
      .single();

    return NextResponse.json({ messages: messages || [], metrics: metrics || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load messages";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
