import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from './app.js';
import { createDatabase, type AppDatabase } from './db.js';
import { recordPriceSnapshot } from './marketHistory.js';
import type { MarketValuation } from './marketValuationEngine.js';
import { defaultModifierCatalog } from './modifierCatalog.js';

function testValuation(overrides: Partial<MarketValuation> = {}): MarketValuation {
  return { quickSell: 10, fairPrice: 12, listingPrice: 14, lower: 9, upper: 16, currency: 'exalted', confidence: 'High', confidenceScore: 80, sampleSize: 5, usedCount: 5, discardedCount: 0, median: 12, trimmedMean: 12, q1: 10, q3: 14, iqr: 4, minimumReliablePrice: 9, centralPrice: 12, maximumLikelyPrice: 16, distinctSellers: 4, medianListingAgeDays: 1, averageSimilarity: 0.9, outliers: [], priceFixSuspects: [], liquidity: 'medium', liquidityBasis: 'test', comparablesUsed: [], comparablesRejected: [], warning: '', explanation: [], ...overrides };
}

let db: AppDatabase;
beforeEach(() => { db = createDatabase(':memory:'); });
afterEach(() => db.close());

describe('API persistence', () => {
  it('normalizes items, validates crafting plans and reports knowledge status',async()=>{const app=createApp(db);const text='Item Class: Boots\nRarity: Rare\nFleet Pace\nWrapped Boots\n--------\nItem Level: 80\n--------\n{ Prefix Modifier "Virile" (Tier: 3) — Life }\n+118(100-119) to maximum Life';const normalized=await request(app).post('/api/item/normalize').send({text,patch:'0.5.4'});assert.equal(normalized.status,200);assert.equal(normalized.body.item.prefixes[0].tier,3);const plan=await request(app).post('/api/crafting/plan').send({text,patch:'0.5.4',goal:{description:'Life and movement speed',minimumItemLevel:75}});assert.equal(plan.status,200);assert.ok(Array.isArray(plan.body.routes));assert.ok(Array.isArray(plan.body.stopConditions));const status=await request(app).get('/api/admin/knowledge-status');assert.equal(status.status,200);assert.equal(typeof status.body.counts.modifiers,'number');assert.ok(status.body.counts.modifiers>0,'the modifier catalog must be seeded into the database, not left empty');assert.ok(status.body.counts.modifierGroups>0);});
  it('creates versioned knowledge, market and equipment tables',()=>{
    const tables=(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{name:string}>).map((row)=>row.name);
    assert.ok(['patch_versions','data_sources','item_bases','modifier_definitions','modifier_groups','crafting_currencies','crafting_rules','skill_profiles','market_searches','market_listings','price_estimates','analysis_history','user_equipment'].every((name)=>tables.includes(name)));
    db.prepare('INSERT INTO item_bases(id,patch,data_version,source,confidence,base_json) VALUES (?,?,?,?,?,?)').run('wrapped-boots','0.5.4','a','community','Medium','{}');
    db.prepare('INSERT INTO item_bases(id,patch,data_version,source,confidence,base_json) VALUES (?,?,?,?,?,?)').run('wrapped-boots','0.6.0','b','community','Medium','{}');
    assert.equal((db.prepare('SELECT COUNT(*) count FROM item_bases').get() as {count:number}).count,2);
  });
  it('records market history only from verified live sources and computes a trend across snapshots', async () => {
    const app = createApp(db);
    recordPriceSnapshot(db, { baseType: 'Wrapped Boots', itemClass: 'Boots', league: 'Standard', dataSource: 'manual', valuation: testValuation() });
    recordPriceSnapshot(db, { baseType: 'Wrapped Boots', itemClass: 'Boots', league: 'Standard', dataSource: 'live', valuation: testValuation({ usedCount: 0 }) });
    let history = await request(app).get('/api/market-history').query({ baseType: 'Wrapped Boots', league: 'Standard' });
    assert.equal(history.status, 200, JSON.stringify(history.body));
    assert.equal(history.body.snapshots.length, 0, 'manual data and empty-sample live results must never be recorded as market history');

    recordPriceSnapshot(db, { baseType: 'Wrapped Boots', itemClass: 'Boots', league: 'Standard', dataSource: 'live', valuation: testValuation({ median: 10 }) });
    recordPriceSnapshot(db, { baseType: 'Wrapped Boots', itemClass: 'Boots', league: 'Standard', dataSource: 'relaxed-live', valuation: testValuation({ median: 20, priceFixSuspects: [{} as any] }) });
    history = await request(app).get('/api/market-history').query({ baseType: 'Wrapped Boots', league: 'Standard' });
    assert.equal(history.status, 200, JSON.stringify(history.body));
    assert.equal(history.body.snapshots.length, 2);
    assert.equal(history.body.trend, 'rising');
    assert.equal(history.body.priceFixFlaggedSnapshots, 1);
    assert.ok(history.body.limitations.some((l: string) => /confirmed sale/i.test(l)), 'market history must explicitly caveat that a snapshot is not a confirmed sale');
  });
  it('stores parsed trade queries and settings rates', async () => {
    const app = createApp(db);
    const parsed = await request(app).post('/api/trade/parse-url').send({ url: 'https://www.pathofexile.com/trade2/search/poe2/Standard/abc' });
    assert.equal(parsed.status, 200);
    assert.equal((db.prepare('SELECT COUNT(*) count FROM trade_queries').get() as any).count, 1);
    const settings = await request(app).put('/api/settings').send({ divineToExalted: 72, defaultLeague: 'Runes of Aldur' });
    assert.equal(settings.status, 200, JSON.stringify(settings.body));
    assert.equal(settings.body.divineToExalted, 72);
    assert.equal(settings.body.craftingRiskTolerance,'Medium');
    assert.equal(settings.body.showCurrencyWarnings,true);
    assert.equal((db.prepare('SELECT COUNT(*) count FROM currency_rates').get() as any).count, 2);
  });

  it('analyzes manual listings and saves a check with comparables', async () => {
    const app = createApp(db);
    const manual = JSON.stringify([20, 22, 24, 26].map((price, i) => ({ id: String(i), price, currency: 'exalted', baseType: 'Stone Greaves', rarity: 'rare', stats: { life: 70, movementSpeed: 25, armour: 250 } })));
    const response = await request(app).post('/api/analyze').send({ league: 'Runes of Aldur', item: { itemType: 'Boots', baseType: 'Stone Greaves', rarity: 'rare', life: 72, movementSpeed: 25, armour: 250 }, manualListings: manual, divineToExalted: 65 });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.dataSource, 'manual');
    assert.ok(response.body.estimate.fair > 0);
    assert.ok(response.body.evaluation.score > 0);
    assert.ok(response.body.evaluation.buildFits.length > 0);
    assert.ok(response.body.recommendation.action);
    assert.ok(response.body.recommendation.craftingPotential.score >= 0);
    assert.equal(response.body.craftingPotential.score,response.body.recommendation.craftingPotential.score);
    assert.equal(typeof response.body.id, 'number');
    assert.equal((db.prepare('SELECT COUNT(*) count FROM comparable_listings').get() as any).count, 4);
    const saved=await request(app).get('/api/checks');
    assert.equal(saved.status,200);
    assert.equal(saved.body[0].recommendation.action,response.body.recommendation.action);
    assert.equal(saved.body[0].craftingPotential.label,response.body.craftingPotential.label);
  });

  it('persists an active build and includes personalized fit in analysis', async () => {
    const app = createApp(db);
    const profile = { name: 'Ice Shot', className: 'Ranger', ascendancy: 'Deadeye', mainSkill: 'Ice Shot', stage: 'endgame', defenceStyle: 'life-evasion', priorities: [{ stat: 'life', level: 'required', minimum: 70 }, { stat: 'movementSpeed', level: 'high', minimum: 30 }], requiredMods: [], desiredMods: [] };
    const saved = await request(app).put('/api/build-profile').send(profile);
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const loaded = await request(app).get('/api/build-profile');
    assert.equal(loaded.body.profile.name, 'Ice Shot');
    const analyzed = await request(app).post('/api/analyze').send({ league: 'Runes of Aldur', item: { itemType: 'Boots', baseType: 'Stone Greaves', rarity: 'rare', life: 78, movementSpeed: 30 }, manualListings: '10 exalted | Stone Greaves | +78 Life, 30% Movement Speed' });
    assert.equal(analyzed.status, 200, JSON.stringify(analyzed.body));
    assert.equal(analyzed.body.evaluation.personalized.buildName, 'Ice Shot');
    assert.ok(analyzed.body.evaluation.personalized.score >= 65);
    assert.equal(analyzed.body.evaluation.buildFitAnalysis.profileName, 'Ice Shot');
    assert.equal(analyzed.body.evaluation.buildFitAnalysis.buildSpecific, true);
  });

  it('unifies the active build and the selectable build-fit pool into one profile', async () => {
    const app = createApp(db);
    const profile = { name: 'Unified Frost Monk', className: 'Monk', ascendancy: 'Invoker', mainSkill: 'Ice Strike', stage: 'endgame', defenceStyle: 'life-evasion', priorities: [{ stat: 'life', level: 'required', minimum: 70 }], requiredMods: [], desiredMods: [] };
    await request(app).put('/api/build-profile').send(profile);
    const pool = await request(app).get('/api/build-profiles');
    const listed = pool.body.profiles.find((entry: any) => entry.name === 'Unified Frost Monk');
    assert.ok(listed, 'the active build must be selectable from the same pool used by /api/analyze');
    const active = await request(app).get('/api/build-profile');
    assert.equal(active.body.profile.id, listed.id, 'the active build and the pool entry must be the exact same profile record');
    const analyzed = await request(app).post('/api/analyze').send({ league: 'Runes of Aldur', selectedBuildProfileId: listed.id, item: { itemType: 'Boots', baseType: 'Stone Greaves', rarity: 'rare', life: 78 }, manualListings: '10 exalted | Stone Greaves | +78 Life' });
    assert.equal(analyzed.status, 200, JSON.stringify(analyzed.body));
    assert.equal(analyzed.body.evaluation.personalized.buildName, 'Unified Frost Monk');
    assert.equal(analyzed.body.evaluation.buildFitAnalysis.profileName, 'Unified Frost Monk');
  });

  it('runs an end-to-end pasted shield category analysis',async()=>{
    const app=createApp(db);
    const itemText='Item Class: Shields\nRarity: Rare\nAegis Crest\nPlate Shield\n--------\nChance to Block: 30%\nArmour: 900\n--------\nItem Level: 80\n--------\n25% increased Chance to Block\n+82 to maximum Life';
    const response=await request(app).post('/api/analyze').send({league:'Standard',itemText,manualListings:'20 exalted | Plate Shield | +82 Life',save:false});
    assert.equal(response.status,200,JSON.stringify(response.body));
    assert.equal(response.body.evaluation.categoryAnalysis.detectedCategory.key,'shield');
    assert.match(response.body.evaluation.categoryAnalysis.positiveStats.join(' '),/block/i);
    assert.ok(response.body.evaluation.categoryAnalysis.parsedLines.length>0);
  });

  it('runs an end-to-end pasted weapon category analysis without defensive requirements',async()=>{
    const app=createApp(db);
    const itemText='Item Class: Crossbows\nRarity: Rare\nGloom Core\nSiege Crossbow\n--------\nPhysical Damage: 150-380\nCritical Hit Chance: 7.00%\nAttacks per Second: 1.65\n--------\nItem Level: 80\n--------\n45% increased Physical Damage\n15% increased Attack Speed';
    const response=await request(app).post('/api/analyze').send({league:'Standard',itemText,manualListings:'30 exalted | Siege Crossbow | weapon damage',save:false});
    assert.equal(response.status,200,JSON.stringify(response.body));
    assert.equal(response.body.evaluation.categoryAnalysis.detectedCategory.key,'crossbow');
    assert.doesNotMatch(response.body.evaluation.categoryAnalysis.missingImportantStats.join(' '),/life|resistance|armour/i);
  });

  it('runs an end-to-end pasted boots category analysis with movement speed priority',async()=>{
    const app=createApp(db);
    const itemText='Item Class: Boots\nRarity: Rare\nRune Pace\nStone Greaves\n--------\nArmour: 268\n--------\nItem Level: 78\n--------\n+76 to maximum Life\n+31% to Fire Resistance\n30% increased Movement Speed';
    const response=await request(app).post('/api/analyze').send({league:'Standard',itemText,manualListings:'15 exalted | Stone Greaves | +76 Life, 30% Movement Speed',save:false});
    assert.equal(response.status,200,JSON.stringify(response.body));
    assert.equal(response.body.evaluation.categoryAnalysis.detectedCategory.key,'boots');
    assert.match(response.body.evaluation.categoryAnalysis.positiveStats.join(' '),/Movement Speed/i);
  });

  it('loads defaults and persists custom build profile CRUD',async()=>{
    const app=createApp(db);const list=await request(app).get('/api/build-profiles');assert.equal(list.status,200);assert.ok(list.body.profiles.some((profile:any)=>profile.name==='Ice Shot Deadeye'));
    const input={name:'My Frost Monk',mainSkill:'Ice Strike',className:'Monk',ascendancy:'Invoker',weaponType:'quarterstaff',mainDamageType:'cold',defensiveLayer:'evasion',importantStats:['cold damage','attack speed','life','evasion'],badStats:['minion stats'],notes:'Custom test'};
    const created=await request(app).post('/api/build-profiles').send(input);assert.equal(created.status,201,JSON.stringify(created.body));assert.match(created.body.profile.id,/custom:/);const id=created.body.profile.id;
    const updated=await request(app).put(`/api/build-profiles/${encodeURIComponent(id)}`).send({...input,name:'My Updated Frost Monk'});assert.equal(updated.status,200,JSON.stringify(updated.body));assert.equal(updated.body.profile.name,'My Updated Frost Monk');
    const loaded=await request(app).get('/api/build-profiles');assert.ok(loaded.body.profiles.some((profile:any)=>profile.name==='My Updated Frost Monk'));
    const removed=await request(app).delete(`/api/build-profiles/${encodeURIComponent(id)}`);assert.equal(removed.status,204);
  });

  it('returns selected build-specific analysis from /api/analyze',async()=>{
    const app=createApp(db);const itemText='Item Class: Bows\nRarity: Rare\nFrost String\nGemini Bow\n--------\nPhysical Damage: 90-180\nCold Damage: 60-120\nCritical Hit Chance: 8.00%\nAttacks per Second: 1.65\n--------\nAdds 60 to 120 Cold Damage\n18% increased Attack Speed\n+250 to Accuracy Rating\nProjectiles deal 35% increased Damage';
    const response=await request(app).post('/api/analyze').send({league:'Standard',itemText,selectedBuildProfileId:'ice-shot-deadeye',manualListings:'20 exalted | Gemini Bow | cold bow',save:false});
    assert.equal(response.status,200,JSON.stringify(response.body));assert.equal(response.body.evaluation.buildFitAnalysis.profileName,'Ice Shot Deadeye');assert.equal(response.body.evaluation.buildFitAnalysis.buildSpecific,true);assert.ok(response.body.evaluation.buildFitAnalysis.score>50);
  });

  it('derives the normalized item from the same merged item used for pricing and build fit, including manual overrides', async () => {
    const app = createApp(db);
    const itemText = 'Item Class: Rings\nRarity: Rare\nEmber Loop\nGold Ring\n--------\nItem Level: 80\n--------\n+10% to Fire Resistance';
    const response = await request(app).post('/api/analyze').send({ league: 'Standard', itemText, item: { fireResistance: 45 }, manualListings: '5 exalted | Gold Ring | fire resistance', save: false });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.item.fireResistance, 45, 'manual override must win in the merged ItemStats model');
    assert.equal(response.body.normalizedItem.baseType, 'Gold Ring', 'normalizedItem must derive from the same merged item, not re-parse text independently');
  });

  it('drives the crafting state machine through inspect, apply, and compare', async () => {
    const app = createApp(db);
    const text = 'Item Class: Boots\nRarity: Normal\nWorn Sandals\n--------\nItem Level: 80';
    const inspected = await request(app).post('/api/crafting/state').send({ text });
    assert.equal(inspected.status, 200, JSON.stringify(inspected.body));
    assert.equal(inspected.body.state.rarity, 'normal');
    assert.ok(inspected.body.legalActions.some((a: any) => a.currencyId === 'orb-of-transmutation' && a.legal));
    assert.ok(inspected.body.legalActions.every((a: any) => a.reversible === false));

    const applied = await request(app).post('/api/crafting/apply').send({ state: inspected.body.state, currencyId: 'orb-of-transmutation' });
    assert.equal(applied.status, 200, JSON.stringify(applied.body));
    assert.equal(applied.body.state.rarity, 'magic');
    assert.equal(applied.body.state.currencySpent.length, 1);

    const illegal = await request(app).post('/api/crafting/apply').send({ state: applied.body.state, currencyId: 'orb-of-transmutation' });
    assert.equal(illegal.body.evaluation.legal, false);
    assert.equal(illegal.body.state.currencySpent.length, 1, 'an illegal action must not change the state');

    const compared = await request(app).post('/api/crafting/compare').send({ state: applied.body.state, buyPrice: 10 });
    assert.equal(compared.status, 200, JSON.stringify(compared.body));
    assert.ok(['continue', 'sell', 'buy-instead', 'unknown'].includes(compared.body.recommendation));

    const previewed = await request(app).post('/api/crafting/apply').send({ state: applied.body.state, currencyId: 'orb-of-augmentation' });
    assert.equal(previewed.status, 200, JSON.stringify(previewed.body));
    assert.equal(previewed.body.state.currencySpent.length, 2, 'preview must compute the resulting state without persisting anything');

    const beforeHistory = await request(app).get('/api/crafting/history');
    assert.equal(beforeHistory.status, 200);
    const priorCount = beforeHistory.body.history.length;

    const confirmed = await request(app).post('/api/crafting/history').send({ action: 'orb-of-augmentation', before: applied.body.state, after: previewed.body.state, valueBefore: 5, valueAfter: 8 });
    assert.equal(confirmed.status, 201, JSON.stringify(confirmed.body));
    assert.equal(confirmed.body.gainLoss, 3);

    const afterHistory = await request(app).get('/api/crafting/history');
    assert.equal(afterHistory.status, 200);
    assert.equal(afterHistory.body.history.length, priorCount + 1);
    const entry = afterHistory.body.history[0];
    assert.equal(entry.action, 'orb-of-augmentation');
    assert.equal(entry.gainLoss, 3);
    assert.ok('nextSafeAction' in entry, 'history entries must suggest a next safe action derived from legalActions on the stored after-state');
  });

  it('persists a character profile, its equipment, and analysis history so data is not re-entered', async () => {
    const app = createApp(db);
    const created = await request(app).post('/api/characters').send({ name: 'Frostbolt', league: 'Runes of Aldur', level: 62, className: 'Sorceress', ascendancy: 'Stormweaver', stage: 'endgame', budget: 50, targetContent: 'T15 maps' });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const characterId = created.body.character.id;

    const equipped = await request(app).put(`/api/characters/${characterId}/equipment`).send({ equipment: [{ slot: 'Boots', itemText: 'Item Class: Boots\nRarity: Rare\nRune Pace\nStone Greaves\n--------\nArmour: 100\n--------\n+40 to maximum Life\n25% increased Movement Speed' }] });
    assert.equal(equipped.status, 200, JSON.stringify(equipped.body));
    assert.equal(equipped.body.equipment.length, 1);

    const detail = await request(app).get(`/api/characters/${characterId}`);
    assert.equal(detail.status, 200, JSON.stringify(detail.body));
    assert.equal(detail.body.character.name, 'Frostbolt');
    assert.ok(detail.body.diagnosis, 'diagnosis must be computed live from stored equipment');

    const analyzed = await request(app).post('/api/analyze').send({ itemText: 'Item Class: Boots\nRarity: Rare\nRune Pace\nStone Greaves\n--------\nArmour: 268\n--------\nItem Level: 78\n--------\n+76 to maximum Life\n+31% to Fire Resistance\n30% increased Movement Speed', manualListings: '15 exalted | Stone Greaves | +76 Life, 30% Movement Speed', characterId, save: false });
    assert.equal(analyzed.status, 200, JSON.stringify(analyzed.body));
    assert.equal(analyzed.body.league, 'Runes of Aldur', 'the character league must be used when the request does not override it');

    const detailAfter = await request(app).get(`/api/characters/${characterId}`);
    assert.equal(detailAfter.body.history.length, 1, 'analysis history must be recorded automatically');
    assert.match(detailAfter.body.history[0].summary, /Rune Pace|Exalted/i);

    const list = await request(app).get('/api/characters');
    assert.ok(list.body.characters.some((c: any) => c.id === characterId));

    const removed = await request(app).delete(`/api/characters/${characterId}`);
    assert.equal(removed.status, 204);
  });

  it('diagnoses a full character equipment set through /api/build-doctor', async () => {
    const app = createApp(db);
    const equipment = [
      { slot: 'Ring 1', itemText: 'Item Class: Rings\nRarity: Rare\nEmber Loop\nGold Ring\n--------\nRequires: Level 60, 38 Dex\n--------\n+30 Dexterity\n+20% to Fire Resistance' },
      { slot: 'Weapon', itemText: 'Item Class: Bows\nRarity: Rare\nWind String\nComposite Bow\n--------\nRequires: Level 65, 120 Dex\n--------\nPhysical Damage: 20-40\nAttacks per Second: 1.4' },
      { slot: 'Boots', itemText: 'Item Class: Boots\nRarity: Rare\nRune Pace\nStone Greaves\n--------\nArmour: 100\n--------\n+40 to maximum Life\n25% increased Movement Speed' },
    ];
    const response = await request(app).post('/api/build-doctor').send({ equipment });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.resistances.current.fireResistance, 20);
    assert.ok(response.body.alerts.some((a: any) => a.slot === 'Ring 1'), 'must warn before removing the ring the weapon depends on for Dexterity');
    assert.ok(response.body.weakestSlots.length > 0);
    assert.ok(Array.isArray(response.body.recommendedUpgradeOrder));
  });

  it('exposes an opportunity analysis reusing the same item/build/market models', async () => {
    const app = createApp(db);
    const manual = JSON.stringify([
      { id: '1', price: 10, currency: 'exalted', baseType: 'Stone Greaves', rarity: 'rare', account: 'seller-1', stats: { life: 70, movementSpeed: 25, armour: 250 } },
      { id: '2', price: 10.5, currency: 'exalted', baseType: 'Stone Greaves', rarity: 'rare', account: 'seller-2', stats: { life: 140, movementSpeed: 25, armour: 250 } },
      { id: '3', price: 11, currency: 'exalted', baseType: 'Stone Greaves', rarity: 'rare', account: 'seller-3', stats: { life: 72, movementSpeed: 25, armour: 250 } },
    ]);
    const response = await request(app).post('/api/analyze').send({ league: 'Runes of Aldur', item: { itemType: 'Boots', baseType: 'Stone Greaves', rarity: 'rare', life: 70, movementSpeed: 25, armour: 250 }, manualListings: manual, divineToExalted: 65, save: false });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.ok(response.body.opportunity, 'opportunity analysis must be present');
    assert.ok(Array.isArray(response.body.opportunity.wastedExpensiveStats));
    assert.ok(response.body.opportunity.buyVsCraft.verdict);
    assert.ok(Array.isArray(response.body.opportunity.limitations));
    assert.equal(response.body.opportunity.bestAlternativeSearchUrl, undefined, 'manual listings have no official search URL to reuse');
  });

  it('explains why a price was chosen with a per-comparable breakdown', async () => {
    const app = createApp(db);
    const manual = JSON.stringify([20, 22, 24, 26, 28].map((price, i) => ({ id: String(i), price, currency: 'exalted', baseType: 'Stone Greaves', rarity: 'rare', account: `seller-${i}`, indexedAt: new Date().toISOString(), stats: { life: 90, movementSpeed: 25, armour: 250 } })));
    const response = await request(app).post('/api/analyze').send({ league: 'Runes of Aldur', item: { itemType: 'Boots', baseType: 'Stone Greaves', rarity: 'rare', life: 70, movementSpeed: 25, armour: 250 }, manualListings: manual, divineToExalted: 65, save: false });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.ok(response.body.comparableListings.length >= 5);
    for (const row of response.body.comparableListings) {
      assert.ok(typeof row.mainDifference === 'string', 'each comparable must explain its main stat difference');
      assert.ok(typeof row.foundByStrategy === 'string', 'each comparable must record which strategy found it');
    }
    const withLifeDiff = response.body.comparableListings.find((row: any) => /Life/i.test(row.mainDifference));
    assert.ok(withLifeDiff, 'a comparable with a different life roll should surface it as the main difference');
    assert.equal(response.body.marketAnalysis.valuation.median > 0, true);
  });

  it('exposes four independent evaluations and a five-state main decision from /api/analyze', async () => {
    const app = createApp(db);
    const itemText = 'Item Class: Boots\nRarity: Rare\nRune Pace\nStone Greaves\n--------\nArmour: 268\n--------\nItem Level: 78\n--------\n+76 to maximum Life\n+31% to Fire Resistance\n30% increased Movement Speed';
    const response = await request(app).post('/api/analyze').send({ league: 'Standard', itemText, manualListings: '15 exalted | Stone Greaves | +76 Life, 30% Movement Speed', save: false });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.ok(response.body.evaluations, 'evaluations must be present');
    for (const key of ['buildFit', 'upgradeValue', 'marketValue', 'craftPotential']) {
      const entry = response.body.evaluations[key];
      assert.ok(entry, `${key} evaluation missing`);
      assert.equal(typeof entry.score, 'number');
      assert.ok(['High', 'Medium', 'Low'].includes(entry.confidence));
      assert.ok(Array.isArray(entry.dataUsed));
      assert.ok(Array.isArray(entry.limitations));
    }
    assert.ok(['Use', 'Sell', 'Craft', 'Keep', 'Discard'].includes(response.body.decision.action));
    assert.ok(response.body.decision.reason);
    assert.ok(Array.isArray(response.body.decision.conditionsToChange));
  });

  it('carries Deflection and Runic Ward through parsing, scoring and stat valuation instead of leaving them at zero', async () => {
    const app = createApp(db);
    const itemText = 'Item Class: Foci\nRarity: Rare\nWard Halo\nCrystal Focus\n--------\nEnergy Shield: 40\nDeflection: 180\nRunic Ward: 140\n--------\nItem Level: 78';
    const response = await request(app).post('/api/analyze').send({ league: 'Standard', itemText, manualListings: '5 exalted | Crystal Focus | ward', save: false });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.item.deflection, 180);
    assert.equal(response.body.item.runicWard, 140);
    assert.match(response.body.evaluation.strengths.join(' '), /Runic Ward/i);
    const runicWardStat = response.body.statValuation.contributions.find((c: any) => c.stat === 'Runic Ward');
    assert.ok(runicWardStat, 'Runic Ward must be scored by the StatValuationEngine, not dropped');
    assert.ok(runicWardStat.score > 0);
  });

  it('runs StatValuationEngine as part of /api/analyze and blends it into the recommendation', async () => {
    const app = createApp(db);
    const itemText = 'Item Class: Rings\nRarity: Rare\nEmber Loop\nGold Ring\n--------\nItem Level: 80\n--------\n+30% to Fire Resistance\n+40% increased Critical Damage';
    const response = await request(app).post('/api/analyze').send({ league: 'Standard', itemText, manualListings: '5 exalted | Gold Ring | fire resistance', characterTotals: { fireResistance: 70 }, save: false });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.ok(response.body.statValuation, 'statValuation must be present in the API response');
    assert.ok(response.body.statValuation.contributions.length > 0);
    const fireContribution = response.body.statValuation.contributions.find((c: any) => c.stat === 'fireResistance');
    assert.ok(fireContribution, 'fire resistance must be scored');
    assert.equal(fireContribution.wasted, true, 'over-cap resistance must be marked wasted');
    assert.match(response.body.recommendation.detailedReason.join(' '), /Stat-by-stat valuation scored/);
  });

  it('persists equipped comparison and character impact in saved checks',async()=>{
    const app=createApp(db);const newItem='Item Class: Boots\nRarity: Rare\nNew Pace\nHunting Shoes\n--------\nEvasion Rating: 420\n--------\nItem Level: 80\n--------\n+88 to maximum Life\n+15% to Cold Resistance\n32% increased Movement Speed';const equipped='Item Class: Boots\nRarity: Rare\nOld Pace\nHunting Shoes\n--------\nEvasion Rating: 220\n--------\nItem Level: 72\n--------\n+60 to maximum Life\n+40% to Cold Resistance\n20% increased Movement Speed';
    const response=await request(app).post('/api/analyze').send({league:'Standard',itemText:newItem,equippedItemText:equipped,characterTotals:{coldResistance:75,dexterity:120},selectedBuildProfileId:'evasion-ranger',manualListings:'20 exalted | Hunting Shoes | 32 movement',save:true});
    assert.equal(response.status,200,JSON.stringify(response.body));assert.equal(response.body.comparison.enabled,true);assert.equal(response.body.comparison.comparable,true);assert.equal(response.body.comparison.characterImpact.after.coldResistance,50);assert.match(response.body.comparison.warnings.join(' '),/Cold Resistance/i);
    assert.equal(typeof response.body.beginnerSummary,'string');assert.ok(response.body.beginnerSummary.length>0,'a plain-language beginnerSummary must always be present in the analyze response');
    const saved=await request(app).get('/api/checks');assert.equal(saved.status,200);assert.equal(saved.body[0].comparison.verdict,response.body.comparison.verdict);assert.equal(saved.body[0].comparison.characterImpact.after.coldResistance,50);assert.equal(saved.body[0].beginnerSummary,response.body.beginnerSummary);
  });

  it('validates, regression-tests and activates a staged modifier patch, and never lets a failing patch replace the active version', async () => {
    const app = createApp(db);

    const invalid = await request(app).post('/api/admin/patch/stage').send({ patch: '0.6.0', dataVersion: 'bad-1', source: 'community-test', modifiers: [{ id: 'life' }] });
    assert.equal(invalid.status, 422, JSON.stringify(invalid.body));
    assert.match(invalid.body.error, /schema validation failed/i);

    const failingCandidate = defaultModifierCatalog.filter((entry) => entry.id !== 'life');
    const staged = await request(app).post('/api/admin/patch/stage').send({ patch: '0.6.0', dataVersion: 'candidate-1', source: 'community-test', modifiers: failingCandidate });
    assert.equal(staged.status, 201, JSON.stringify(staged.body));
    assert.equal(staged.body.version.status, 'staged');
    assert.equal(staged.body.version.regression.passed, false, 'removing the life modifier must fail the regression check');

    const rejectedActivation = await request(app).post(`/api/admin/patch/${staged.body.version.id}/activate`);
    assert.equal(rejectedActivation.status, 422, JSON.stringify(rejectedActivation.body));
    assert.match(rejectedActivation.body.error, /regression check/i);

    const versionsAfterFailure = await request(app).get('/api/admin/patch/versions');
    const activeAfterFailure = versionsAfterFailure.body.versions.find((v: any) => v.status === 'active');
    assert.ok(activeAfterFailure, 'an active version must always exist');
    assert.notEqual(activeAfterFailure.id, staged.body.version.id, 'a failing patch must never automatically replace the active version');

    const goodCandidate = [...defaultModifierCatalog];
    const goodStaged = await request(app).post('/api/admin/patch/stage').send({ patch: '0.6.0', dataVersion: 'candidate-2', source: 'community-test', modifiers: goodCandidate });
    assert.equal(goodStaged.status, 201, JSON.stringify(goodStaged.body));
    assert.equal(goodStaged.body.version.regression.passed, true);

    const activated = await request(app).post(`/api/admin/patch/${goodStaged.body.version.id}/activate`);
    assert.equal(activated.status, 200, JSON.stringify(activated.body));
    assert.equal(activated.body.version.status, 'active');

    const versionsAfterActivation = await request(app).get('/api/admin/patch/versions');
    const nowActive = versionsAfterActivation.body.versions.find((v: any) => v.status === 'active');
    assert.equal(nowActive.id, goodStaged.body.version.id);
    const previouslyActive = versionsAfterActivation.body.versions.find((v: any) => v.id === activeAfterFailure.id);
    assert.equal(previouslyActive.status, 'deprecated', 'the superseded version must be marked deprecated, not deleted, so history is preserved');

    const rolledBack = await request(app).post(`/api/admin/patch/${activeAfterFailure.id}/rollback`);
    assert.equal(rolledBack.status, 200, JSON.stringify(rolledBack.body));
    assert.equal(rolledBack.body.version.status, 'active');
    const versionsAfterRollback = await request(app).get('/api/admin/patch/versions');
    const afterRollbackActive = versionsAfterRollback.body.versions.find((v: any) => v.status === 'active');
    assert.equal(afterRollbackActive.id, activeAfterFailure.id, 'rollback must restore the previously active version');
  });

  it('persists a build-import snapshot with per-field confidence so a partial import is never indistinguishable from a verified one', () => {
    const fields = [
      { field: 'className', value: 'Ranger', excerpt: 'Class: Ranger', confidence: 'High', needsConfirmation: false },
      { field: 'mainSkill', value: '(not detected)', excerpt: '', confidence: 'Low', needsConfirmation: true },
    ];
    db.prepare('INSERT INTO build_import_snapshots(url, provider, method, partial, fields_json, warnings_json) VALUES (?,?,?,?,?,?)')
      .run('https://mobalytics.gg/poe-2/builds/example', 'Mobalytics', 'jina-reader', 1, JSON.stringify(fields), JSON.stringify(['This import is partial.']));
    const row = db.prepare('SELECT url, provider, method, partial, fields_json AS fieldsJson FROM build_import_snapshots ORDER BY id DESC LIMIT 1').get() as any;
    assert.equal(row.partial, 1);
    const storedFields = JSON.parse(row.fieldsJson);
    assert.equal(storedFields.find((f: any) => f.field === 'mainSkill').needsConfirmation, true);
  });
});
