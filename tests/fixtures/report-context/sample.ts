import type { ContextItem, ReportSnapshot } from '../../../packages/protocol/dist/index.js';

// Fixed, synthetic controller input. These identities do not refer to a real library/project.
export const studies = [
  {
    objectId: 'trial-a',
    name: '林 2021',
    year: 2021,
    method: '随机试验',
    semantics: '比较剂量10与20，样本80人；结论需要核查。',
    sourceIndexes: [0, 2],
  },
  {
    objectId: 'trial-b',
    name: '赵 2023',
    year: 2023,
    method: '随机试验',
    semantics: '比较剂量20与30，样本120人；报告为固定合成样本。',
    sourceIndexes: [0, 1],
  },
  {
    objectId: 'cohort-c',
    name: '周 2020',
    year: 2020,
    method: '队列研究',
    semantics: '观察剂量与结果的关联，不能据此判断因果。',
    sourceIndexes: [2],
  },
  ...Array.from({ length: 14 }, (_, index) => ({
    objectId: `capacity-${index}`,
    name: `容量样本 ${index + 1}`,
    year: 2000 + index,
    method: '容量样本',
    semantics: '用于整批容量拒绝的固定合成对象。',
    sourceIndexes: [0],
  })),
];

export function snapshotFor(generation: number): ReportSnapshot {
  return {
    resource: {
      ref: { source: 'project', projectId: 'sample-project', fileId: 'comparison' },
      basis: `fixture-report-v${generation}`,
      name: '固定文献对比',
      format: 'html',
      capabilities: { read: true, write: false, readingRecords: false, render: false },
    },
    manifest: {
      version: 1,
      resources: [],
      sources: [
        {
          ref: { source: 'library', attachmentId: 'sample-paper', materialVersionId: 'paper-v1' },
          basis: 'paper-v1',
        },
        {
          ref: { source: 'library', attachmentId: 'sample-paper', materialVersionId: 'paper-v2' },
          basis: 'paper-v2',
        },
        {
          ref: { source: 'project', projectId: 'sample-project', fileId: 'notes' },
          basis: 'notes-v1',
        },
      ],
      objects: studies.map(({ objectId, name, semantics, sourceIndexes }) => ({
        objectId,
        name,
        semantics,
        sourceIndexes,
      })),
    },
  };
}

export const originalItem: ContextItem = {
  kind: 'text',
  itemId: 'original-context',
  ref: { source: 'project', projectId: 'sample-project', fileId: 'notes' },
  basis: 'notes-v1',
  quote: '原来已附加的摘录',
  contentState: 'saved',
  comment: '保留原批注',
};
