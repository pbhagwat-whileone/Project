import { NextResponse } from "next/server";
import { createClient, requireUser } from "@/lib/supabase/server";
import { fetchAllRecords } from "@/utils/supabase-utils";
import type { Connection } from "@/types/database";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("q")?.toLowerCase() ?? "";
    const company = searchParams.get("company")?.toLowerCase() ?? "";

    let query = supabase
      .from("connections")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true });

    let fetched: Connection[] = await fetchAllRecords<Connection>(query);
    
    // Group connections by profile_url (or fallback) to merge connection_owner_name
    const uniqueMap = new Map<string, Connection & { connection_owners?: string[] }>();
    fetched.forEach((c) => {
      const key = c.profile_url?.toLowerCase()?.trim() || `${c.first_name?.toLowerCase()?.trim() || ""}|${c.last_name?.toLowerCase()?.trim() || ""}|${c.company?.toLowerCase()?.trim() || ""}`;
      
      if (uniqueMap.has(key)) {
        const existing = uniqueMap.get(key)!;
        if (c.connection_owner_name && !existing.connection_owners!.includes(c.connection_owner_name)) {
          existing.connection_owners!.push(c.connection_owner_name);
        }
      } else {
        uniqueMap.set(key, { ...c, connection_owners: c.connection_owner_name ? [c.connection_owner_name] : [] });
      }
    });

    let filtered = Array.from(uniqueMap.values()).map(c => ({
      ...c,
      connection_owner_name: c.connection_owners?.join(", ")
    })) as Connection[];

    if (search) {
      filtered = filtered.filter((c) => {
        const haystack = [
          c.first_name,
          c.last_name,
          c.company,
          c.position,
          c.email,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(search);
      });
    }

    if (company) {
      filtered = filtered.filter((c) =>
        c.company?.toLowerCase().includes(company)
      );
    }

    const owner = searchParams.get("owner");
    if (owner && owner !== "All Owners") {
      filtered = filtered.filter((c: any) => c.connection_owners?.includes(owner));
    }

    return NextResponse.json({ connections: filtered });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
