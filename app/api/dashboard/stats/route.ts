import { NextResponse } from "next/server";
import { createClient, requireUser } from "@/infrastructure/database/supabase/server";
import { fetchAllRecords } from "@/infrastructure/database/supabase/supabaseUtils";

export async function GET() {
  try {
    const user = await requireUser();
    const supabase = await createClient();

    const { data: userDocs } = await supabase
      .from("knowledge_documents")
      .select("id");

    const docIds = (userDocs ?? []).map((d) => d.id);

    const connectionsQuery = supabase
      .from("connections")
      .select("id, company, connection_owner_name, created_at");

    const connectionsData = await fetchAllRecords<{id: string; company: string | null; connection_owner_name: string; created_at: string}>(connectionsQuery);

    const uniqueCompanies = new Set(
      connectionsData
        .map((c) => c.company?.trim())
        .filter((c): c is string => Boolean(c))
    );

    // Group connection sources
    const sourcesMap = new Map<string, { connections: number; companies: Set<string>; lastImport: string }>();
    connectionsData.forEach((c) => {
      const owner = c.connection_owner_name || "Unknown";
      if (!sourcesMap.has(owner)) {
        sourcesMap.set(owner, { connections: 0, companies: new Set(), lastImport: "" });
      }
      const source = sourcesMap.get(owner)!;
      source.connections++;
      if (c.company) {
        source.companies.add(c.company.trim());
      }
      if (!source.lastImport || new Date(c.created_at) > new Date(source.lastImport)) {
        source.lastImport = c.created_at;
      }
    });

    const connectionSources = Array.from(sourcesMap.entries()).map(([owner, data]) => ({
      owner,
      connections: data.connections,
      companies: data.companies.size,
      lastImport: data.lastImport,
    }));
    connectionSources.sort((a, b) => b.connections - a.connections);

    const [
      documents,
      chunks,
      emails,
      recentSync,
    ] = await Promise.all([
      supabase
        .from("knowledge_documents")
        .select("*", { count: "exact", head: true }),
      docIds.length
        ? supabase
            .from("knowledge_chunks")
            .select("*", { count: "exact", head: true })
            .in("document_id", docIds)
        : Promise.resolve({ count: 0, data: null, error: null }),
      supabase
        .from("generated_emails")
        .select("*", { count: "exact", head: true }),
        supabase
        .from("sync_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const logs = recentSync.data ?? [];
    const recentActivity = logs
      .sort((a, b) => {
        const networkKeywords = ["imported", "uploaded", "deleted", "refreshed"];
        const aMsg = (a.message || "").toLowerCase();
        const bMsg = (b.message || "").toLowerCase();
        
        const aIsNetwork = networkKeywords.some((k) => aMsg.includes(k));
        const bIsNetwork = networkKeywords.some((k) => bMsg.includes(k));
        
        if (aIsNetwork && !bIsNetwork) return -1;
        if (!aIsNetwork && bIsNetwork) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })
      .slice(0, 10);

    return NextResponse.json({
      stats: {
        documents: documents.count ?? 0,
        chunks: chunks.count ?? 0,
        connections: connectionsData.length,
        prospects: uniqueCompanies.size,
        emails: emails.count ?? 0,
      },
      connectionSources,
      recentActivity,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
