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
      .select("profile_url, first_name, last_name, company")
      .eq("user_id", user.id)
      .order("id", { ascending: true });

    const existingConnections = await fetchAllRecords(query);

    const profileUrls = new Set<string>();
    const fallbackKeys = new Set<string>();

    existingConnections?.forEach((c: any) => {
      if (c.profile_url) {
        profileUrls.add(c.profile_url.toLowerCase().trim());
      } else {
        const fallback = `${c.first_name?.toLowerCase()?.trim() || ""}|${c.last_name?.toLowerCase()?.trim() || ""}|${c.company?.toLowerCase()?.trim() || ""}`;
        fallbackKeys.add(fallback);
      }
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
        profile_url: row["Profile URL"]?.trim() || null,
        connected_on: parseConnectedOn(row["Connected On"]),
      }));

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No valid rows found in CSV" },
        { status: 400 }
      );
    }

    const newRows = [];
    let skipped = 0;

    for (const row of rows) {
      const urlKey = row.profile_url?.toLowerCase()?.trim();
      const fallbackKey = `${row.first_name?.toLowerCase()?.trim() || ""}|${row.last_name?.toLowerCase()?.trim() || ""}|${row.company?.toLowerCase()?.trim() || ""}`;
      
      let isDuplicate = false;

      if (urlKey) {
        if (profileUrls.has(urlKey)) {
          isDuplicate = true;
        } else {
          profileUrls.add(urlKey); // Add to memory map to catch internal CSV duplicates
        }
      } else {
        if (fallbackKeys.has(fallbackKey)) {
          isDuplicate = true;
        } else {
          fallbackKeys.add(fallbackKey);
        }
      }

      if (isDuplicate) {
        skipped++;
      } else {
        newRows.push(row);
      }
    }

    if (newRows.length > 0) {
      const BATCH_SIZE = 500;
      for (let i = 0; i < newRows.length; i += BATCH_SIZE) {
        const batch = newRows.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from("connections").insert(batch);
        if (error) throw error;
      }
    }

    return NextResponse.json({ imported: newRows.length, updated: 0, skipped });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
