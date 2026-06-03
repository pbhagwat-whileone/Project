import { NextResponse } from "next/server";
import { emailRefineSchema } from "@/lib/validators";
import { createClient, requireUser } from "@/lib/supabase/server";
import { refineOutreachEmail } from "@/services/email-generator";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const parsed = emailRefineSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify email belongs to user
    const { data: existingEmail, error: fetchError } = await supabase
      .from("generated_emails")
      .select("*")
      .eq("id", parsed.data.email_id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !existingEmail) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    const provider = parsed.data.provider || existingEmail.provider_used || "gemini";
    const relationship = parsed.data.context?.relationship || existingEmail.relationship_type || "Unknown Relationship";

    const refinedContent = await refineOutreachEmail(
      parsed.data.current_subject,
      parsed.data.current_body,
      parsed.data.instructions,
      provider,
      {
        company: existingEmail.company_name,
        contactName: existingEmail.contact_name || "Unknown",
        relationship: relationship,
      }
    );

    // Build the new history object
    const historyEntry = {
      timestamp: new Date().toISOString(),
      instruction: parsed.data.instructions,
      provider: provider,
      previous_subject: parsed.data.current_subject,
      previous_body: parsed.data.current_body,
    };

    let existingHistory = existingEmail.refinement_history || [];
    if (!Array.isArray(existingHistory)) {
      existingHistory = [];
    }

    const newHistory = [...existingHistory, historyEntry];

    // Update DB
    const { data: updatedEmail, error: updateError } = await supabase
      .from("generated_emails")
      .update({
        subject: refinedContent.subject,
        body: refinedContent.body,
        edited_content: refinedContent.body,
        refinement_history: newHistory,
      })
      .eq("id", existingEmail.id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ email: updatedEmail });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refinement failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
