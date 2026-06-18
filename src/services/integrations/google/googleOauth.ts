import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/documents.readonly",
];

export function getOAuth2Client(redirectUri: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

export function getAuthorizationUrl(redirectUri: string): string {
  const oauth2 = getOAuth2Client(redirectUri);
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
) {
  const oauth2 = getOAuth2Client(redirectUri);
  const { tokens } = await oauth2.getToken(code);
  return tokens;
}

export async function getAuthenticatedClient(
  supabase: SupabaseClient<Database>,
  userId: string,
  redirectUri: string
) {
  const { data: tokenRow, error } = await supabase
    .from("google_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !tokenRow) {
    return null;
  }

  const oauth2 = getOAuth2Client(redirectUri);
  oauth2.setCredentials({
    access_token: tokenRow.access_token,
    refresh_token: tokenRow.refresh_token ?? undefined,
    expiry_date: tokenRow.expiry
      ? new Date(tokenRow.expiry).getTime()
      : undefined,
  });

  oauth2.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await supabase.from("google_tokens").upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? tokenRow.refresh_token,
        expiry: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : tokenRow.expiry,
        updated_at: new Date().toISOString(),
      });
    }
  });

  return oauth2;
}

export async function saveTokens(
  supabase: SupabaseClient<Database>,
  userId: string,
  tokens: {
    access_token?: string | null;
    refresh_token?: string | null;
    expiry_date?: number | null;
  }
) {
  if (!tokens.access_token) {
    throw new Error("No access token received");
  }

  const { error } = await supabase.from("google_tokens").upsert({
    user_id: userId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expiry: tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}
