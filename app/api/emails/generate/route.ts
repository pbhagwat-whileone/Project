import { NextResponse } from "next/server";
import { emailGenerateSchema } from "@/lib/validators";
import { createClient, requireUser } from "@/lib/supabase/server";
import { generateOutreachEmail } from "@/services/email-generator";
import { getRecommendationForEmail } from "@/services/prospect-recommendation";
import { searchKnowledgeChunks } from "@/services/vector-search";
import type { MatchedChunk, RankedContact } from "@/types/database";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();

    // TEMPORARY LOGGING: Inspect the full payload before schema validation
    console.log("[EMAIL GENERATE ROUTE] Incoming Payload:", JSON.stringify(body, null, 2));

    const parsed = emailGenerateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message },
        { status: 400 }
      );
    }
    const supabase = await createClient();
    let contact: RankedContact;
    let projects: MatchedChunk[];
    let recommendationReason = parsed.data.recommendation_reason;
    const recContext = await getRecommendationForEmail(
      supabase,
      user.id,
      parsed.data.company_name
    );

    if (parsed.data.projects?.length) {
      projects = parsed.data.projects as MatchedChunk[];
      contact = {
        id: parsed.data.contact_id ?? "",
        first_name: parsed.data.contact_name?.split(" ")[0] ?? null,
        last_name:
          parsed.data.contact_name?.split(" ").slice(1).join(" ") ?? null,
        company: parsed.data.company_name,
        position: parsed.data.position ?? null,
        email: parsed.data.email ?? null,
        profile_url: parsed.data.profile_url ?? null,
        score: 0,
      };
    } else if (recContext.recommendation?.topContact) {
      contact = recContext.recommendation.topContact;
      projects = recContext.matchingProjects;
      recommendationReason ??= recContext.recommendation.suggestedReason;
    } else {
      const query = `${parsed.data.company_name} ${parsed.data.position ?? ""}`;
      projects = await searchKnowledgeChunks(supabase, user.id, query, 3);
      contact = {
        id: "",
        first_name: parsed.data.contact_name?.split(" ")[0] ?? null,
        last_name:
          parsed.data.contact_name?.split(" ").slice(1).join(" ") ?? null,
        company: parsed.data.company_name,
        position: parsed.data.position ?? null,
        email: parsed.data.email ?? null,
        profile_url: parsed.data.profile_url ?? null,
        score: 0,
      };
    }

    const emailContent = await generateOutreachEmail({
      targetCompany: parsed.data.company_name,
      contact,
      projects,
      recommendationReason: recommendationReason ?? undefined,
      relationshipType: parsed.data.relationship_type ?? undefined,
      provider: parsed.data.provider ?? undefined,
    });

    const { data: saved, error } = await supabase
      .from("generated_emails")
      .insert({
        user_id: user.id,
        company_name: parsed.data.company_name,
        contact_name: parsed.data.contact_name ?? null,
        subject: emailContent.subject,
        body: emailContent.body,
        provider_used: parsed.data.provider ?? "gemini",
        relationship_type: parsed.data.relationship_type ?? "Unknown Relationship",
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ email: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
