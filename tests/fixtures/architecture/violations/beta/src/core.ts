// @ts-nocheck
import { marker } from './internal.js';

export type BetaShape = { marker: string };

export function readBeta(): string {
  return marker;
}
