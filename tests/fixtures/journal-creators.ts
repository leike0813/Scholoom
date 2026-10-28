import type { OriginalRecord } from '../../packages/protocol/dist/library.js';

export const journalCreatorSamples: { title: string; creators: OriginalRecord['creators'] }[] = [
  {
    title: 'Chinese creator preservation',
    creators: [
      { creatorType: 'author', lastName: '欧阳明', firstName: '', fieldMode: 1 },
      { creatorType: 'translator', firstName: 'Grace', lastName: 'Hopper', fieldMode: 0 },
    ],
  },
  {
    title: 'Independent creator transaction',
    creators: [{ creatorType: 'author', firstName: 'Ada', lastName: 'Chen', fieldMode: 0 }],
  },
];
