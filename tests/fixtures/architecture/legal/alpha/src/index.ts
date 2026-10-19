// @ts-nocheck

import { join } from 'node:path';
import { readBeta } from '@fixture/beta/core';
import { describe } from './util.js';

export function report(): string {
  return join(describe(readBeta()), 'report');
}
