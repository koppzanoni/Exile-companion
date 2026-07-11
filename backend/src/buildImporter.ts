import { createBuildProfileFromPriorities } from './buildProfiles.js';
import type { BuildFitProfile, BuildPriority, BuildStat } from './types.js';

export interface ImportedField { field: string; value: string; excerpt: string; confidence: 'High' | 'Medium' | 'Low'; needsConfirmation: boolean }

export interface BuildImportResult {
  profile: BuildFitProfile;
  source: 'direct' | 'reader';
  provider: BuildProvider;
  equipmentSummary: string;
  detected: string[];
  fields: ImportedField[];
  method: 'direct-html' | 'jina-reader';
  importedAt: string;
  partial: boolean;
  warnings: string[];
}

export type BuildProvider = 'Mobalytics' | 'poe.ninja' | 'Maxroll' | 'PoE Vault' | 'pobb.in';

export async function importBuildGuide(rawUrl: string): Promise<BuildImportResult> {
  const { url, provider } = validateBuildUrl(rawUrl);
  let content = '';
  let source: BuildImportResult['source'] = 'direct';
  const warnings: string[] = [];

  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'RelicLens/1.0 (+local PoE 2 build analyzer)', Accept: 'text/html,application/xhtml+xml' }, signal: AbortSignal.timeout(12_000) });
    const body = await limitedText(response);
    if (!response.ok || /Just a moment|cdn-cgi\/challenge-platform|Enable JavaScript and cookies|Worker threw exception/i.test(body)) throw new Error(`${provider} blocked the direct request`);
    content = `${htmlToText(body)}\n${extractMetadata(body)}\n${urlHints(url, provider)}`;
  } catch {
    source = 'reader';
    warnings.push(`${provider} blocked direct server access, so the page was read through Jina AI Reader. Review the imported priorities before saving.`);
    const readerUrl = `https://r.jina.ai/http://${url.host}${url.pathname}${url.search}`;
    const response = await fetch(readerUrl, { headers: { Accept: 'text/markdown', 'X-Return-Format': 'markdown', 'User-Agent': 'RelicLens/1.0' }, signal: AbortSignal.timeout(35_000) });
    content = await limitedText(response);
    if (!response.ok) throw new Error(`Guide reader returned HTTP ${response.status}`);
    content += `\n${urlHints(url, provider)}`;
  }

  if (content.trim().length < 40) throw new Error(`This ${provider} page did not expose enough build information.`);
  if (provider === 'poe.ninja') warnings.push('poe.ninja represents a character snapshot rather than a leveling guide. Relic Lens adapts its skill and defensive archetype to your selected level instead of copying endgame item requirements.');
  return parseBuildGuide(content, url.toString(), provider, source, warnings);
}

export const importMobalyticsBuild = importBuildGuide;

export function parseMobalyticsGuide(content: string, guideUrl: string, source: BuildImportResult['source'] = 'reader', warnings: string[] = []): BuildImportResult {
  return parseBuildGuide(content, guideUrl, 'Mobalytics', source, warnings);
}

