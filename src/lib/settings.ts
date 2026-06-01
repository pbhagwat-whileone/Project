import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export async function getDriveFolderId(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("user_settings")
    .select("google_drive_folder_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (data?.google_drive_folder_id) {
    return data.google_drive_folder_id;
  }

  return process.env.GOOGLE_DRIVE_FOLDER_ID || null;
}

export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}
