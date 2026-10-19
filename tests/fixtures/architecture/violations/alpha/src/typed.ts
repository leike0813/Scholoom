// @ts-nocheck
import type { Stats } from 'node:fs';
import type { BetaShape } from '@fixture/beta/core';
import type { Missing } from '@fixture/missing';

export type Snapshot = { stats: Stats; beta: BetaShape; missing: Missing };
