import { NextResponse } from "next/server";
import Papa from "papaparse";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { createClient, requireUser } from "@/lib/supabase/server";
import { fetchAllRecords } from "@/utils/supabase-utils";

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

function parseConnectedOn(value: string | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const text = await file.text();
    const parsed = Papa.parse<LinkedInRow>(text, {
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
      .select("id, profile_url, first_name, last_name, company")
      .eq("user_id", user.id)
      .order("id", { ascending: true });

    const existingConnections = await fetchAllRecords(query);

    const urlMap = new Map<string, any>();
    const fallbackMap = new Map<string, any>();

    existingConnections?.forEach((c: any) => {
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
            profile_url: row.profile_url
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
        if (error) throw error;
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

    return NextResponse.json({ imported: rowsToInsert.length, updated: rowsToUpdate.length, skipped });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
