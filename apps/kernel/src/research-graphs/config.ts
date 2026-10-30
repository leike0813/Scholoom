import type { ResourceEvidence } from '@scholoom/protocol/resources';
import { resourceEvidenceSchema } from '@scholoom/protocol/resources';
import { z } from 'zod';

const evidence = z.fromJSONSchema(
  JSON.parse(JSON.stringify(resourceEvidenceSchema)),
) as z.ZodType<ResourceEvidence>;
const target = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('create'), path: z.string().min(1).max(1024) }).strict(),
  z.object({ kind: z.literal('update'), resource: evidence }).strict(),
]);
export const synthesisConfig = z
  .object({
    question: z.string().trim().min(1).max(8192),
    constraints: z.string().max(8192).optional(),
    reportTarget: target,
    processTarget: target,
    prior: z.array(evidence).max(10).optional(),
    requireIndependentReview: z.boolean(),
  })
  .strict();
export type SynthesisConfig = z.infer<typeof synthesisConfig>;
export const synthesisConfigSchema = z.toJSONSchema(synthesisConfig, { target: 'draft-7' });
