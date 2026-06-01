import { z } from "zod";

export const prospectSchema = z.object({
  company_name: z.string().min(1, "Company name is required"),
  website: z.string().url().optional().or(z.literal("")),
  country: z.string().optional(),
  industry: z.string().optional(),
  revenue_range: z.string().optional(),
  employee_count: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum([
    "Researching",
    "Qualified",
    "Outreach Planned",
    "Contacted",
    "Won",
    "Lost",
  ]),
});

export const settingsSchema = z.object({
  google_drive_folder_id: z.string().min(1, "Folder ID is required"),
});

export const companySearchSchema = z.object({
  company: z.string().min(1, "Company name is required"),
});

export const emailGenerateSchema = z.object({
  company_name: z.string().min(1),
  contact_name: z.string().optional(),
  contact_id: z.string().uuid().optional(),
  position: z.string().optional(),
  email: z.string().optional(),
  profile_url: z.string().optional(),
  prospect_id: z.string().uuid().optional(),
  projects: z
    .array(
      z.object({
        id: z.string(),
        project_name: z.string().nullable(),
        industry: z.string().nullable(),
        chunk_text: z.string(),
        similarity: z.number(),
      })
    )
    .optional(),
});

export const outreachWorkflowSchema = z.object({
  prospect_id: z.string().uuid(),
});
