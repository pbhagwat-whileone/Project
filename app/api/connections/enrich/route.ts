import { NextResponse } from "next/server";
import { createClient, requireUser } from "@/infrastructure/database/supabase/server";
import { enrichProfile } from "@/services/integrations/tavily/tavilyProfileEnrichment";
import { getApolloEmailByLinkedInUrl } from "@/services/integrations/apollo/apollo";
import { fetchAllRecords } from "@/infrastructure/database/supabase/supabaseUtils";
import { isTaskAvailable } from "@/services/ai/generation/generation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const supabase = await createClient();

    // 1. Fail Fast: Check if enrichment task models are available
    if (!isTaskAvailable("PROFILE_ENRICHMENT_INTELLIGENCE")) {
      return NextResponse.json(
        { error: "Profile enrichment is temporarily unavailable because all enrichment models are currently rate limited. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { connectionIds } = body;

    if (!connectionIds || !Array.isArray(connectionIds) || connectionIds.length === 0) {
      return NextResponse.json({ error: "Missing connectionIds array" }, { status: 400 });
    }

    // 2. Fetch connections AND their cached enriched timestamps
    const query = supabase
      .from("connections")
      .select("id, profile_url, email, email_source, email_last_enriched_at, company, connection_profiles(enriched_at)")
      .in("id", connectionIds);

    const connections = await fetchAllRecords<any>(query);

    const results = [];
    let enrichedCount = 0;
    let failedCount = 0;

    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    // 3. Process sequentially with break-on-failure
    for (const conn of connections) {
      if (!conn.profile_url) {
        results.push({ id: conn.id, status: 'skipped', reason: 'No profile URL' });
        continue;
      }

      let profileResult = null;
      let profileStatus = 'skipped';
      let profileError = null;

      // --- Tavily Profile Enrichment ---
      const isProfileCacheValid = conn.connection_profiles?.enriched_at &&
        (now - new Date(conn.connection_profiles.enriched_at).getTime() < THIRTY_DAYS_MS);

      if (isProfileCacheValid) {
        profileStatus = 'cached';
      } else {
        try {
          const profile = await enrichProfile(supabase, conn.id, conn.profile_url);
          if (profile) {
            profileResult = profile;
            profileStatus = 'success';
          } else {
            profileStatus = 'failed';
          }
        } catch (err: any) {
          const errMsg = err?.message || "Unknown error";
          console.error(`[Enrichment Batch] Aborting batch due to failure on ${conn.id}: ${errMsg}`);
          profileStatus = 'failed';
          profileError = errMsg;
        }
      }

      // --- Apollo Email Enrichment ---
      let apolloResult = null;
      let apolloStatus = 'skipped';

      // Do not overwrite manual/CSV emails
      const hasEmailNotFromApollo = conn.email && conn.email_source !== 'apollo';
      const isApolloCacheValid = conn.email_source === 'apollo' && conn.email_last_enriched_at &&
        (now - new Date(conn.email_last_enriched_at).getTime() < THIRTY_DAYS_MS);

      if (!hasEmailNotFromApollo && !isApolloCacheValid) {
        // Provide company name for better match rate if possible
        const companyName = profileResult?.company || conn.company;

        const emailData = await getApolloEmailByLinkedInUrl(conn.profile_url, companyName);
        if (emailData && emailData.email) {
          apolloStatus = 'success';

          // Persist email to connections table
          const { error: updateError } = await supabase
            .from("connections")
            .update({
              email: emailData.email,
              email_source: 'apollo',
              email_status: emailData.email_status,
              email_confidence: emailData.email_confidence,
              email_last_enriched_at: new Date().toISOString()
            })
            .eq("id", conn.id);

          if (!updateError) {
            apolloResult = emailData;
          } else {
            console.error(`[ApolloEnrichment] Failed to update connection ${conn.id}:`, updateError);
            apolloStatus = 'failed';
          }
        } else {
          apolloStatus = 'failed';
        }
      }

      // Tallying overall success for the UI
      if (profileStatus === 'success' || apolloStatus === 'success') {
        enrichedCount++;
      } else if (profileStatus === 'failed' && apolloStatus === 'failed') {
        failedCount++;
      }

      results.push({
        id: conn.id,
        status: profileStatus === 'success' || apolloStatus === 'success' ? 'success' : (profileStatus === 'cached' ? 'cached' : 'failed'),
        profile: profileResult,
        apollo: apolloResult,
        reason: profileError
      });

      // Stop batch if Tavily model cooldown was hit
      if (profileError) {
        break;
      }
    }

    return NextResponse.json({
      success: true,
      enrichedCount,
      failedCount,
      results,
      aborted: results.length < connections.length
    });
  } catch (err) {
    console.error("ENRICHMENT ERROR", err);
    const message = err instanceof Error ? err.message : "Enrichment failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
