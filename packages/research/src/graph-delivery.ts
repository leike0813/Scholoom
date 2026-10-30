import { isDeepStrictEqual } from 'node:util';
import type { GraphProgress } from '@scholoom/protocol/execution';
import type { ResearchGraph, ResearchGraphDelivery } from '@scholoom/protocol/research';
import type {
  ResourceEvidence,
  ResourceOutputs,
  ResourceSaveResult,
} from '@scholoom/protocol/resources';

type Read = ResourceOutputs['resources.read'];
export type GraphDeliveryChecks = {
  reads: Read[];
  artifacts: {
    role: string;
    result: ResourceSaveResult;
    read?: Read;
    save?: { saved: 'confirmed' | 'unknown'; associated: boolean };
  }[];
};
const same = (a: ResourceEvidence, b: ResourceEvidence) =>
  a.basis === b.basis && isDeepStrictEqual(a.ref, b.ref);
export const completeTextRead = (read: Read) =>
  read.unit === 'utf16' &&
  read.offset === 0 &&
  !read.truncated &&
  read.nextOffset === undefined &&
  read.data.length === read.size &&
  read.size > 0;

export function assessGraphDelivery(
  graph: ResearchGraph,
  materials: readonly ResourceEvidence[],
  progress: GraphProgress | undefined,
  checks: GraphDeliveryChecks,
): ResearchGraphDelivery {
  const issues: ResearchGraphDelivery['issues'] = [];
  for (const material of materials)
    if (
      !progress?.evidence.reads.some((item) => same(item, material)) ||
      !checks.reads.some((read) => same(read, material) && completeTextRead(read))
    )
      issues.push({ code: 'inputNotRead', resource: material });
  for (const role of graph.delivery.roles) {
    const artifact = checks.artifacts.find((item) => item.role === role);
    const roleResults = progress?.evidence.roleResults;
    const saved =
      roleResults !== undefined
        ? artifact?.save?.saved === 'confirmed'
        : artifact &&
          progress?.evidence.results.find((result) =>
            same(result.resource, artifact.result.resource),
          );
    if (!artifact || !saved) {
      issues.push({ code: 'artifactMissing', role });
      if (!artifact || roleResults === undefined) continue;
    }
    if (
      roleResults !== undefined
        ? !artifact.save?.associated
        : artifact.result.association?.state !== 'confirmed' ||
          typeof saved !== 'object' ||
          saved.association?.state !== 'confirmed' ||
          artifact.result.association.operationId !== saved.association.operationId
    )
      issues.push({ code: 'associationIncomplete', role });
    if (
      !artifact.read ||
      !same(artifact.read, artifact.result.resource) ||
      !completeTextRead(artifact.read) ||
      !artifact.read.data.trim()
    )
      issues.push({ code: 'artifactUnavailable', role });
  }
  if (progress?.kind !== 'graph.completed') issues.push({ code: 'executionIncomplete' });
  return {
    delivery: !issues.length ? 'usable' : progress ? 'incomplete' : 'pending',
    researchAssessment: 'notAssessed',
    issues,
  };
}
