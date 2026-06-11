import { NextResponse } from "next/server";
import Papa from "papaparse";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { createClient, requireUser } from "@/lib/supabase/server";
import { fetchAllRecords } from "@/utils/supabase-utils";
import { parseConnectedOn } from "@/utils/format-utils";

type LinkedInRow = {
  "First Name"?: string;
  "Last Name"?: string;
  Company?: string;
  Position?: string;
  "Email Address"?: string;
  "Profile URL"?: string;
  "URL"?: string;
  "Connected On"?: string;
};


export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const connectionOwnerName = formData.get("connection_owner_name")?.toString()?.trim();
    if (!connectionOwnerName) {
      return NextResponse.json({ error: "Connection Owner Name is required" }, { status: 400 });
    }

    const text = await file.text();
    
    // Automatically remove the first 3 rows of LinkedIn metadata
    const lines = text.split(/\r?\n/);
    const cleanedText = lines.length > 3 ? lines.slice(3).join('\n') : text;

    const parsed = Papa.parse<LinkedInRow>(cleanedText, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors.length > 0) {
      return NextResponse.json(
        { error: parsed.errors[0].message },
        { status: 400 }
      );
    }

    const query = supabase
      .from("connections")
      .select("id, profile_url, first_name, last_name, company, connection_owner_name")
      .eq("user_id", user.id)
      .order("id", { ascending: true });

    const existingConnections = await fetchAllRecords<{ id: string; profile_url: string | null; first_name: string | null; last_name: string | null; company: string | null; connection_owner_name: string }>(query);

    const urlMap = new Map<string, any>();
    const fallbackMap = new Map<string, any>();

    existingConnections?.forEach((c: any) => {
      // Only deduplicate within the same owner's network
      if (c.connection_owner_name !== connectionOwnerName) return;
      
      if (c.profile_url) {
        urlMap.set(c.profile_url.toLowerCase().trim(), c);
      }
      const fallback = `${c.first_name?.toLowerCase()?.trim() || ""}|${c.last_name?.toLowerCase()?.trim() || ""}|${c.company?.toLowerCase()?.trim() || ""}`;
      fallbackMap.set(fallback, c);
    });

    const rows = parsed.data
      .filter((row) => row["First Name"] || row.Company)
      .map((row) => ({
        user_id: user.id,
        first_name: row["First Name"]?.trim() || null,
        last_name: row["Last Name"]?.trim() || null,
        company: row.Company?.trim() || null,
        position: row.Position?.trim() || null,
        email: row["Email Address"]?.trim() || null,
        profile_url: row["Profile URL"]?.trim() || row["URL"]?.trim() || null,
        connected_on: parseConnectedOn(row["Connected On"]),
        connection_owner_name: connectionOwnerName,
      }));

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No valid rows found in CSV" },
        { status: 400 }
      );
    }

    const rowsToInsert = [];
    const rowsToUpdate = [];
    let skipped = 0;

    for (const row of rows) {
      const urlKey = row.profile_url?.toLowerCase()?.trim();
      const fallbackKey = `${row.first_name?.toLowerCase()?.trim() || ""}|${row.last_name?.toLowerCase()?.trim() || ""}|${row.company?.toLowerCase()?.trim() || ""}`;
      
      let existingMatch = null;

      if (urlKey && urlMap.has(urlKey)) {
        existingMatch = urlMap.get(urlKey);
      } else if (fallbackMap.has(fallbackKey)) {
        existingMatch = fallbackMap.get(fallbackKey);
      }

      if (existingMatch) {
        if (urlKey && !existingMatch.profile_url) {
          rowsToUpdate.push({
            id: existingMatch.id,
            user_id: user.id,
            profile_url: row.profile_url,
            connection_owner_name: connectionOwnerName,
          });
          existingMatch.profile_url = row.profile_url;
          urlMap.set(urlKey, existingMatch);
        } else {
          skipped++;
        }
      } else {
        rowsToInsert.push(row);
        const newObj = { ...row, id: 'temp-id' };
        if (urlKey) urlMap.set(urlKey, newObj);
        fallbackMap.set(fallbackKey, newObj);
      }
    }

    if (rowsToInsert.length > 0) {
      const BATCH_SIZE = 500;
      for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
        const batch = rowsToInsert.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from("connections").insert(batch);
        if (error) {
          console.error("SUPABASE ERROR (INSERT):", error);
          throw error;
        }
      }
    }

    if (rowsToUpdate.length > 0) {
      const BATCH_SIZE = 500;
      for (let i = 0; i < rowsToUpdate.length; i += BATCH_SIZE) {
        const batch = rowsToUpdate.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from("connections").upsert(batch, { onConflict: "id" });
        if (error) throw error;
      }
    }

    // Log the import activity
    if (rowsToInsert.length > 0 || rowsToUpdate.length > 0) {
       await supabase.from("sync_logs").insert({
         user_id: user.id,
         status: "success",
         documents_processed: rowsToInsert.length + rowsToUpdate.length,
         message: `${connectionOwnerName} imported ${rowsToInsert.length + rowsToUpdate.length} connections`,
       });
    }

    return NextResponse.json({ imported: rowsToInsert.length, updated: rowsToUpdate.length, skipped });
  } catch (err) {
    console.error("CONNECTION IMPORT ERROR");
    console.error(err);

    if (err instanceof Error) {
      console.error(err.message);
      console.error(err.stack);
    }

    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
