import { NextResponse } from "next/server";
import { createClient, requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const supabase = await createClient();

    // Use RPC or distinct query to get owners. Since distinct isn't natively supported easily in supabase JS,
    // we can either create a view/rpc or just fetch and dedupe in memory if not too many. 
    // Wait, we can use `select('connection_owner_name')` and then deduplicate in javascript.
    // Or we could use a custom rpc if we had one. Let's fetch all connection_owner_names and dedupe.
    // Since there could be many connections, fetching all might be heavy. Let's see if we can use an RPC or just fetch.
    // Actually, Supabase has `from('connections').select('connection_owner_name').eq('user_id', user.id)` but we'd have to download all rows.
    // Let's create an RPC or a view in a migration? Or just fetch in JS for now. Let's fetch and dedupe.
    
    // Instead of downloading all connections, we can group by. Supabase doesn't natively support GROUP BY without RPC.
    // Let's do a basic fetch. For large tables, an RPC is better.
    // For now, let's fetch all and dedupe.
    
    const { data, error } = await supabase
      .from("connections")
      .select("connection_owner_name")
      .eq("user_id", user.id);

    if (error) throw error;

    const owners = Array.from(new Set(data.map((r: any) => r.connection_owner_name).filter(Boolean)));
    owners.sort();

    return NextResponse.json({ owners });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch owners";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
