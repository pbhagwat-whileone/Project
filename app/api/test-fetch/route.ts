import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRecords } from "@/utils/supabase-utils";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // We just query the first user we find
    const { data: users } = await supabase.from("connections").select("user_id").limit(1);
    const userId = users?.[0]?.user_id;

    if (!userId) {
      return NextResponse.json({ error: "No user found" });
    }

    const query = supabase
      .from("connections")
      .select("profile_url, first_name, last_name, company")
      .eq("user_id", userId)
      .order("id", { ascending: true });

    const existingConnections = await fetchAllRecords(query);

    return NextResponse.json({
      count: existingConnections.length,
      sample: existingConnections.slice(0, 3)
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
