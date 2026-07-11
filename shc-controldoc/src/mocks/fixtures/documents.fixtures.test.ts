import { describe, expect, it } from 'vitest';
import { documentFixtures } from './documents.fixtures';

describe('documentFixtures', () => {
  it('no tiene ids duplicados entre documentos', () => {
    const ids = documentFixtures.map((doc) => doc.id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);

    expect(duplicates).toEqual([]);
  });
});
