import { NextResponse } from "next/server";
import { createClient, requireUser } from "@/lib/supabase/server";
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
      .order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    let filtered: Connection[] = data ?? [];

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

    return NextResponse.json({ connections: filtered });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