export function parseBuildGuide(content: string, guideUrl: string, provider: BuildProvider, source: BuildImportResult['source'] = 'reader', warnings: string[] = []): BuildImportResult {
  const clean = cleanMarkdown(content);
  const title = firstMatch(clean, /(?:^|\n)Title:\s*(.+?)(?:\n|$)/i) || firstMatch(clean, /(?:^|\n)#\s+(.+?)(?:\n|$)/) || firstMatch(clean, /^([^\n]{5,180})(?:\n|$)/) || titleFromUrl(guideUrl);
  const buildTitle = title.replace(/\s*-\s*Path of Exile 2.*$/i, '').replace(/\s+(?:Build Guide )?for Path of Exile 2.*$/i, '').replace(/\s*-\s*PoE 2.*$/i, '').replace(/^\[?0\.\d+(?:\.\d+)?\]?\s*/i, '').replace(/&gt;|>+/gi, '').trim();
  const ascendancies = ['Deadeye', 'Pathfinder', 'Titan', 'Warbringer', 'Smith of Kitava', 'Stormweaver', 'Chronomancer', 'Blood Mage', 'Infernalist', 'Lich', 'Invoker', 'Acolyte of Chayula', 'Witchhunter', 'Gemling Legionnaire', 'Tactician', 'Amazon', 'Ritualist', 'Shaman', 'Oracle', 'Spirit Walker', 'Disciple of Varashta'];
  const explicitAscendancy = firstMatch(clean, /(?:^|\n)Ascendancy:\s*([^\n]+)/i);
  const ascendancy = detectOne(`${buildTitle}\n${explicitAscendancy}`, ascendancies) || detectOne(clean.slice(0, 2500), ascendancies);
  const explicitClass = firstMatch(clean, /(?:^|\n)Class:\s*([^\n]+)/i);
  const className = detectOne(explicitClass, ['Warrior', 'Ranger', 'Sorceress', 'Monk', 'Mercenary', 'Witch', 'Huntress', 'Druid', 'Shadow']) || classForAscendancy(ascendancy) || detectOne(`${title}\n${clean.slice(0, 5000)}`, ['Warrior', 'Ranger', 'Sorceress', 'Monk', 'Mercenary', 'Witch', 'Huntress', 'Druid', 'Shadow']) || 'Unknown class';
  const overview = firstSections(clean, ['Build Overview', 'Build Introduction', 'Introduction', 'Summary'], ['Build Variants', 'Equipment', 'Skills', 'Passives']).slice(0, 3000);
  const equipment = firstSections(clean, ['Equipment Priority', 'Stat Priorities', 'Gearing', 'Gear', 'Equipment'], ['Skill Gems', 'Gem Priority', 'Passive Tree', 'Passives', 'FAQ', 'Video']).slice(0, 16_000);
  const mainSkill = detectMainSkill(`${overview}\n${clean.slice(0, 5000)}\n${urlHints(new URL(guideUrl), provider)}`, buildTitle, className, ascendancy, provider);
  const combined = `${overview}\n${equipment}`;
  const stage: BuildFitProfile['stage'] = /levell?ing|campaign/i.test(title) ? 'campaign' : /early map|entering maps|midgame/i.test(combined) ? 'early-maps' : 'endgame';
  const defenceStyle = detectDefence(`${combined}\n${clean.slice(0, 20_000)}`);
  const priorities = inferPriorities(equipment || clean.slice(0, 20_000), defenceStyle);
  addCampaignDefaults(priorities, defenceStyle);
  const { requiredMods, desiredMods } = inferModifiers(equipment);
  const detected = [className !== 'Unknown class' && className, ascendancy, mainSkill, `${priorities.length} stat priorities`, `${requiredMods.length + desiredMods.length} modifier phrases`].filter((value): value is string => Boolean(value));
  if (!mainSkill) warnings.push('The main skill could not be identified reliably; enter it before saving.');
  if (!priorities.length) warnings.push('No supported item stats were recognized; add priorities manually.');

  const fields: ImportedField[] = [
    fieldEntry(clean, 'className', className === 'Unknown class' ? '' : className, /(?:^|\n)Class:\s*[^\n]+/i),
    fieldEntry(clean, 'ascendancy', ascendancy, /(?:^|\n)Ascendancy:\s*[^\n]+/i),
    fieldEntry(clean, 'mainSkill', mainSkill, /(?:^|\n)\s*>?\s*(?:Primary Skill|Main Skill|URL Skill):\s*[^\n]+/i),
    fieldEntry(clean, 'defenceStyle', defenceStyle === 'custom' ? '' : defenceStyle),
    fieldEntry(clean, 'stage', stage),
    { field: 'priorities', value: `${priorities.length} stat priorities`, excerpt: '', confidence: priorities.length ? 'Medium' : 'Low', needsConfirmation: priorities.length === 0 },
    { field: 'modifiers', value: `${requiredMods.length + desiredMods.length} modifier phrases`, excerpt: '', confidence: requiredMods.length + desiredMods.length ? 'Medium' : 'Low', needsConfirmation: requiredMods.length + desiredMods.length === 0 },
  ];
  const partial = fields.some((f) => f.needsConfirmation && (f.field === 'className' || f.field === 'mainSkill'));
  if (partial) warnings.push('This import is partial: some core fields could not be reliably detected and require manual confirmation before saving.');

  const slug = `imported:${(buildTitle || titleFromUrl(guideUrl)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'build'}`;
  return {
    profile: createBuildProfileFromPriorities(slug, { name: buildTitle || titleFromUrl(guideUrl), className, ascendancy, mainSkill, guideUrl, stage, evaluationStyle: 'balanced', defenceStyle, priorities, requiredMods, desiredMods, notes: `Imported from ${provider}.\n\nEquipment summary:\n${(equipment || overview || clean).slice(0, 1800)}` }),
    source, provider, equipmentSummary: (equipment || overview || clean).slice(0, 3000), detected, fields,
    method: source === 'direct' ? 'direct-html' : 'jina-reader', importedAt: new Date().toISOString(), partial, warnings,
  };
}

function fieldEntry(clean: string, field: string, value: string, explicitPattern?: RegExp): ImportedField {
  if (!value) return { field, value: '(not detected)', excerpt: '', confidence: 'Low', needsConfirmation: true };
  const explicit = explicitPattern ? clean.match(explicitPattern) : null;
  if (explicit) return { field, value, excerpt: explicit[0].trim().slice(0, 160), confidence: 'High', needsConfirmation: false };
  const idx = clean.toLowerCase().indexOf(value.toLowerCase());
  const excerpt = idx >= 0 ? clean.slice(Math.max(0, idx - 40), idx + value.length + 40).trim() : '';
  return { field, value, excerpt, confidence: 'Medium', needsConfirmation: false };
}

export function validateBuildUrl(rawUrl: string): { url: URL; provider: BuildProvider } {
  let url: URL;
  try { url = new URL(rawUrl.trim()); } catch { throw new Error('Enter a valid build URL.'); }
  if (url.protocol !== 'https:') throw new Error('Build links must use HTTPS.');
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  let provider: BuildProvider;
  if (host === 'mobalytics.gg' && /^\/poe-2\/(?:builds\/|profile\/[^/]+\/(?:builds|guides)\/)/i.test(url.pathname)) provider = 'Mobalytics';
  else if ((host === 'poe.ninja' || host === 'poe2.ninja') && /^(?:\/poe2\/(?:builds\/[^/]+\/(?:character|char)\/|profile\/|pob\/)|\/pob\/)/i.test(url.pathname)) provider = 'poe.ninja';
  else if (host === 'maxroll.gg' && /^\/poe2\/build-guides\//i.test(url.pathname)) provider = 'Maxroll';
  else if (host === 'poe-vault.com' && /^\/poe2\/(?:druid|huntress|mercenary|monk|ranger|sorceress|warrior|witch)\//i.test(url.pathname)) provider = 'PoE Vault';
  else if (host === 'pobb.in' && /^\/(?:[A-Za-z0-9_-]{5,}|u\/)/.test(url.pathname)) provider = 'pobb.in';
  else throw new Error('Supported build links: Mobalytics, poe.ninja PoE 2, Maxroll PoE 2, PoE Vault PoE 2, and pobb.in.');
  if (host === 'poe2.ninja') { if (/^\/pob\//i.test(url.pathname)) url.pathname = `/poe2${url.pathname}`; url.hostname = 'poe.ninja'; }
  else url.hostname = host;
  url.hash = '';
  return { url, provider };
}

export function validateMobalyticsUrl(rawUrl: string) {
  const result = validateBuildUrl(rawUrl);
  if (result.provider !== 'Mobalytics') throw new Error('Use a PoE 2 build or guide URL from Mobalytics.');
  return result.url;
}

function inferPriorities(text: string, defence: BuildFitProfile['defenceStyle']) {
  const rows: BuildPriority[] = [];
  const add = (stat: BuildStat, level: BuildPriority['level'], minimum?: number) => {
    const current = rows.find((row) => row.stat === stat);
    const rank = { useful: 1, high: 2, required: 3 };
    if (!current) rows.push({ stat, level, minimum });
    else if (rank[level] > rank[current.level]) Object.assign(current, { level, minimum: minimum || current.minimum });
    else if (minimum && !current.minimum) current.minimum = minimum;
  };
  const mandatory = section(text, 'Mandatory Stats', ['Rings', 'Ring', 'Bow', 'Weapon', 'Helmet', 'Boots', 'Belt']).slice(0, 1200);
  if (/\blife\b|maximum life/i.test(text)) add('life', defence === 'energy-shield' ? 'useful' : 'high');
  if (/energy shield|\bES\b/i.test(text)) add('energyShield', defence === 'energy-shield' ? 'required' : defence === 'life-evasion' || defence === 'life-armour' ? 'useful' : 'high');
  if (/\barmou?r\b/i.test(text)) add('armour', defence === 'life-armour' ? 'high' : 'useful');
  if (/\bevasion\b/i.test(text)) add('evasion', defence === 'life-evasion' ? 'high' : 'useful');
  if (/movement speed|movespeed/i.test(text)) add('movementSpeed', 'high');
  for (const [stat, pattern] of [['fireResistance', /fire(?: resistance| resist|\/cold)/i], ['coldResistance', /cold(?: resistance| resist|\/lightning)/i], ['lightningResistance', /lightning(?: resistance| resist| resist\b)/i]] as Array<[BuildStat, RegExp]>) if (pattern.test(text) || /fill out your resist|cap(?:ped)? resist|elemental resist/i.test(text)) add(stat, mandatory && /resist/i.test(mandatory) ? 'required' : 'high');
  const chaosContext = text.match(/[^\n.]*chaos resist[^\n.]*/i)?.[0] || '';
  if (chaosContext) add('chaosResistance', /(?:75%[^\n.]*chaos|chaos[^\n.]*required)/i.test(chaosContext) && !/not mandatory|not required|good,? but/i.test(chaosContext) ? 'required' : 'useful');
  if (/\bstrength\b|\bstr\b/i.test(text)) add('strength', 'useful');
  if (/\bdexterity\b|\bdex\b/i.test(text)) add('dexterity', 'useful');
  if (/\bintelligence\b|\bint\b/i.test(text)) add('intelligence', 'useful');
  const spirit = text.match(/(?:at least|need|want)[^\n.]{0,35}?(\d+)\s+spirit/i) || text.match(/(\d+)\s+spirit/i);
  if (/\bspirit\b/i.test(text)) add('spirit', spirit ? 'required' : 'high', spirit ? Number(spirit[1]) : undefined);
  if (/maximum mana|flat mana|\bmana\b/i.test(text)) add('mana', /archmage|mana stack/i.test(text) ? 'required' : 'useful');
  if (/highest[^\n.]{0,30}(?:physical|phys)[^\n.]{0,15}dps|physical dps|%phys/i.test(text)) add('physicalDps', 'high');
  if (/highest[^\n.]{0,30}(?:elemental|ele)[^\n.]{0,15}dps|elemental dps|flat elemental/i.test(text)) add('elementalDps', 'high');
  if (/attack speed/i.test(text)) add('attacksPerSecond', 'high');
  if (/crit(?:ical)? chance|critical hit chance/i.test(text)) add('criticalHitChance', 'useful');
  if (/\brarity\b|item rarity/i.test(text)) add('rarityFind', 'useful');
  return rows;
}

function inferModifiers(text: string) {
  const requiredMods: string[] = [];
  const desiredMods: string[] = [];
  const add = (target: string[], value: string) => { if (!target.includes(value)) target.push(value); };
  if (/\+(?:#|\d+)?\s*(?:proj|projectile) levels?|level of all projectile skills/i.test(text)) add(requiredMods, '[amulet] level of all projectile skills');
  if (/level of all melee skills|\+[^\n.]{0,12}melee skills/i.test(text)) add(desiredMods, '[weapon] level of all melee skills');
  if (/level of all spell skills|\+[^\n.]{0,12}spell skills/i.test(text)) add(requiredMods, '[weapon] level of all spell skills');
  if (/minions? deal/i.test(text)) add(desiredMods, 'Minions deal');
  if (/spell damage/i.test(text)) add(desiredMods, '[weapon] increased Spell Damage');
  if (/cast speed/i.test(text)) add(desiredMods, '[weapon] increased Cast Speed');
  if (/attack speed/i.test(text)) add(desiredMods, '[weapon] increased Attack Speed');
  if (/critical damage|crit damage/i.test(text)) add(desiredMods, '[jewellery] Critical Damage');
  if (/damage to attacks|flat damage to attacks/i.test(text)) add(desiredMods, '[jewellery] Damage to Attacks');
  return { requiredMods, desiredMods };
}

function detectDefence(text: string): BuildFitProfile['defenceStyle'] {
  if (/pure life\s*\/\s*evasion|life[^\n.]{0,20}evasion|evasion[^\n.]{0,20}life/i.test(text)) return 'life-evasion';
  if (/life[^\n.]{0,20}armou?r|armou?r[^\n.]{0,20}life/i.test(text)) return 'life-armour';
  if (/chaos inoculation|\bCI\b|pure (?:energy shield|ES)|energy shield build/i.test(text)) return 'energy-shield';
  if (/(?:life|evasion|armou?r)[^\n.]{0,35}energy shield|hybrid/i.test(text)) return 'hybrid';
  if (/\blife\b/i.test(text) && /\bES\b/.test(text)) return 'hybrid';
  if (/\bevasion\b/i.test(text) && /\barmou?r\b/i.test(text)) return 'hybrid';
  if (/\bevasion\b/i.test(text)) return 'life-evasion';
  if (/\barmou?r\b/i.test(text)) return 'life-armour';
  return 'custom';
}

function detectMainSkill(overview: string, title: string, className: string, ascendancy: string, provider: BuildProvider) {
  let reduced = title.replace(new RegExp(`\\b${escapeRegex(className)}\\b`, 'ig'), '').replace(/^\d+(?:\.\d+)*\s*/, '');
  if (ascendancy) reduced = reduced.replace(new RegExp(`\\b${escapeRegex(ascendancy)}\\b`, 'ig'), '');
  const titleSkill = reduced.replace(/^Level\s+\d+\s*/i, '').replace(/\[?PoE\s*2\]?/gi, '').replace(/&gt;|>+/gi, '').replace(/\b(?:Fubgun|Starter|League|Endgame|Build|Guide|Verified|Leveling|Hybrid|Crit)\b/gi, '').replace(/\s+/g, ' ').trim().slice(0, 100);
  if (provider !== 'poe.ninja' && titleSkill) return titleSkill;
  const explicitSkill = overview.match(/(?:^|\n)\s*>?\s*(?:Primary Skill|Main Skill|URL Skill):\s*([^,\n|]+)/i)?.[1]?.trim();
  const listedSkill = explicitSkill || (provider === 'poe.ninja' || provider === 'pobb.in' ? overview.match(/(?:^|\n)\s*>?\s*Skills?:\s*([^,\n|]+)/i)?.[1]?.trim() : '');
  if (listedSkill && !/Builds?\b|Path of Exile/i.test(listedSkill)) return listedSkill.slice(0, 100);
  const afterImage = overview.match(/\)\s*([A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){0,2})/);
  if (afterImage && !/Image|Build|Guide/.test(afterImage[1])) return afterImage[1].trim();
  return titleSkill;
}

function addCampaignDefaults(rows: BuildPriority[], defence: BuildFitProfile['defenceStyle']) {
  const add = (stat: BuildStat, level: BuildPriority['level']) => { if (!rows.some((row) => row.stat === stat)) rows.push({ stat, level }); };
  add(defence === 'energy-shield' ? 'energyShield' : 'life', 'high');
  if (defence === 'life-evasion' || defence === 'hybrid') add('evasion', 'high');
  if (defence === 'life-armour' || defence === 'hybrid') add('armour', 'high');
  add('movementSpeed', 'high');
  add('fireResistance', 'high'); add('coldResistance', 'high'); add('lightningResistance', 'high');
}

function classForAscendancy(ascendancy: string) {
  const classes: Record<string, string> = {
    Deadeye:'Ranger', Pathfinder:'Ranger', Titan:'Warrior', Warbringer:'Warrior', 'Smith of Kitava':'Warrior', Stormweaver:'Sorceress', Chronomancer:'Sorceress', 'Disciple of Varashta':'Sorceress',
    'Blood Mage':'Witch', Infernalist:'Witch', Lich:'Witch', Invoker:'Monk', 'Acolyte of Chayula':'Monk', Witchhunter:'Mercenary', 'Gemling Legionnaire':'Mercenary', Tactician:'Mercenary',
    Amazon:'Huntress', Ritualist:'Huntress', Shaman:'Druid', Oracle:'Druid', 'Spirit Walker':'Druid',
  };
  return classes[ascendancy] || '';
}

function section(text: string, heading: string, endings: string[]) {
  const start = text.search(new RegExp(`(?:^|\\n)(?:#{1,4}\\s*)?\\*{0,2}${escapeRegex(heading)}\\*{0,2}:?`, 'i'));
  if (start < 0) return '';
  const rest = text.slice(start).replace(new RegExp(`^[\\s\\S]*?(?:\\n|$)`), '');
  const endPattern = new RegExp(`\\n(?:#{1,4}\\s*)?(?:${endings.map(escapeRegex).join('|')})\\b`, 'i');
  const end = rest.search(endPattern);
  return (end >= 0 ? rest.slice(0, end) : rest).trim();
}

function firstSections(text: string, headings: string[], endings: string[]) {
  const found = headings.map((heading) => section(text, heading, endings)).filter(Boolean);
  return [...new Set(found)].join('\n\n');
}

function extractMetadata(html: string) {
  const values = [
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1],
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)/i)?.[1],
  ].filter((value): value is string => Boolean(value));
  return cleanMarkdown(values.join('\n').replace(/&gt;/g, '>').replace(/&#x27;|&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' '));
}

function urlHints(url: URL, provider: BuildProvider) {
  const hints = [`Provider: ${provider}`];
  const search = url.searchParams.get('search') || '';
  const skill = search.match(/(?:^|[,&])skills?=([^,&]+)/i)?.[1];
  if (skill) hints.push(`URL Skill: ${decodeURIComponent(skill.replace(/\+/g, ' '))}`);
  if (provider === 'PoE Vault') {
    const parts = url.pathname.split('/').filter(Boolean);
    const className = parts[1];
    if (className) hints.push(`Class: ${capitalize(className)}`);
    const ascendancy = parts[2];
    if (ascendancy) hints.push(`Ascendancy: ${ascendancy.split('-').map(capitalize).join(' ')}`);
  }
  return hints.join('\n');
}

function cleanMarkdown(value: string) {
  return value.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&#x27;|&#39;|&apos;/g, "'").replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function htmlToText(html: string) { return cleanMarkdown(html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/(?:p|div|h\d|li|section|tr|td)>/gi, '\n').replace(/&#x27;/gi, "'")); }
function detectOne(text: string, values: string[]) { return values.find((value) => new RegExp(`\\b${escapeRegex(value)}\\b`, 'i').test(text)) || ''; }
function firstMatch(text: string, pattern: RegExp) { return text.match(pattern)?.[1]?.trim() || ''; }
function titleFromUrl(url: string) { return new URL(url).pathname.split('/').filter(Boolean).pop()?.split('-').map(capitalize).join(' ') || 'Imported build'; }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function escapeRegex(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
async function limitedText(response: Response) { const text = await response.text(); if (text.length > 2_500_000) throw new Error('Guide page is too large to import safely.'); return text; }
