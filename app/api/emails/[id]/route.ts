import { NextResponse } from "next/server";
import { createClient, requireUser } from "@/infrastructure/database/supabase/server";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const supabase = await createClient();

    const { error } = await supabase
      .from("generated_emails")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const body = await request.json();

    const { emailUpdateSchema } = await import("@/lib/validators");
    const parsed = emailUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: updatedEmail, error } = await supabase
      .from("generated_emails")
      .update({
        subject: parsed.data.subject,
        body: parsed.data.body,
        edited_content: parsed.data.body,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    if (!updatedEmail) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    return NextResponse.json({ email: updatedEmail });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
