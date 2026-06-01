import { NextResponse } from "next/server";
import { prospectSchema } from "@/lib/validators";
import { createClient, requireUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const { data, error } = await supabase
      .from("prospects")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    let filtered = data ?? [];
    const country = searchParams.get("country");
    const industry = searchParams.get("industry");
    const revenue = searchParams.get("revenue");
    const employees = searchParams.get("employees");
    const status = searchParams.get("status");
    const q = searchParams.get("q")?.toLowerCase();

    if (country)
      filtered = filtered.filter((p) => p.country === country);
    if (industry)
      filtered = filtered.filter((p) => p.industry === industry);
    if (revenue)
      filtered = filtered.filter((p) => p.revenue_range === revenue);
    if (employees)
      filtered = filtered.filter((p) => p.employee_count === employees);
    if (status) filtered = filtered.filter((p) => p.status === status);
    if (q)
      filtered = filtered.filter((p) =>
        p.company_name.toLowerCase().includes(q)
      );

    return NextResponse.json({ prospects: filtered });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = prospectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("prospects")
      .insert({
        user_id: user.id,
        ...parsed.data,
        website: parsed.data.website || null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ prospect: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
