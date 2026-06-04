import { z } from "zod";

export const settingsSchema = z.object({
  google_drive_folder_ids: z.array(z.string()).min(1, "At least one folder ID is required"),
});

export const companySearchSchema = z.object({
  company: z.string().min(1, "Company name is required"),
});

export const emailGenerateSchema = z.object({
  company_name: z.string().min(1),
  contact_name: z.string().nullish(),
  contact_id: z.string().uuid().nullish(),
  position: z.string().nullish(),
  email: z.string().nullish(),
  profile_url: z.string().nullish(),
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
  recommendation_reason: z.string().nullish(),
  relationship_type: z.string().nullish(),
  provider: z.string().nullish(),
  model: z.string().nullish(),
});

export const emailRefineSchema = z.object({
  email_id: z.string().uuid(),
  current_subject: z.string().min(1),
  current_body: z.string().min(1),
  instructions: z.string().min(1),
  provider: z.string().nullish(),
  model: z.string().nullish(),
  context: z.object({
    company: z.string().nullish(),
    contactName: z.string().nullish(),
    relationship: z.string().nullish(),
  }).optional(),
});

export const recommendationOutreachSchema = z.object({
  company_name: z.string().min(1, "Company name is required"),
  relationship_type: z.string().nullish(),
  provider: z.string().nullish(),
  model: z.string().nullish(),
});

export const recommendationDetailSchema = z.object({
  company: z.string().min(1, "Company name is required"),
});

export const emailUpdateSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
});
