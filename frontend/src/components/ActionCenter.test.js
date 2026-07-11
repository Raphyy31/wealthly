import { describe, expect, test } from 'vitest';
import { needsTransactionReview } from './ActionCenter.jsx';

describe('needsTransactionReview', () => {
  test('surfaces pending and uncategorized operations', () => {
    expect(needsTransactionReview({ id: '1', reviewStatus: 'pending', categoryId: 'courses', catSource: 'llm' })).toBe(true);
    expect(needsTransactionReview({ id: '2', categoryId: 'uncategorized', catSource: 'unknown' })).toBe(true);
  });

  test('does not reopen an explicitly reviewed or internal transfer operation', () => {
    expect(needsTransactionReview({ id: '1', reviewStatus: 'reviewed', categoryId: 'uncategorized', catSource: 'unknown' })).toBe(false);
    expect(needsTransactionReview({ id: '2', reviewStatus: 'pending', categoryId: 'courses' }, new Set(['2']))).toBe(false);
  });
});
