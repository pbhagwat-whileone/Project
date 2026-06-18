import { NextResponse } from "next/server";
import { createClient, requireUser } from "@/infrastructure/database/supabase/server";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ ownerName: string }> }
) {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const params = await context.params;
    const ownerName = decodeURIComponent(params.ownerName);

    if (!ownerName) {
      return NextResponse.json({ error: "Owner name required" }, { status: 400 });
    }

    // Delete connections for this owner (PostgreSQL CASCADE will handle related metrics)
    const { error } = await supabase
      .from("connections")
      .delete()
      .eq("connection_owner_name", ownerName);

    if (error) throw error;

    // Log the deletion activity
    await supabase.from("sync_logs").insert({
      user_id: user.id,
      status: "success",
      documents_processed: 0,
      message: `${ownerName} deleted their network`,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete network";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
