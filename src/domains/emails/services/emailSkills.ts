import fs from 'fs/promises';
import path from 'path';

const RELATIONSHIP_MAP: Record<string, string> = {
  "cold-outreach": "cold-outreach",
  "dormant-relationship": "dormant-relationship",
  "warm-relationship": "warm-relationship",
  "active-relationship": "active-relationship",
  "past-customer": "past-customer",
  "referral-relationship": "referral-relationship"
};

export async function getEmailSkill(strategy: string): Promise<string> {
  const strategyKebab = (strategy || 'unknown').toLowerCase().replace(/\s+/g, '-');
  
  // Normalize the legacy or raw relationship into one of the 4 canonical files
  const canonicalStrategy = RELATIONSHIP_MAP[strategyKebab] || "cold-outreach";
  
  const skillsDir = path.join(process.cwd(), 'skills');
  const targetPath = path.join(skillsDir, `${canonicalStrategy}.md`);
  const fallbackPath = path.join(skillsDir, `cold-outreach.md`);
  
  try {
    return await fs.readFile(targetPath, 'utf8');
  } catch {
    try {
      return await fs.readFile(fallbackPath, 'utf8');
    } catch {
      return "Goal: Professional Outreach\nTone: Professional\nInstructions: Be concise.";
    }
  }
}
