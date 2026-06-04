import { generateOutreachEmail } from "../src/services/email-generator";
import type { RankedContact, MatchedChunk } from "../src/types/database";

// Export the function to test outcome extraction manually
// (Simulate exactly what the generator does)
const OUTCOME_KEYWORDS = [
  "improved", "reduced", "accelerated", "optimized", "increased", 
  "saved", "performance", "efficiency", "cost", "latency", 
  "throughput", "scalability", "reliability", "automation", "productivity"
];

function extractOutcomeContext(text: string): string {
  if (!text) return "";
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  const outcomeSentences = sentences.filter(s => 
    OUTCOME_KEYWORDS.some(k => s.toLowerCase().includes(k))
  );
  
  let result = outcomeSentences.join(" ").trim();
  
  if (result.length < 400) {
     if (result.length === 0) {
       return text.slice(0, 400);
     }
     const nonOutcome = sentences.filter(s => !outcomeSentences.includes(s));
     for (const s of nonOutcome) {
       if (result.length >= 400) break;
       result += " " + s.trim();
     }
  }
  
  return result.slice(0, 400).trim();
}

async function runTests() {
  const sampleProjectText = "We rebuilt the backend data pipeline from scratch using Kafka. The team struggled with delays. We optimized the processing algorithms and increased throughput by 400%. Overall latency was reduced by 50ms per request. The client was very happy.";
  
  console.log("=== Extraction Test ===");
  console.log("Original:", sampleProjectText);
  console.log("Extracted:", extractOutcomeContext(sampleProjectText));
  console.log("=======================\n");

  const contact = {
    id: "1",
    first_name: "Jane",
    last_name: "Doe",
    company: "Acme Corp",
    position: "VP of Engineering"
  } as RankedContact;

  const projects: MatchedChunk[] = [{
    id: "1",
    document_id: "1",
    project_name: "Kafka Pipeline Rewrite",
    chunk_text: sampleProjectText,
    industry: "Tech",
    similarity: 0.9
  }];

  const relationships = ["Cold Outreach", "Warm Introduction", "Former Colleague", "Follow Up"];

  const companies = ["AMD", "NVIDIA", "JPMorgan", "Pfizer", "Mercedes-Benz"];

  for (const company of companies) {
    console.log(`\n=== Generating for: ${company} ===`);
    try {
      const result = await generateOutreachEmail({
        targetCompany: company,
        contact: { ...contact, company },
        projects,
        relationshipType: "Cold Outreach",
        provider: "gemini", // fallback will trigger
      });
      console.log("SUBJECT:", result.subject);
      console.log("BODY:\n" + result.body);
    } catch (e) {
      console.error("Error generating:", e);
    }
  }
}

runTests().catch(console.error);
