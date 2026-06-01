import { NextResponse } from "next/server";
import { getAuthenticatedClient } from "@/google/oauth";
import { getAppUrl, getDriveFolderId } from "@/lib/settings";
import { createClient, requireUser } from "@/lib/supabase/server";
import { syncKnowledgeBase } from "@/services/knowledge-sync";

export async function POST() {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const folderId = await getDriveFolderId(supabase, user.id);

    if (!folderId) {
      return NextResponse.json(
        { error: "Google Drive folder ID is not configured" },
        { status: 400 }
      );
    }

    const redirectUri = `${getAppUrl()}/api/google/callback`;
    const auth = await getAuthenticatedClient(supabase, user.id, redirectUri);

    if (!auth) {
      return NextResponse.json(
        { error: "Connect Google Drive in Settings first" },
        { status: 400 }
      );
    }

    const result = await syncKnowledgeBase(
      supabase,
      user.id,
      auth,
      folderId
    );

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
