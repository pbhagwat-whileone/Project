import fs from 'fs/promises';
import path from 'path';

export async function getEmailSkill(strategy: string): Promise<string> {
  const strategyKebab = (strategy || 'unknown').toLowerCase().replace(/\s+/g, '-');
  const skillsDir = path.join(process.cwd(), 'skills');
  const targetPath = path.join(skillsDir, `${strategyKebab}.md`);
  const fallbackPath = path.join(skillsDir, `unknown.md`);
  
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
