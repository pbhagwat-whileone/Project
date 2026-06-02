import { NextResponse } from "next/server";
import { createClient, requireUser } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const supabase = await createClient();

    const { error } = await supabase
      .from("generated_emails")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
