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
export const ScriptUpdateSchema = ScriptCreateSchema.partial().extend({
  status: ScriptStatusSchema.optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });
export type ScriptUpdate = z.infer<typeof ScriptUpdateSchema>;
