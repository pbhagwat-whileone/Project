import { NextResponse } from "next/server";
import { createClient, requireUser } from "@/lib/supabase/server";

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

    console.log("== DIAGNOSTICS START ==");
    console.log("REQUESTED ID:", id);
    console.log("CONNECTION OBJECT:", connection);

    if (!connection || !connection.profile_url) {
      console.log("EARLY RETURN: Connection has no profile_url!");
      return NextResponse.json({ messages: [], metrics: null });
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

    console.log("Connection Profile URL:", connection.profile_url);
    console.log("URL Pattern:", urlPattern);

    const fromMatches = await supabase
      .from("linkedin_messages")
      .select("id", { count: "exact" })
      .eq("user_id", user.id)
      .ilike("from_profile_url", urlPattern);

    const toMatches = await supabase
      .from("linkedin_messages")
      .select("id", { count: "exact" })
      .eq("user_id", user.id)
      .ilike("to_profile_url", urlPattern);

    const combined = await supabase
      .from("linkedin_messages")
      .select("*")
      .eq("user_id", user.id)
      .or(`from_profile_url.ilike.${urlPattern},to_profile_url.ilike.${urlPattern}`)
      .order("date", { ascending: false });

    console.log("FROM MATCHES:", fromMatches.count);
    console.log("TO MATCHES:", toMatches.count);
    console.log("COMBINED MATCHES:", combined.data?.length);

    const sample = await supabase
      .from("linkedin_messages")
      .select("*")
      .eq("user_id", user.id)
      .limit(5);

    console.log("SAMPLE ROWS:");
    sample.data?.forEach((row: any) => {
      console.log(`from: ${row.from_profile_url}`);
      console.log(`to: ${row.to_profile_url}`);
    });

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
