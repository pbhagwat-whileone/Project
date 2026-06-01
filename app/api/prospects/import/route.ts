import { NextResponse } from "next/server";
import Papa from "papaparse";
import { createClient, requireUser } from "@/lib/supabase/server";
import type { ProspectStatus } from "@/types/database";

const COLUMN_MAP: Record<string, keyof ImportRow> = {
  "company name": "company_name",
  company: "company_name",
  website: "website",
  country: "country",
  industry: "industry",
  "revenue range": "revenue_range",
  revenue: "revenue_range",
  "employee count": "employee_count",
  employees: "employee_count",
  notes: "notes",
  status: "status",
};

type ImportRow = {
  company_name: string;
  website?: string;
  country?: string;
  industry?: string;
  revenue_range?: string;
  employee_count?: string;
  notes?: string;
  status?: ProspectStatus;
};

const VALID_STATUSES: ProspectStatus[] = [
  "Researching",
  "Qualified",
  "Outreach Planned",
  "Contacted",
  "Won",
  "Lost",
];

function mapRow(raw: Record<string, string>): ImportRow | null {
  const mapped: Partial<ImportRow> = {};

  for (const [key, value] of Object.entries(raw)) {
    const normalized = key.trim().toLowerCase();
    const field = COLUMN_MAP[normalized];
    if (field && value?.trim()) {
      mapped[field] = value.trim() as never;
    }
  }

  if (!mapped.company_name) return null;

  if (mapped.status && !VALID_STATUSES.includes(mapped.status)) {
    mapped.status = "Researching";
  }

  return {
    company_name: mapped.company_name,
    website: mapped.website,
    country: mapped.country,
    industry: mapped.industry,
    revenue_range: mapped.revenue_range,
    employee_count: mapped.employee_count,
    notes: mapped.notes,
    status: mapped.status ?? "Researching",
  };
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const text = await file.text();
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    });

    const rows = parsed.data
      .map(mapRow)
      .filter((r): r is ImportRow => r !== null)
      .map((r) => ({
        user_id: user.id,
        company_name: r.company_name,
        website: r.website ?? null,
        country: r.country ?? null,
        industry: r.industry ?? null,
        revenue_range: r.revenue_range ?? null,
        employee_count: r.employee_count ?? null,
        notes: r.notes ?? null,
        status: r.status ?? "Researching",
      }));

    if (!rows.length) {
      return NextResponse.json({ error: "No valid rows" }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase.from("prospects").insert(rows);
    if (error) throw error;

    return NextResponse.json({ imported: rows.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
