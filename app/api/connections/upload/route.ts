import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createClient, requireUser } from "@/lib/supabase/server";

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

    const { error } = await supabase.from("connections").insert(rows);
    if (error) throw error;

    return NextResponse.json({ imported: rows.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
