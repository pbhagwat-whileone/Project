import { NextResponse } from "next/server";
import { createClient, requireUser } from "@/infrastructure/database/supabase/server";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("q")?.toLowerCase() ?? "";

    const { data: documents, error } = await supabase
      .from("knowledge_documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const withCounts = await Promise.all(
      (documents ?? []).map(async (doc) => {
        const { count } = await supabase
          .from("knowledge_chunks")
          .select("*", { count: "exact", head: true })
          .eq("document_id", doc.id);

        return { ...doc, chunk_count: count ?? 0 };
      })
    );

    const filtered = search
      ? withCounts.filter((d) =>
          d.document_name.toLowerCase().includes(search)
        )
      : withCounts;

    return NextResponse.json({ documents: filtered });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
