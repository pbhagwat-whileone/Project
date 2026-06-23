import { NextResponse } from "next/server";
import { getAuthenticatedClient } from "@/services/integrations/google/googleOauth";
import { getAppUrl, getDriveFolderIds } from "@/lib/settings";
import { createClient, requireUser } from "@/infrastructure/database/supabase/server";
import { syncKnowledgeBase } from "@/domains/knowledge/services/knowledgeSync";
import { syncCaseStudiesSheet } from "@/domains/emails/services/caseStudiesSync";

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

    const { data: settings } = await supabase
      .from("user_settings")
      .select("case_studies_sheet_url")
      .eq("user_id", user.id)
      .single();

    if (settings?.case_studies_sheet_url) {
      try {
        await syncCaseStudiesSheet(supabase, user.id, auth, settings.case_studies_sheet_url);
      } catch (err) {
        console.error("Failed to sync case studies sheet:", err);
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
