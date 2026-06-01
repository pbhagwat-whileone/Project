import { NextResponse } from "next/server";
import { companySearchSchema } from "@/lib/validators";
import { createClient, requireUser } from "@/lib/supabase/server";
import { findBestContact } from "@/utils/company-matching";
import { searchKnowledgeChunks } from "@/services/vector-search";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = companySearchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: connections } = await supabase
      .from("connections")
      .select("*")
      .eq("user_id", user.id);

      const contact = findBestContact(
        parsed.data.company,
        connections ?? []
      );
      
      const query = contact
        ? `${parsed.data.company} ${contact.position ?? ""}`.trim()
        : parsed.data.company;
      
      const projects = await searchKnowledgeChunks(
        supabase,
        user.id,
        query,
        3
      );
      
      return NextResponse.json({
        contact,
        projects: projects.map((p) => ({
          ...p,
          summary: p.chunk_text.slice(0, 200),
        })),
        message: contact ? null : "No LinkedIn connection found.",
      });

    return NextResponse.json({
      contact,
      projects: projects.map((p) => ({
        ...p,
        summary: p.chunk_text.slice(0, 200),
      })),
      message: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
