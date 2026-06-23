import { SupabaseClient } from "@supabase/supabase-js";
import { generateWithFallback } from "@/services/ai/generation/generation";
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
      const context = cachedData.generated_context as CompanyContext;
      if (new Date(cachedData.expires_at) > new Date() && context.classification) {
        return context;
      } else {
      }
    } else {
    }
  } catch (err) {
    console.error(`[CompanyContext] Cache fetch exception for ${normalizedCompany}:`, err);
    // Proceed without cache
  }

  // 2. Fetch public company data using Tavily
  if (options?.skipTavily) {
    return null;
  }

  let rawContext = "";
  let sources: string[] = [];

  try {
    const tavilyKey = process.env.TAVILY_API_KEY;
    if (!tavilyKey) {
      console.warn("[CompanyContext] Missing TAVILY_API_KEY. Skipping public search.");
    } else {
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
        console.error(`[CompanyContext] Tavily API error: ${response.status} ${response.statusText}`);
        throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.results && data.results.length > 0) {
        sources = data.results.map((r: any) => r.url);
        rawContext = data.results.map((r: any) => `Source: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`).join("\n\n");
      }

    }
  } catch (err) {
    console.error(`[CompanyContext] Error fetching public data for ${normalizedCompany}:`, err);
    return null; // Fail gracefully
  }

  if (!rawContext) {
    console.warn(`[CompanyContext] No raw context found for ${normalizedCompany}. Returning null.`);
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
Additionally, classify the company into our standardized technology categories based on what they actually build, sell, or operate. 
Only allow categories from the approved taxonomy below. Do not invent categories. Empty arrays are allowed if evidence is insufficient. Prefer precision over broad classification.

### New Classification Philosophy
The goal is to identify: "What does this company primarily build, sell, or operate?"
Only assign categories with strong evidence. 

### Confidence-Based Classification
For every generated tag, calculate a confidence score (0.0 to 1.0) based on:
- Company description, Product pages, Technology signals, Company initiatives, Website content, News mentions.
Tags repeatedly supported across multiple sources should rank higher.

### Technology Layer Rules
Technology Layer should represent what the company directly produces or operates. Do not automatically assign categories just because the company interacts with those ecosystems.

### Domain Rules
Assign domains only when they are a meaningful business focus.

### Architecture Rules
Architecture is a special category. Unlike Domain and Technology Layer, Architecture should NEVER be omitted when sufficient evidence exists.
Allowed values: x86, Arm, RISC-V.
Architecture confidence should be derived from:
- Highest Priority: Product pages, Processor descriptions, Hardware specifications.
- Medium Priority: Engineering blogs, Company announcements, Tavily technology signals.
- Lower Priority: News mentions, Secondary references.
Explicit Mapping Examples:
- Tenstorrent, SiFive -> RISC-V
- Ampere -> Arm
- AMD, Intel -> x86
- NVIDIA -> Arm (Grace), CPU/GPU
- AWS -> Arm (Graviton)

Approved Taxonomy:
- Domains: Cloud, HPC, AI, Edge
- Architectures: x86, Arm, RISC-V
- Technology Layers -> Silicon: CPU/GPU, RAM, Storage, NIC, Custom ASIC/SoC, Accelerators
- Technology Layers -> Systems: Server/Rack OEM, Server/Rack ODM, HPC Clusters, Cloud Service Providers, Hyperscalers, Neo Clouds
- Technology Layers -> Software: Enterprise Software, HPC Applications

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
  "classification": {
    "domains": [{"tag": "AI", "confidence": 0.95}],
    "architectures": [{"tag": "Arm", "confidence": 0.85}],
    "technologyLayers": {
      "silicon": [{"tag": "Accelerators", "confidence": 0.98}],
      "systems": [],
      "software": []
    }
  },
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
    

    const threshold = 0.70;
    const filterAndSortTags = (tags: any[]) => {
      if (!Array.isArray(tags)) return [];
      return tags
        .map((t: any) => {
          if (typeof t === 'string') return { tag: t, confidence: 1.0 };
          return t;
        })
        .filter((t: any) => t && typeof t.tag === 'string' && typeof t.confidence === 'number' && t.confidence >= threshold)
        .sort((a: any, b: any) => b.confidence - a.confidence)
        .map((t: any) => t.tag);
    };

    const processArchitectures = (tags: any[]) => {
      if (!Array.isArray(tags)) return [];
      const validTags = tags
        .map((t: any) => {
          if (typeof t === 'string') return { tag: t, confidence: 1.0 };
          if (t.name && !t.tag) return { tag: t.name, confidence: t.confidence || 1.0 };
          return t;
        })
        .filter((t: any) => t && typeof t.tag === 'string' && typeof t.confidence === 'number')
        .sort((a: any, b: any) => b.confidence - a.confidence);

      if (validTags.length === 0) return [];

      const thresholdMatches = validTags.filter((t: any) => t.confidence >= threshold);
      
      if (thresholdMatches.length > 0) {
        return thresholdMatches.map((t: any) => ({
          tag: t.tag,
          confidence: t.confidence
        }));
      }

      // Fallback Selection Logic
      return [{
        tag: validTags[0].tag,
        confidence: validTags[0].confidence,
        fallbackSelected: true
      }];
    };

    let processedClassification = undefined;
    if (parsed.classification) {
      processedClassification = {
        domains: filterAndSortTags(parsed.classification.domains),
        architectures: processArchitectures(parsed.classification.architectures),
        technologyLayers: {
          silicon: filterAndSortTags(parsed.classification.technologyLayers?.silicon),
          systems: filterAndSortTags(parsed.classification.technologyLayers?.systems),
          software: filterAndSortTags(parsed.classification.technologyLayers?.software),
        }
      };
    }

    generatedContext = {
      companyName: parsed.companyName || normalizedCompany,
      summary: parsed.summary || "",
      keyInitiatives: parsed.keyInitiatives || [],
      hiringSignals: parsed.hiringSignals || [],
      technologySignals: parsed.technologySignals || [],
      businessPriorities: parsed.businessPriorities || [],
      outreachOpportunities: parsed.outreachOpportunities || [],
      classification: processedClassification,
      confidence: parsed.confidence || "low",
      sources: sources,
    };


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
    }
  } catch (err) {
    console.error(`[CompanyContext] Error during cache upsert for ${normalizedCompany}:`, err);
  }

  return generatedContext;
}
