import { z } from 'zod';
export const HealthResponseSchema=z.object({ok:z.literal(true),service:z.string(),version:z.string()});
export type HealthResponse=z.infer<typeof HealthResponseSchema>;
export const ProjectCreateSchema=z.object({workspaceId:z.string().uuid(),title:z.string().trim().min(1).max(160),description:z.string().max(4000).optional(),language:z.string().min(2).max(12).default('id'),platforms:z.array(z.enum(['youtube','instagram','tiktok','facebook','other'])).max(10).default([])});
export type ProjectCreate=z.infer<typeof ProjectCreateSchema>;
export const JobStatusSchema=z.enum(['queued','running','succeeded','failed','cancelled']);
export type JobStatus=z.infer<typeof JobStatusSchema>;

export const ScriptCreateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  hook: z.string().max(5000).nullable().optional(),
  outline: z.array(z.string().max(1000)).max(50).default([]),
  body: z.string().max(100000).default(''),
  callToAction: z.string().max(2000).nullable().optional(),
  targetDurationSeconds: z.number().int().positive().max(3600).nullable().optional(),
  language: z.string().min(2).max(12).default('id'),
});
export type ScriptCreate = z.infer<typeof ScriptCreateSchema>;
export const ScriptStatusSchema = z.enum(['draft', 'review', 'approved']);
export const ScriptUpdateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  hook: z.string().max(5000).nullable().optional(),
  outline: z.array(z.string().max(1000)).max(50).optional(),
  body: z.string().max(100000).optional(),
  callToAction: z.string().max(2000).nullable().optional(),
  targetDurationSeconds: z.number().int().positive().max(3600).nullable().optional(),
  language: z.string().min(2).max(12).optional(),
  status: ScriptStatusSchema.optional(),
}).refine((value) => Object.values(value).some((item) => item !== undefined), { message: 'At least one field is required' });
export type ScriptUpdate = z.infer<typeof ScriptUpdateSchema>;

export const ResearchSourceTypeSchema = z.enum(['url', 'article', 'report', 'dataset', 'manual', 'other']);
export const ResearchLicenseStatusSchema = z.enum([
  'unknown', 'public_domain', 'cc0', 'cc_by', 'cc_by_sa', 'licensed', 'permission_required', 'restricted',
]);
export const ResearchSourceCreateSchema = z.object({
  title: z.string().trim().min(2).max(300),
  url: z.string().url().max(2048).refine((value) => value.startsWith('https://') || value.startsWith('http://')).nullable().optional(),
  sourceType: ResearchSourceTypeSchema.default('url'),
  excerpt: z.string().max(20000).nullable().optional(),
  licenseStatus: ResearchLicenseStatusSchema.default('unknown'),
  rightsNotes: z.string().max(4000).nullable().optional(),
});
export type ResearchSourceCreate = z.infer<typeof ResearchSourceCreateSchema>;

export const ResearchReportCreateSchema = z.object({
  topic: z.string().trim().min(2).max(300),
  audience: z.string().max(300).nullable().optional(),
  language: z.string().min(2).max(12).default('id'),
  report: z.object({
    summary: z.string().max(20000).default(''),
    keyFindings: z.array(z.string().max(3000)).max(50).default([]),
    recommendations: z.array(z.string().max(3000)).max(50).default([]),
    sourceIds: z.array(z.string().uuid()).max(100).default([]),
    limitations: z.string().max(5000).default(''),
  }).default({}),
});
export type ResearchReportCreate = z.infer<typeof ResearchReportCreateSchema>;
