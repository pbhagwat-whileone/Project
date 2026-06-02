import { z } from "zod";

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
  recommendation_reason: z.string().optional(),
});

export const recommendationOutreachSchema = z.object({
  company_name: z.string().min(1, "Company name is required"),
});

export const recommendationDetailSchema = z.object({
  company: z.string().min(1, "Company name is required"),
});
