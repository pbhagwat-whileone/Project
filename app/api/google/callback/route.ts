import { NextResponse } from "next/server";
import { exchangeCodeForTokens, saveTokens } from "@/services/integrations/google/googleOauth";
import { getAppUrl } from "@/lib/settings";
import { createClient } from "@/infrastructure/database/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${getAppUrl()}/settings?error=google`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${getAppUrl()}/login`);
  }

  try {
    const redirectUri = `${getAppUrl()}/api/google/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    await saveTokens(supabase, user.id, tokens);
    return NextResponse.redirect(`${getAppUrl()}/settings?google=connected`);
  } catch {
    return NextResponse.redirect(`${getAppUrl()}/settings?error=google`);
  }
}
