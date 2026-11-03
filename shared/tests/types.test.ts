import { describe, expect, it } from 'vitest';
import { assertNever, entityId, inputSeq, stepNumber } from '../types.ts';

describe('branded type constructors and exhaustive guard', () => {
  it('creates an entity id without changing its runtime number', () => expect(entityId(12)).toBe(12));
  it('creates a step number without changing its runtime number', () => expect(stepNumber(45)).toBe(45));
  it('creates an input sequence without changing its runtime number', () => expect(inputSeq(99)).toBe(99));
  it('throws when an exhaustive switch receives an unexpected value', () => expect(() => assertNever('unexpected' as never)).toThrow(/Unhandled/));
});
