import { SupabaseClient } from "@supabase/supabase-js";
import { generateWithFallback } from "@/ai/generation";
import type { CompanyContext } from "@/types/database";

export async function getCompanyContext(
  supabase: SupabaseClient,
  companyName: string,
  options?: { skipTavily?: boolean }
): Promise<CompanyContext | null> {
  if (!companyName || companyName.trim() === "") return null;
  const normalizedCompany = companyName.trim().toLowerCase();

  // 1. Check cache
  try {
    const { data: cachedData, error: cacheError } = await supabase
      .from("company_context_cache")
      .select("generated_context, expires_at")
      .eq("company_name", normalizedCompany)
      .single();

    if (!cacheError && cachedData && cachedData.generated_context) {
      if (new Date(cachedData.expires_at) > new Date()) {
        // console.log(`[CompanyContext] Cache HIT for ${normalizedCompany}`);
        return cachedData.generated_context as CompanyContext;
      } else {
        // console.log(`[CompanyContext] Cache EXPIRED for ${normalizedCompany}`);
      }
    } else {
      // console.log(`[CompanyContext] Cache MISS for ${normalizedCompany}`);
    }
  } catch (err) {
    console.error(`[CompanyContext] Cache fetch error for ${normalizedCompany}:`, err);
    // Proceed without cache
  }

  // 2. Fetch public company data using Tavily
  if (options?.skipTavily) {
    // console.log(`[CompanyContext] Skipping Tavily for ${normalizedCompany} as requested.`);
    return null;
  }

  let rawContext = "";
  let sources: string[] = [];

  try {
    const tavilyKey = process.env.TAVILY_API_KEY;
    if (!tavilyKey) {
      console.warn("[CompanyContext] Missing TAVILY_API_KEY. Skipping public search.");
    } else {
      // console.log(`[CompanyContext] Fetching Tavily search for ${normalizedCompany}`);
      const startTime = Date.now();
      
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: `${normalizedCompany} latest company news, product announcements, press releases, hiring initiatives, technology investments`,
          search_depth: "advanced",
          include_answer: false,
          include_images: false,
          include_raw_content: false,
          max_results: 5,
        }),
      });

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        sources = data.results.map((r: any) => r.url);
        rawContext = data.results.map((r: any) => `Source: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`).join("\n\n");
      }
      
      // console.log(`[CompanyContext] Tavily search completed in ${Date.now() - startTime}ms. Sources found: ${sources.length}`);
    }
  } catch (err) {
    console.error(`[CompanyContext] Error fetching public data for ${normalizedCompany}:`, err);
    return null; // Fail gracefully
  }

  if (!rawContext) {
    console.warn(`[CompanyContext] No raw context found for ${normalizedCompany}. Skipping generation.`);
    return null;
  }

  // 3. Generate structured intelligence using GPT-OSS (Cerebras)
  let generatedContext: CompanyContext | null = null;
  try {
    const startTime = Date.now();
    const prompt = `Analyze the following raw public data about the company "${normalizedCompany}".

Raw Data:
${rawContext}

Extract structured intelligence identifying key business signals, hiring signals, technology signals, and outreach opportunities.
Focus strictly on factual signals explicitly mentioned or strongly implied in the text.
Do NOT fabricate initiatives or mention uncertain signals.
Do NOT scrape LinkedIn context.

Respond in JSON ONLY with exactly the following structure:
{
  "companyName": "${normalizedCompany}",
  "summary": "A 1-2 sentence overview of their current strategic focus based on the data",
  "keyInitiatives": ["Initiative 1", "Initiative 2"],
  "hiringSignals": ["Signal 1"],
  "technologySignals": ["Signal 1"],
  "businessPriorities": ["Priority 1"],
  "outreachOpportunities": ["Area where Whileone engineering/cloud/AI/performance expertise aligns"],
  "confidence": "high" | "medium" | "low",
  "sources": []
}

If no clear signals exist for a category, use an empty array [].
Keep responses concise.`;

    const aiResult = await generateWithFallback(prompt, "COMPANY_CONTEXT_INTELLIGENCE", { isJson: true });
    
    // Parse the JSON
    let parsed: any;
    try {
      parsed = JSON.parse(aiResult.text);
    } catch (parseErr) {
      // Sometimes models wrap json in \`\`\`json
      const cleaned = aiResult.text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      parsed = JSON.parse(cleaned);
    }

    generatedContext = {
      companyName: parsed.companyName || normalizedCompany,
      summary: parsed.summary || "",
      keyInitiatives: parsed.keyInitiatives || [],
      hiringSignals: parsed.hiringSignals || [],
      technologySignals: parsed.technologySignals || [],
      businessPriorities: parsed.businessPriorities || [],
      outreachOpportunities: parsed.outreachOpportunities || [],
      confidence: parsed.confidence || "low",
      sources: sources,
    };

    // console.log(`[CompanyContext] Intelligence generation completed in ${Date.now() - startTime}ms.`);

  } catch (err) {
    console.error(`[CompanyContext] Error generating intelligence for ${normalizedCompany}:`, err);
    return null; // Fail gracefully
  }

  // 4. Cache the result
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 day TTL

    const { error: upsertError } = await supabase
      .from("company_context_cache")
      .upsert({
        company_name: normalizedCompany,
        summary: generatedContext.summary,
        raw_context: rawContext,
        generated_context: generatedContext as any,
        sources: sources,
        updated_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      }, { onConflict: 'company_name' });

    if (upsertError) {
      console.error(`[CompanyContext] Error caching context for ${normalizedCompany}:`, upsertError);
    } else {
      // console.log(`[CompanyContext] Successfully cached context for ${normalizedCompany}`);
    }
  } catch (err) {
    console.error(`[CompanyContext] Error during cache upsert for ${normalizedCompany}:`, err);
  }

  return generatedContext;
}
