import { NextResponse } from "next/server";
import { settingsSchema } from "@/lib/validators";
import { createClient, requireUser } from "@/lib/supabase/server";

export async function GET() {
  try {
    const user = await requireUser();
    const supabase = await createClient();

    const [{ data: settings }, { data: lastSync }, { data: googleToken }] =
      await Promise.all([
        supabase
          .from("user_settings")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("sync_logs")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("google_tokens")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

    return NextResponse.json({
      google_drive_folder_ids:
        settings?.google_drive_folder_ids ??
        (process.env.GOOGLE_DRIVE_FOLDER_ID ? [process.env.GOOGLE_DRIVE_FOLDER_ID] : []),
      last_sync: lastSync,
      google_connected: Boolean(googleToken),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = settingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { error } = await supabase.from("user_settings").upsert({
      user_id: user.id,
      google_drive_folder_ids: parsed.data.google_drive_folder_ids,
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
