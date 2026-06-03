import { NextResponse } from "next/server";
import { getAuthorizationUrl } from "@/services/google-oauth";
import { getAppUrl } from "@/lib/settings";
import { requireUser } from "@/lib/supabase/server";

export async function GET() {
  try {
    await requireUser();
    const redirectUri = `${getAppUrl()}/api/google/callback`;
    const url = getAuthorizationUrl(redirectUri);
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
