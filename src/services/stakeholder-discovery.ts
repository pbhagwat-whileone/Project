import { generateWithFallback } from "@/ai/generation";

export type StakeholderStrategy = {
  departments: string[];
  seniorities: string[];
  titles: string[];
};

export async function generateCompanyStakeholderSearchStrategy(
  company: string,
  existingRoles: string[],
  expertiseTags: string[],
  technologyTags: string[],
  activitySignals: string[]
): Promise<StakeholderStrategy> {
  const prompt = `You are an expert sales strategist and B2B organizational mapper.

I am mapping out the buying committee at a target company. I want to identify missing adjacent decision-makers, technical influencers, and potential champions.

Current Company Context:
Company: ${company}
Existing Roles We Already Know: ${existingRoles.length > 0 ? existingRoles.join(", ") : "None"}
Expertise Tags: ${expertiseTags.join(", ")}
Technology Tags: ${technologyTags.join(", ")}
Activity Signals: ${activitySignals.join(", ")}

INSTRUCTIONS:
1. Analyze the existing roles we already have. 
2. Identify GAPS in the buying committee. Which key departments or seniorities are missing? (e.g. If we have VP Marketing, we need VP Engineering/Product).
3. Prioritize Technical Decision Makers, Product Owners, Architects, and Engineering Leaders if applicable to the tags.
4. Formulate a search strategy to target those MISSING departments.

You must output a raw JSON object matching this exact shape:
{
  "departments": ["Engineering", "Product"], // Missing or adjacent departments to search
  "seniorities": ["director", "vp", "c_suite", "head"], // Allowed values: owner, founder, c_suite, partner, vp, head, director, manager, senior, entry
  "titles": ["Chief Architect", "Head of Product", "VP Engineering"] // Specific exact titles to prioritize
}

Ensure the JSON is strictly valid. Do not include markdown block ticks.`;

  try {
    const res = await generateWithFallback(prompt, "COMPANY_STAKEHOLDER_STRATEGY");
    const rawText = res.text?.trim();

    if (!rawText) {
      throw new Error("Empty response from AI");
    }

    let jsonStr = rawText;
    if (jsonStr.includes("\`\`\`json")) {
      jsonStr = jsonStr.split("\`\`\`json")[1].split("\`\`\`")[0].trim();
    } else if (jsonStr.includes("\`\`\`")) {
      jsonStr = jsonStr.split("\`\`\`")[1].split("\`\`\`")[0].trim();
    }

    return JSON.parse(jsonStr) as StakeholderStrategy;
  } catch (err) {
    console.error("[StakeholderDiscovery] AI Parsing failed, using defaults:", err);
    return {
      departments: ["engineering", "product", "information technology"],
      seniorities: ["director", "vp", "c_suite", "head", "manager"],
      titles: []
    };
  }
}
