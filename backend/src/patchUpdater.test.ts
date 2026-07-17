import { describe, expect, it } from 'vitest';
import { createDatabase } from './db.js';
import { defaultModifierCatalog, type ModifierCatalogEntry } from './modifierCatalog.js';
import {
  activatePatch,
  compareToActive,
  rollbackToVersion,
  runRegressionCheck,
  stagePatch,
  validateModifierCatalog,
} from './patchUpdater.js';

const validEntry = {
  id: 'life',
  group: 'Life',
  type: 'prefix' as const,
  local: false,
  hybrid: false,
  tags: ['life'],
  statKeys: ['life'],
  pattern: '\\+(\\d+) to maximum Life',
  flags: 'i',
  label: '+# to maximum Life',
  validClasses: [],
};

describe('validateModifierCatalog', () => {
  it('accepts a well-formed catalog and normalizes casing/whitespace', () => {
    const result = validateModifierCatalog([{ ...validEntry, tags: [' Life '], validClasses: [' Boots '] }]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entries[0].tags).toEqual(['life']);
      expect(result.entries[0].validClasses).toEqual(['boots']);
    }
  });

  it('rejects a catalog with duplicate ids', () => {
    const result = validateModifierCatalog([validEntry, { ...validEntry }]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/Duplicate modifier id/);
  });

  it('rejects an entry with an invalid regular expression pattern', () => {
    const result = validateModifierCatalog([{ ...validEntry, pattern: '(unterminated' }]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/invalid regular expression/);
  });

  it('rejects an empty catalog', () => {
    const result = validateModifierCatalog([]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/no valid modifier entries/);
  });

  it('rejects a payload that does not match the schema shape', () => {
    const result = validateModifierCatalog([{ id: 'life' }]);
    expect(result.ok).toBe(false);
  });
});

describe('runRegressionCheck', () => {
  it('passes when the candidate recognizes at least what the active catalog recognizes', () => {
    const result = runRegressionCheck(defaultModifierCatalog, defaultModifierCatalog);
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('fails and reports an issue when the candidate loses a fixture the active catalog still recognizes', () => {
    const withoutLife = defaultModifierCatalog.filter((entry: ModifierCatalogEntry) => entry.id !== 'life');
    const result = runRegressionCheck(withoutLife, defaultModifierCatalog);
    expect(result.passed).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

describe('compareToActive', () => {
  it('computes added, removed and unchanged ids', () => {
    const active = [
      { ...validEntry, id: 'a' },
      { ...validEntry, id: 'b' },
    ] as ModifierCatalogEntry[];
    const candidate = [
      { ...validEntry, id: 'b' },
      { ...validEntry, id: 'c' },
    ] as ModifierCatalogEntry[];
    const result = compareToActive(candidate, active);
    expect(result.addedIds).toEqual(['c']);
    expect(result.removedIds).toEqual(['a']);
    expect(result.unchangedCount).toBe(1);
  });
});

describe('rollbackToVersion', () => {
  it('refuses to roll back a version that was never active', () => {
    const db = createDatabase(':memory:');
    const staged = stagePatch(db, {
      patch: '0.5.x',
      dataVersion: 'test-1',
      source: 'test',
      entries: defaultModifierCatalog,
    });
    expect(() => rollbackToVersion(db, staged.id)).toThrow(/previously active/);
  });

  it('reactivates a deprecated version after a newer one is activated', () => {
    const db = createDatabase(':memory:');
    const first = stagePatch(db, {
      patch: '0.5.x',
      dataVersion: 'test-first',
      source: 'test',
      entries: defaultModifierCatalog,
    });
    activatePatch(db, first.id);
    const second = stagePatch(db, {
      patch: '0.5.x',
      dataVersion: 'test-second',
      source: 'test',
      entries: defaultModifierCatalog,
    });
    activatePatch(db, second.id);
    const rolledBack = rollbackToVersion(db, first.id);
    expect(rolledBack.status).toBe('active');
    expect(rolledBack.id).toBe(first.id);
  });
});
