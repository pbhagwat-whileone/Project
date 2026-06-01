import { NextResponse } from "next/server";
import { createClient, requireUser } from "@/lib/supabase/server";
import { generateProspectAnalysis } from "@/services/prospect-analyzer";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const supabase = await createClient();

    const { data: prospect, error } = await supabase
      .from("prospects")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !prospect) {
      return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
    }

    const analysis = await generateProspectAnalysis(prospect);

    const { data: saved, error: saveError } = await supabase
      .from("prospect_analysis")
      .insert({ prospect_id: id, analysis })
      .select()
      .single();

    if (saveError) throw saveError;

    return NextResponse.json({ analysis: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await requireUser();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("prospect_analysis")
      .select("*")
      .eq("prospect_id", id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) throw error;
    return NextResponse.json({ analyses: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
