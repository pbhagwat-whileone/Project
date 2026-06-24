import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export async function syncCaseStudiesSheet(
  supabase: SupabaseClient<Database>,
  userId: string,
  auth: OAuth2Client,
  sheetUrl: string
) {
  if (!sheetUrl) return;

  // Extract file ID from URL
  const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    throw new Error("Invalid Google Sheets URL");
  }
  const spreadsheetId = match[1];

  const sheets = google.sheets({ version: "v4", auth });
  
  // Get spreadsheet to find first sheet title
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const firstSheetTitle = spreadsheet.data.sheets?.[0]?.properties?.title;
  if (!firstSheetTitle) throw new Error("No sheets found in document");

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: firstSheetTitle,
  });

  const rows = res.data.values;
  if (!rows || rows.length === 0) return;

  const headers = rows[0].map(h => String(h).trim().toLowerCase());
  
  // Find indices
  const profileIdx = headers.findIndex(h => h === "customer profile");
  const challengeIdx = headers.findIndex(h => h === "customer's challenge" || h === "customers challenge" || h === "customer challenge");
  const solutionIdx = headers.findIndex(h => h === "whileone solution");
  const benefitsIdx = headers.findIndex(h => h === "business benefits for customer");

  if (profileIdx === -1 && challengeIdx === -1 && solutionIdx === -1 && benefitsIdx === -1) {
    throw new Error("Required columns not found in Case Studies Master Sheet");
  }

  const parsedContent = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const entry: Record<string, string> = {};
    if (profileIdx !== -1 && row[profileIdx]) entry["Customer Profile"] = String(row[profileIdx]).trim();
    if (challengeIdx !== -1 && row[challengeIdx]) entry["Customer's Challenge"] = String(row[challengeIdx]).trim();
    if (solutionIdx !== -1 && row[solutionIdx]) entry["Whileone Solution"] = String(row[solutionIdx]).trim();
    if (benefitsIdx !== -1 && row[benefitsIdx]) entry["Business Benefits for Customer"] = String(row[benefitsIdx]).trim();

    if (Object.keys(entry).length > 0) {
      parsedContent.push(entry);
    }
  }

  const { error } = await supabase.from("case_studies_sheet_cache").upsert({
    user_id: userId,
    sheet_url: sheetUrl,
    parsed_content: parsedContent,
    last_synced: new Date().toISOString(),
  }, { onConflict: "user_id,sheet_url" });

  if (error) throw error;
}
