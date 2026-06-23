import { z } from "zod";

export const settingsSchema = z.object({
  google_drive_folder_ids: z.array(z.string()).min(1, "At least one folder ID is required"),
  case_studies_sheet_url: z.string().optional().or(z.literal('')),
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
  location: z.string().nullish(),
  expertise_tags: z.array(z.string()).nullish(),
  technology_tags: z.array(z.string()).nullish(),
  activity_signals: z.array(z.string()).nullish(),
  projects: z
    .array(
      z.object({
        id: z.string(),
        project_name: z.string().nullable(),
        industry: z.string().nullable(),
        chunk_text: z.string(),
        similarity: z.number(),
        blog_url: z.string().nullable().optional(),
        project_summary: z.string().nullable().optional(),
      })
    )
    .optional(),
  recommendation_reason: z.string().nullish(),
  relationship_type: z.string().nullish(),
  provider: z.string().nullish(),
  model: z.string().nullish(),
  conversation_summary: z.string().nullish(),
  discussion_topics: z.string().nullish(),
  recent_highlights: z.string().nullish(),
  interaction_timeline: z.string().nullish(),
  total_messages: z.number().nullish(),
  last_interaction_date: z.string().nullish(),
  connection_owner_name: z.string().nullish(),
  key_interests: z.array(z.string()).nullish(),
  business_context: z.string().nullish(),
  action_items: z.array(z.string()).nullish(),
  engagement_quality: z.string().nullish(),
  recommended_outreach_angle: z.string().nullish(),
  personalization_points: z.array(z.string()).nullish(),
  persistent_context: z.string().nullish(),
  time_bound_context: z.string().nullish(),
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
