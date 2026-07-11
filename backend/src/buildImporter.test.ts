import { describe, expect, it } from 'vitest';
import { parseBuildGuide, parseMobalyticsGuide, validateBuildUrl, validateMobalyticsUrl } from './buildImporter.js';

const guide = `Title: 0.5 Fubgun Ice Shot Deadeye - PoE 2 Ranger Build Guide

Markdown Content:
## Build Overview
This is my Endgame Guide for ![Image](https://cdn.example/IceShot.webp) Ice Shot. This is a non-crit and pure life/evasion setup entering maps.

Equipment Priority

**Mandatory Stats:** Fill out your resist; you want 75% fire/cold/lightning resist. Chaos resist is good but not mandatory.
**Bow:** You want the highest dps ele/phys weapon you can afford.
**Quiver:** Projectile speed with attack speed.
**amulet:** Prefer +proj levels. Crit chance and critical damage are good. You need at least 30 spirit on the amulet.
**Helmet:** High life/evasion/resist.
**Chest:** Highest evasion chest you can afford.
**Boots:** Highest movement speed, life and resistance.
**Rings/glove:** High flat damage to attacks.
Rarity is still really good.

## Skill Gems
Ice Shot
`;

describe('Mobalytics build importer', () => {
  it('extracts identity, stage, defence and equipment priorities', () => {
    const result = parseMobalyticsGuide(guide, 'https://mobalytics.gg/poe-2/builds/ice-shot-deadeye');
    expect(result.provider).toBe('Mobalytics');
    expect(result.profile).toMatchObject({ className: 'Ranger', ascendancy: 'Deadeye', mainSkill: 'Ice Shot', stage: 'early-maps', evaluationStyle: 'balanced', defenceStyle: 'life-evasion' });
    expect(result.profile.priorities).toContainEqual({ stat: 'spirit', level: 'required', minimum: 30 });
    expect(result.profile.priorities).toContainEqual({ stat: 'movementSpeed', level: 'high' });
    expect(result.profile.priorities.find((row) => row.stat === 'fireResistance')?.level).toBe('required');
    expect(result.profile.priorities.find((row) => row.stat === 'chaosResistance')?.level).toBe('useful');
    expect(result.profile.priorities.find((row) => row.stat === 'energyShield')?.level).toBeUndefined();
    expect(result.profile.requiredMods).toContain('[amulet] level of all projectile skills');
    expect(result.equipmentSummary).toMatch(/Highest movement speed/i);
    expect(result.method).toBe('jina-reader');
    expect(result.partial).toBe(false);
    expect(typeof result.importedAt).toBe('string');
    const classNameField = result.fields.find((f) => f.field === 'className');
    expect(classNameField).toMatchObject({ value: 'Ranger', confidence: 'Medium', needsConfirmation: false });
    const prioritiesField = result.fields.find((f) => f.field === 'priorities');
    expect(prioritiesField?.needsConfirmation).toBe(false);
  });

  it('flags a partial import when core fields cannot be reliably detected instead of silently reporting success', () => {
    const result = parseBuildGuide('Title: Untitled\n\nSome unrelated marketing copy that mentions no class, skill, or stat priority at all.', 'https://mobalytics.gg/poe-2/builds/unknown-build', 'Mobalytics');
    expect(result.partial).toBe(true);
    expect(result.fields.find((f) => f.field === 'className')).toMatchObject({ value: '(not detected)', confidence: 'Low', needsConfirmation: true });
    expect(result.warnings.some((w) => /partial/i.test(w))).toBe(true);
  });

  it('rejects non-Mobalytics and non-PoE build URLs', () => {
    expect(() => validateMobalyticsUrl('http://mobalytics.gg/poe-2/builds/test')).toThrow(/HTTPS/i);
    expect(() => validateMobalyticsUrl('https://example.com/poe-2/builds/test')).toThrow(/mobalytics/i);
    expect(() => validateMobalyticsUrl('https://mobalytics.gg/lol/builds/test')).toThrow(/PoE 2/i);
  });

  it('accepts popular PoE 2 build providers and rejects unrelated pages', () => {
    expect(validateBuildUrl('https://poe.ninja/poe2/builds/runesofaldur/character/account/name?search=skills%3DIce%2BShot').provider).toBe('poe.ninja');
    expect(validateBuildUrl('https://poe2.ninja/poe2/pob/2370c').url.hostname).toBe('poe.ninja');
    expect(validateBuildUrl('https://maxroll.gg/poe2/build-guides/permafrost-bolt-witchhunter-build-guide').provider).toBe('Maxroll');
    expect(validateBuildUrl('https://www.poe-vault.com/poe2/mercenary/tactician/galvanic-shards-leveling-build').provider).toBe('PoE Vault');
    expect(validateBuildUrl('https://pobb.in/HlipAJFWM6Mi').provider).toBe('pobb.in');
    expect(() => validateBuildUrl('https://poe-vault.com/poe2/guides/currency')).toThrow(/Supported build links/i);
  });

  it('extracts a poe.ninja PoB snapshot identity and campaign-safe defaults', () => {
    const content = `Level 91 Deadeye - Path of Exile 2 - poe.ninja\nLife: 1540 - ES: 1130 - Mana: 989\nSkills: Ice Shot, Herald of Ice, Snipe`;
    const result = parseBuildGuide(content, 'https://poe.ninja/poe2/pob/2370c', 'poe.ninja');
    expect(result.profile).toMatchObject({ className:'Ranger', ascendancy:'Deadeye', mainSkill:'Ice Shot' });
    expect(result.profile.priorities).toContainEqual({ stat:'movementSpeed', level:'high' });
    expect(result.profile.priorities).toContainEqual({ stat:'coldResistance', level:'high' });
  });

  it('maps a Maxroll ascendancy to its base class and main skill', () => {
    const content = `Title: Permafrost Bolt Witchhunter Build Guide for Path of Exile 2\nThe Permafrost Bolt Witchhunter for the Mercenary class uses Evasion and Armour.\nStat Priorities\nLife, resistances, movement speed and attack speed.`;
    const result = parseBuildGuide(content, 'https://maxroll.gg/poe2/build-guides/permafrost-bolt-witchhunter-build-guide', 'Maxroll');
    expect(result.profile).toMatchObject({ className:'Mercenary', ascendancy:'Witchhunter', mainSkill:'Permafrost Bolt', defenceStyle:'hybrid' });
  });

  it('uses PoE Vault path identity without mistaking navigation text for the build', () => {
    const content = `Galvanic Shards Mercenary Leveling Build\nMain Skill: Endgame\nThis Tactician uses Galvanic Shards with life and evasion gear.\nClass: Mercenary\nAscendancy: Tactician`;
    const result = parseBuildGuide(content, 'https://poe-vault.com/poe2/mercenary/tactician/galvanic-shards-leveling-build', 'PoE Vault');
    expect(result.profile).toMatchObject({ className:'Mercenary', ascendancy:'Tactician', mainSkill:'Galvanic Shards', stage:'campaign' });
  });
});
