import { NextResponse } from "next/server";
import { createClient, requireUser } from "@/lib/supabase/server";

export async function GET() {
  try {
    const user = await requireUser();
    const supabase = await createClient();

    const { data: userDocs } = await supabase
      .from("knowledge_documents")
      .select("id")
      .eq("user_id", user.id);

    const docIds = (userDocs ?? []).map((d) => d.id);

    const [
      documents,
      chunks,
      connections,
      prospects,
      emails,
      recentSync,
    ] = await Promise.all([
      supabase
        .from("knowledge_documents")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
      docIds.length
        ? supabase
            .from("knowledge_chunks")
            .select("*", { count: "exact", head: true })
            .in("document_id", docIds)
        : Promise.resolve({ count: 0, data: null, error: null }),
      supabase
        .from("connections")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("prospects")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("generated_emails")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("sync_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    return NextResponse.json({
      stats: {
        documents: documents.count ?? 0,
        chunks: chunks.count ?? 0,
        connections: connections.count ?? 0,
        prospects: prospects.count ?? 0,
        emails: emails.count ?? 0,
      },
      recentActivity: recentSync.data ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
