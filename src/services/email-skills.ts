import fs from 'fs/promises';
import path from 'path';

const RELATIONSHIP_MAP: Record<string, string> = {
  "advisor": "cold-outreach",
  "mentor": "cold-outreach",
  "investor": "cold-outreach",
  "alumni": "cold-outreach",
  "unknown": "cold-outreach",
  "mutual-connection": "warm-introduction",
  "personal-contact": "warm-introduction",
  "existing-client": "follow-up",
  "previous-client": "follow-up",
  "former-colleague": "former-colleague"
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
