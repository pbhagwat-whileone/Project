import { NextResponse } from "next/server";
import { getAuthenticatedClient } from "@/services/google-oauth";
import { getAppUrl, getDriveFolderIds } from "@/lib/settings";
import { createClient, requireUser } from "@/lib/supabase/server";
import { syncKnowledgeBase } from "@/services/knowledge-sync";

export async function POST() {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const folderIds = await getDriveFolderIds(supabase, user.id);

    if (!folderIds || folderIds.length === 0) {
      return NextResponse.json(
        { error: "No Google Drive folder IDs configured" },
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
      folderIds
    );

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
