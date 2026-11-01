import { z } from 'zod';
export const HealthResponseSchema=z.object({ok:z.literal(true),service:z.string(),version:z.string()});
export type HealthResponse=z.infer<typeof HealthResponseSchema>;
export const ProjectCreateSchema=z.object({workspaceId:z.string().uuid(),title:z.string().trim().min(1).max(160),description:z.string().max(4000).optional(),language:z.string().min(2).max(12).default('id'),platforms:z.array(z.enum(['youtube','instagram','tiktok','facebook','other'])).max(10).default([])});
export type ProjectCreate=z.infer<typeof ProjectCreateSchema>;
export const JobStatusSchema=z.enum(['queued','running','succeeded','failed','cancelled']);
export type JobStatus=z.infer<typeof JobStatusSchema>;
