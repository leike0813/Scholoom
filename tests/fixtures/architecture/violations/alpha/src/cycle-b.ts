// @ts-nocheck
import { fromA } from './cycle-a.js';

export const fromB = fromA + 1;
