import { NextResponse } from "next/server";
import { recommendationOutreachSchema } from "@/lib/validators";
import { createClient, requireUser } from "@/lib/supabase/server";
import { generateOutreachEmail } from "@/services/email-generator";
import { getRecommendationForEmail } from "@/services/prospect-recommendation";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = recommendationOutreachSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { recommendation, matchingProjects } =
      await getRecommendationForEmail(
        supabase,
        user.id,
        parsed.data.company_name
      );

    if (!recommendation?.topContact) {
      return NextResponse.json(
        { error: "No contact found for this company" },
        { status: 404 }
      );
    }

    const emailContent = await generateOutreachEmail({
      targetCompany: recommendation.company,
      contact: recommendation.topContact,
      projects: matchingProjects,
      recommendationReason: recommendation.suggestedReason,
      relationshipType: parsed.data.relationship_type ?? undefined,
      provider: parsed.data.provider ?? undefined,
      model: parsed.data.model ?? undefined,
    });

    const contactName = [
      recommendation.topContact.first_name,
      recommendation.topContact.last_name,
    ]
      .filter(Boolean)
      .join(" ");

    const { data: savedEmail, error: emailError } = await supabase
      .from("generated_emails")
      .insert({
        user_id: user.id,
        company_name: recommendation.company,
        contact_name: contactName || null,
        subject: emailContent.subject,
        body: emailContent.body,
        provider_used: parsed.data.provider ?? "gemini",
        relationship_type: parsed.data.relationship_type ?? "Unknown Relationship",
      })
      .select()
      .single();

    if (emailError) throw emailError;

    return NextResponse.json({
      contact: recommendation.topContact,
      projects: matchingProjects.map((p) => ({
        ...p,
        summary: p.chunk_text.slice(0, 200),
      })),
      email: savedEmail,
      recommendation,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Outreach failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
