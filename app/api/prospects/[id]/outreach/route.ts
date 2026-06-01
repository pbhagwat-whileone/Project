import { NextResponse } from "next/server";
import { createClient, requireUser } from "@/lib/supabase/server";
import { findBestContact } from "@/utils/company-matching";
import { searchKnowledgeChunks } from "@/services/vector-search";
import { generateOutreachEmail } from "@/services/email-generator";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const supabase = await createClient();

    const { data: prospect, error } = await supabase
      .from("prospects")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !prospect) {
      return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
    }

    const { data: connections } = await supabase
      .from("connections")
      .select("*")
      .eq("user_id", user.id);

    const contact = findBestContact(
      prospect.company_name,
      connections ?? []
    );

    if (!contact) {
      return NextResponse.json({
        contact: null,
        projects: [],
        email: null,
        message: "No connection found.",
      });
    }

    const query = `${prospect.company_name} ${contact.position ?? ""}`.trim();
    const projects = await searchKnowledgeChunks(supabase, user.id, query, 3);

    const emailContent = await generateOutreachEmail({
      targetCompany: prospect.company_name,
      contact,
      projects,
      prospectNotes: prospect.notes ?? undefined,
    });

    const contactName = [contact.first_name, contact.last_name]
      .filter(Boolean)
      .join(" ");

    const { data: savedEmail, error: emailError } = await supabase
      .from("generated_emails")
      .insert({
        user_id: user.id,
        company_name: prospect.company_name,
        contact_name: contactName || null,
        subject: emailContent.subject,
        body: emailContent.body,
      })
      .select()
      .single();

    if (emailError) throw emailError;

    return NextResponse.json({
      contact,
      projects: projects.map((p) => ({
        ...p,
        summary: p.chunk_text.slice(0, 200),
      })),
      email: savedEmail,
      message: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Outreach failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
