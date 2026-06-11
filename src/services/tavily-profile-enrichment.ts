import { SupabaseClient } from "@supabase/supabase-js";
import { generateWithFallback } from "@/ai/generation";
import type { ConnectionProfile } from "@/types/database";

export async function enrichProfile(
  supabase: SupabaseClient,
  connectionId: string,
  profileUrl: string
): Promise<ConnectionProfile | null> {
  if (!profileUrl) return null;

  try {
    const tavilyKey = process.env.TAVILY_API_KEY;
    if (!tavilyKey) {
      console.warn("[ProfileEnrichment] Missing TAVILY_API_KEY.");
      return null;
    }

    console.log(`[ProfileEnrichment] Fetching Tavily extract for ${profileUrl}`);
    const response = await fetch("https://api.tavily.com/extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: tavilyKey,
        urls: [profileUrl],
      }),
    });

    if (!response.ok) {
      console.warn(`[ProfileEnrichment] Extract failed, attempting search for ${profileUrl}`);
      const searchResponse = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: `linkedin profile ${profileUrl}`,
          search_depth: "advanced",
          include_answer: false,
          include_raw_content: true,
          max_results: 3,
        }),
      });

      if (!searchResponse.ok) {
        throw new Error(`Tavily Search API error: ${searchResponse.status} ${searchResponse.statusText}`);
      }

      const searchData = await searchResponse.json();
      if (!searchData.results || searchData.results.length === 0) {
        console.warn(`[ProfileEnrichment] No search results for ${profileUrl}`);
        return null;
      }
      
      const rawContext = searchData.results.map((r: any) => `Source: ${r.title}\nURL: ${r.url}\nContent: ${r.content}\nRaw: ${r.raw_content || ''}`).join("\n\n");
      return await parseAndSave(supabase, connectionId, rawContext, searchData);
    }

    const data = await response.json();
    if (!data.results || data.results.length === 0) {
      console.warn(`[ProfileEnrichment] No extract results for ${profileUrl}`);
      return null;
    }

    const rawContext = data.results[0].raw_content;
    return await parseAndSave(supabase, connectionId, rawContext, data);
  } catch (err) {
    console.error(`[ProfileEnrichment] Error fetching data for ${profileUrl}:`, err);
    throw err; // Bubble up so the batch processor knows if Tavily failed
  }
}

function parseDeterministicFields(rawText: string) {
  let company = "";
  let position = "";
  let currentRoleStartDate = "";
  let location = "";
  let headline = "";
  let education: any[] = [];

  const lines = rawText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  
  if (lines.length > 2) {
    headline = lines[1] || "";
    if (headline.startsWith("##") || headline.length > 200) headline = "";
    
    if (lines[2] && !lines[2].startsWith("##") && lines[2].length < 100) {
      location = lines[2];
    }
  }

  const expIndex = lines.findIndex(l => l.toLowerCase().includes("## experience"));
  if (expIndex !== -1 && expIndex + 3 < lines.length) {
    position = lines[expIndex + 1].replace(/^#+\s*/, "");
    company = lines[expIndex + 2].replace(/^#+\s*/, "");
    const dateLine = lines[expIndex + 3];
    currentRoleStartDate = dateLine.split("-")[0]?.trim() || "";
  }

  const eduIndex = lines.findIndex(l => l.toLowerCase().includes("## education"));
  if (eduIndex !== -1 && eduIndex + 2 < lines.length) {
    let school = lines[eduIndex + 1].replace(/^#+\s*/, "");
    let degree = lines[eduIndex + 2].replace(/^#+\s*/, "");
    if (school && !school.startsWith("##")) {
      education.push({ school, degree: degree.startsWith("##") ? "" : degree });
    }
  }

  return { company, position, currentRoleStartDate, location, headline, education };
}

async function parseAndSave(
  supabase: SupabaseClient,
  connectionId: string,
  rawContext: string,
  rawTavilyResponse?: any
): Promise<ConnectionProfile | null> {
  console.log("[ProfileEnrichment] Tavily Response Received");
  
  if (!rawContext) {
    console.warn(`[ProfileEnrichment] No raw context for connection ${connectionId}`);
    return null;
  }
  
  console.log("[ProfileEnrichment] Raw Content Length:", rawContext.length);

  const deterministic = parseDeterministicFields(rawContext);
  console.log("[ProfileEnrichment] Deterministic Fields:", deterministic);

  const profileData: any = {
    connection_id: connectionId,
    location: deterministic.location || null,
    company: deterministic.company || null,
    position: deterministic.position || null,
    headline: deterministic.headline || null,
    current_role_start_date: deterministic.currentRoleStartDate || null,
    education: deterministic.education || [],
    certifications: [],
    expertise_tags: [],
    technology_tags: [],
    activity_signals: [],
    raw_tavily_response: rawTavilyResponse || { raw_context: rawContext },
    enriched_at: new Date().toISOString()
  };

  let llmFailedError = null;

  try {
    const reducedContext = rawContext.substring(0, 4000);
    const prompt = `Analyze the following public data extracted from a LinkedIn profile.

Data:
${reducedContext}

Extract structured intelligence. Focus strictly on factual signals explicitly mentioned or strongly implied in the text.
If no clear signals exist for a category, use an empty array.
Merge Interest Areas and Professional Focus Areas into expertiseTags.
Respond in JSON ONLY with exactly the following structure:
{
  "certifications": ["Cert 1", "Cert 2"],
  "expertiseTags": ["Expertise 1", "Expertise 2"],
  "technologyTags": ["Tech 1", "Tech 2"],
  "activitySignals": ["Signal 1 (e.g. recently posted about X)", "Signal 2"]
}`;

    const aiResult = await generateWithFallback(prompt, "PROFILE_ENRICHMENT_INTELLIGENCE", { isJson: true });
    
    let parsed: any;
    try {
      parsed = JSON.parse(aiResult.text);
    } catch (parseErr) {
      const cleaned = aiResult.text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      parsed = JSON.parse(cleaned);
    }

    profileData.certifications = parsed.certifications || [];
    profileData.expertise_tags = parsed.expertiseTags || [];
    profileData.technology_tags = parsed.technologyTags || [];
    profileData.activity_signals = parsed.activitySignals || [];

    console.log("[ProfileEnrichment] LLM Enrichment:", parsed);
  } catch (err: any) {
    console.warn(`[ProfileEnrichment] LLM Enrichment failed for connection ${connectionId}:`, err?.message);
    llmFailedError = err; // Store error to bubble up after saving deterministic fields
  }

  // Always save what we have (even if it's just deterministic partial success)
  const { data: insertedData, error: upsertError } = await supabase
    .from("connection_profiles")
    .upsert(profileData, { onConflict: 'connection_id' })
    .select()
    .single();

  if (upsertError) {
    console.error(`[ProfileEnrichment] Error caching profile for connection ${connectionId}:`, upsertError);
  }

  if (llmFailedError) {
    // If the LLM failed, we throw the error upwards so the batch processor can abort if it's a quota issue
    throw llmFailedError;
  }

  return insertedData;
}
