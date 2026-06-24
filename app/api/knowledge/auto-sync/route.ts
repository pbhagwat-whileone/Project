import { NextResponse } from "next/server";
import { createAdminClient } from "@/infrastructure/database/supabase/admin";
import { syncKnowledgeBase } from "@/domains/knowledge/services/knowledgeSync";
import { getAuthenticatedClient } from "@/services/integrations/google/googleOauth";
import { getAppUrl } from "@/lib/settings";
import { syncCaseStudiesSheet } from "@/domains/emails/services/caseStudiesSync";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST() {
  try {
    const supabase = createAdminClient();


    const { data } = await (supabase as any).from("global_sync_state").select("*").eq("id", 1).single();
    const state = data as any;
    if (state?.last_successful_sync) {
      const lastSync = new Date(state.last_successful_sync).getTime();
      const sixHours = 6 * 60 * 60 * 1000;
      if (Date.now() - lastSync < sixHours) {
         return NextResponse.json({ status: 'up_to_date' });
      }
    }

    // Try to acquire global sync lock
    const { data: lockAcquired, error: lockError } = await (supabase as any).rpc("acquire_sync_lock");
    
    if (lockError) {
      console.error("Lock error:", lockError);
      return NextResponse.json({ status: 'error', message: lockError.message }, { status: 500 });
    }

    if (!lockAcquired) {
      return NextResponse.json({ status: 'locked_or_recent', message: 'Sync in progress or lock not acquired' });
    }

    // Fetch all users with google drive folder ids
    // Fetch all users with google drive folder ids or case studies sheet
    const { data: allSettings, error: settingsError } = await supabase
      .from("user_settings")
      .select("user_id, google_drive_folder_ids, case_studies_sheet_url");

    if (settingsError || !allSettings || allSettings.length === 0) {
      await (supabase as any).from("global_sync_state").update({ sync_in_progress: false }).eq("id", 1);
      return NextResponse.json({ status: 'no_users', message: 'No users configured for sync' });
    }

    const redirectUri = `${getAppUrl()}/api/google/callback`;
    let totalDocs = 0;
    const errors: string[] = [];

    for (const setting of allSettings) {
      const hasFolders = setting.google_drive_folder_ids && setting.google_drive_folder_ids.length > 0;
      const hasCaseStudies = !!setting.case_studies_sheet_url;

      if (!hasFolders && !hasCaseStudies) continue;
      
      try {
        const auth = await getAuthenticatedClient(supabase, setting.user_id, redirectUri);
        if (auth) {
          if (hasFolders) {
            const result = await syncKnowledgeBase(supabase, setting.user_id, auth, setting.google_drive_folder_ids!);
            totalDocs += result.documentsProcessed;
          }
          if (hasCaseStudies) {
            try {
              await syncCaseStudiesSheet(supabase, setting.user_id, auth, setting.case_studies_sheet_url!);
            } catch (sheetErr) {
              console.error(`Case studies sync error for user ${setting.user_id}:`, sheetErr);
              // don't fail the entire job, just log it. You can push to errors if you want it to show up in logs.
              errors.push(`User ${setting.user_id} (Sheet): ${sheetErr instanceof Error ? sheetErr.message : 'Unknown error'}`);
            }
          }
        }
      } catch (err) {
        console.error(`Sync error for user ${setting.user_id}:`, err);
        errors.push(`User ${setting.user_id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    const isSuccess = errors.length === 0;

    await (supabase as any).from("global_sync_state").update({
      sync_in_progress: false,
      last_successful_sync: isSuccess ? new Date().toISOString() : undefined
    }).eq("id", 1);

    return NextResponse.json({
      status: 'completed',
      processed: totalDocs,
      errors
    });

  } catch (error) {
    console.error("Auto sync global error:", error);
    const supabase = createAdminClient();
    await (supabase as any).from("global_sync_state").update({ sync_in_progress: false }).eq("id", 1);

    return NextResponse.json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
