import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import { importBuildGuide } from './buildImporter.js';
import { analyzeBuildFit } from './buildFit.js';
import { allCodeProfiles, createBuildProfileFromPriorities, createCustomBuildProfile, findDefaultBuildProfile, genericBuildFitProfile, type LegacyBuildProfileInput } from './buildProfiles.js';
import { createDatabase, getSettings, type AppDatabase } from './db.js';
import { mergeItem, parseItemText } from './itemParser.js';
import { compareItems } from './itemComparison.js';
import { decideItem } from './itemDecision.js';
import { assessCraftingPotential } from './craftingPotential.js';
import { evaluateItem } from './quality.js';
import { buildTradeUrl, dedupeListings, parseManualListings, parseTradeUrl } from './trade.js';
import { manualMarketAnalysis, runMarketPipeline, toLegacyEstimate, type MarketAnalysisResult } from './marketPipeline.js';
import { recordPriceSnapshot, getMarketHistory } from './marketHistory.js';
import { buildItemAnalysis } from './normalizedItemParser.js';
import { deriveBuildWeights, deriveCritical, deriveDamageTags, deriveSlotWeights, valueItemStats } from './statValuationEngine.js';
import { buildFourEvaluations } from './fourEvaluations.js';
import { analyzeOpportunity } from './opportunityAnalysis.js';
import { diagnoseBuild } from './buildDoctor.js';
import { milestoneFor, nextMilestoneLevel, searchLevelingItems, whatChangesAtNextMilestone, type LevelingSlot } from './leveling.js';
import { ClipboardItemParser } from './normalizedItemParser.js';
import { Poe2CraftingEngine } from './craftingEngine.js';
import { applyAction, compareContinueSellBuy, legalActions, stateFromItem, type CraftingItemState } from './craftingStateMachine.js';
import { craftingCurrencies } from './craftingCurrencies.js';
import { isLiveVerifiedSource, type BuildFitProfile, type ItemEvaluation, type ItemStats, type Listing } from './types.js';
import { activatePatch, listCatalogVersions, rollbackToVersion, stagePatch, validateModifierCatalog } from './patchUpdater.js';
import { buildBeginnerSummary } from './beginnerSummary.js';
import { completeOAuth, fetchPoe2Character, fetchPoe2Characters, markSync, oauthFrontendUrl, oauthStatus, startOAuth, type PoeCharacter } from './poeOAuth.js';

const analyzeSchema = z.object({
  league: z.string().min(1).default('Runes of Aldur'),
  itemText: z.string().optional().default(''),
  equippedItemText: z.string().optional().default(''),
  item: z.record(z.unknown()).optional().default({}),
  manualListings: z.string().optional().default(''),
  divineToExalted: z.number().positive().optional(),
  save: z.boolean().optional().default(true),
  selectedBuildProfileId: z.string().trim().max(100).optional(),
  selectedBuildProfileName: z.string().trim().max(100).optional(),
  characterTotals:z.object({fireResistance:z.number().optional(),coldResistance:z.number().optional(),lightningResistance:z.number().optional(),chaosResistance:z.number().optional(),strength:z.number().optional(),dexterity:z.number().optional(),intelligence:z.number().optional(),spirit:z.number().optional()}).optional(),
  characterId: z.number().int().positive().optional(),
});

const characterSchema = z.object({
  name: z.string().trim().min(1).max(60),
  league: z.string().trim().min(1).max(100),
  level: z.number().int().min(1).max(100).optional(),
  className: z.string().trim().max(60).optional().default(''),
  ascendancy: z.string().trim().max(60).optional().default(''),
  buildProfileId: z.string().trim().max(100).optional().default(''),
  stage: z.enum(['campaign', 'early-maps', 'endgame']).optional(),
  budget: z.number().nonnegative().max(1000000).optional(),
  targetContent: z.string().trim().max(300).optional().default(''),
  currentIssues: z.string().trim().max(1000).optional().default(''),
});
const characterEquipmentSchema = z.object({
  equipment: z.array(z.object({ slot: z.string().trim().min(1).max(50), itemText: z.string().max(20000) })).max(20),
});

const itemCategorySchema=z.enum(['body-armour','helmet','gloves','boots','shield','focus','quiver','ring','amulet','belt','bow','crossbow','one-handed-melee','two-handed-melee','staff','quarterstaff','wand','sceptre','other']);
const customBuildProfileSchema=z.object({name:z.string().trim().min(1).max(100),mainSkill:z.string().trim().max(100).default(''),className:z.string().trim().min(1).max(60),ascendancy:z.string().trim().max(60).optional().default(''),weaponType:itemCategorySchema.optional(),mainDamageType:z.string().trim().max(60).default('general'),defensiveLayer:z.string().trim().max(100).default('life'),importantStats:z.array(z.string().trim().min(1).max(100)).max(40),badStats:z.array(z.string().trim().min(1).max(100)).max(30),notes:z.string().max(1500).optional().default('')});

const buildPrioritySchema = z.object({
  stat: z.enum(['life', 'mana', 'energyShield', 'armour', 'evasion', 'movementSpeed', 'fireResistance', 'coldResistance', 'lightningResistance', 'chaosResistance', 'strength', 'dexterity', 'intelligence', 'spirit', 'rarityFind', 'attacksPerSecond', 'criticalHitChance', 'physicalDps', 'elementalDps']),
  level: z.enum(['required', 'high', 'useful']),
  minimum: z.number().positive().max(100000).optional(),
});
const buildProfileSchema = z.object({
  name: z.string().trim().min(1).max(100), className: z.string().trim().min(1).max(50), ascendancy: z.string().trim().max(50).optional().default(''),
  mainSkill: z.string().trim().max(100).optional().default(''), guideUrl: z.union([z.string().url(), z.literal('')]).optional().default(''),
  stage: z.enum(['campaign', 'early-maps', 'endgame']), evaluationStyle: z.enum(['balanced', 'campaign-race', 'hardcore-gauntlet']).optional().default('balanced'), defenceStyle: z.enum(['life-armour', 'life-evasion', 'energy-shield', 'hybrid', 'custom']),
  priorities: z.array(buildPrioritySchema).max(30), requiredMods: z.array(z.string().trim().min(1).max(150)).max(20),
  desiredMods: z.array(z.string().trim().min(1).max(150)).max(30), notes: z.string().max(2000).optional().default(''),
});

export function createApp(db: AppDatabase = createDatabase()) {
  const app = express();
  const configuredOrigins = process.env.FRONTEND_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean);
  app.use(cors({ origin: !configuredOrigins?.length || configuredOrigins.includes('*') ? true : configuredOrigins }));
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'poe2-orb-analyzer', timestamp: new Date().toISOString() }));
  app.get('/api/poe/oauth/status', (_req,res)=>res.json(oauthStatus(db)));
  app.get('/api/poe/oauth/start', (_req,res)=>{try{return res.json({url:startOAuth(db)});}catch(error){return res.status(503).json({error:message(error)});}});
  app.get('/api/poe/oauth/callback', async(req,res)=>{try{const code=String(req.query.code||'');const state=String(req.query.state||'');if(!code||!state)throw new Error(String(req.query.error_description||req.query.error||'Path of Exile did not authorize the connection.'));const connection=await completeOAuth(db,code,state);return res.redirect(302,oauthFrontendUrl(`/characters?poe=connected&connection=${connection.id}`));}catch(error){try{return res.redirect(302,oauthFrontendUrl(`/characters?poe=error&message=${encodeURIComponent(message(error))}`));}catch{return res.status(400).json({error:message(error)});}}});
  app.get('/api/poe/characters/:connectionId', async(req,res)=>{try{return res.json({characters:await fetchPoe2Characters(db,Number(req.params.connectionId))});}catch(error){markSync(db,Number(req.params.connectionId),message(error));return res.status(502).json({error:message(error)});}});
  app.post('/api/poe/characters/:connectionId/import', async(req,res)=>{const parsed=z.object({name:z.string().trim().min(1).max(100)}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Choose a valid Path of Exile character.'});try{const remote=await fetchPoe2Character(db,Number(req.params.connectionId),parsed.data.name);const localId=importPoeCharacter(db,remote);markSync(db,Number(req.params.connectionId));return res.json({character:getCharacterRow(db,localId),importedEquipment:equipmentFromPoeCharacter(remote).length});}catch(error){markSync(db,Number(req.params.connectionId),message(error));return res.status(502).json({error:message(error)});}});
  app.post('/api/item/normalize',(req,res)=>{const parsed=z.object({text:z.string().min(1).max(100000),league:z.string().max(100).optional(),patch:z.string().max(30).optional()}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Paste valid PoE 2 item text.'});try{return res.json({item:new ClipboardItemParser().parseClipboard(parsed.data.text,{league:parsed.data.league,patch:parsed.data.patch})});}catch(error){return res.status(422).json({error:message(error)});}});
  app.post('/api/crafting/plan',async(req,res)=>{const parsed=z.object({text:z.string().min(1).max(100000),league:z.string().max(100).optional(),patch:z.string().max(30).optional(),goal:z.object({description:z.string().min(1).max(500),minimumItemLevel:z.number().int().positive().optional(),mandatoryGroups:z.array(z.string()).optional(),targetStats:z.record(z.number()).optional(),buyPrice:z.number().positive().optional(),currentValue:z.number().nonnegative().optional()})}).safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Paste an item and enter a valid crafting goal.'});try{const item=new ClipboardItemParser().parseClipboard(parsed.data.text,{league:parsed.data.league,patch:parsed.data.patch});const engine=new Poe2CraftingEngine();const state=engine.inspect(item);return res.json(await engine.plan(state,parsed.data.goal));}catch(error){return res.status(422).json({error:message(error)});}});
  app.post('/api/crafting/state',(req,res)=>{
    const parsed=z.object({text:z.string().min(1).max(100000),league:z.string().max(100).optional(),patch:z.string().max(30).optional(),goal:z.object({description:z.string().min(1).max(500),minimumItemLevel:z.number().int().positive().optional(),mandatoryGroups:z.array(z.string()).optional(),targetStats:z.record(z.number()).optional(),buyPrice:z.number().positive().optional(),currentValue:z.number().nonnegative().optional()}).optional(),estimatedValue:z.number().nonnegative().optional()}).safeParse(req.body);
    if(!parsed.success)return res.status(400).json({error:'Paste an item to inspect its crafting state.'});
    try{
      const item=new ClipboardItemParser().parseClipboard(parsed.data.text,{league:parsed.data.league,patch:parsed.data.patch});
      const state=stateFromItem(item,parsed.data.goal,parsed.data.estimatedValue);
      return res.json({state,legalActions:legalActions(state),currencies:craftingCurrencies});
    }catch(error){return res.status(422).json({error:message(error)});}
  });
  app.post('/api/crafting/apply',(req,res)=>{
    const parsed=z.object({state:z.record(z.unknown()),currencyId:z.string().trim().min(1).max(60)}).safeParse(req.body);
    if(!parsed.success)return res.status(400).json({error:'Provide a crafting state and a currency id.'});
    try{
      const{state:nextState,evaluation}=applyAction(parsed.data.state as unknown as CraftingItemState,parsed.data.currencyId);
      return res.json({state:nextState,evaluation,legalActions:legalActions(nextState)});
    }catch(error){return res.status(422).json({error:message(error)});}
  });
  app.post('/api/crafting/compare',(req,res)=>{
    const parsed=z.object({state:z.record(z.unknown()),sellValue:z.number().nonnegative().optional(),buyPrice:z.number().nonnegative().optional()}).safeParse(req.body);
    if(!parsed.success)return res.status(400).json({error:'Provide a crafting state to compare.'});
    try{return res.json(compareContinueSellBuy(parsed.data.state as unknown as CraftingItemState,{sellValue:parsed.data.sellValue,buyPrice:parsed.data.buyPrice}));}
    catch(error){return res.status(422).json({error:message(error)});}
  });
  app.post('/api/crafting/history',(req,res)=>{
    const parsed=z.object({characterId:z.number().int().positive().optional(),action:z.string().trim().min(1).max(100),before:z.record(z.unknown()),after:z.record(z.unknown()),valueBefore:z.number().optional(),valueAfter:z.number().optional()}).safeParse(req.body);
    if(!parsed.success)return res.status(400).json({error:parsed.error.issues.map((issue)=>issue.message).join(', ')});
    const gainLoss=parsed.data.valueBefore!==undefined&&parsed.data.valueAfter!==undefined?Math.round((parsed.data.valueAfter-parsed.data.valueBefore)*100)/100:null;
    const afterState=parsed.data.after as {currencySpent?:unknown[]};
    const result=db.prepare('INSERT INTO crafting_history(character_id,action,before_json,after_json,currency_spent_count,value_before,value_after,gain_loss) VALUES (?,?,?,?,?,?,?,?)')
      .run(parsed.data.characterId??null,parsed.data.action,JSON.stringify(parsed.data.before),JSON.stringify(parsed.data.after),Array.isArray(afterState.currencySpent)?afterState.currencySpent.length:0,parsed.data.valueBefore??null,parsed.data.valueAfter??null,gainLoss);
    return res.status(201).json({id:Number(result.lastInsertRowid),gainLoss});
  });
  app.get('/api/crafting/history',(req,res)=>{
    const characterId=req.query.characterId?Number(req.query.characterId):undefined;
    const rows=(characterId
      ?db.prepare('SELECT id, character_id AS characterId, action, before_json AS beforeJson, after_json AS afterJson, currency_spent_count AS currencySpentCount, value_before AS valueBefore, value_after AS valueAfter, gain_loss AS gainLoss, created_at AS createdAt FROM crafting_history WHERE character_id=? ORDER BY created_at DESC LIMIT 100').all(characterId)
      :db.prepare('SELECT id, character_id AS characterId, action, before_json AS beforeJson, after_json AS afterJson, currency_spent_count AS currencySpentCount, value_before AS valueBefore, value_after AS valueAfter, gain_loss AS gainLoss, created_at AS createdAt FROM crafting_history ORDER BY created_at DESC LIMIT 100').all()
    ) as Array<{id:number;characterId:number|null;action:string;beforeJson:string;afterJson:string;currencySpentCount:number;valueBefore:number|null;valueAfter:number|null;gainLoss:number|null;createdAt:string}>;
    const history=rows.map((row)=>{
      const after=JSON.parse(row.afterJson) as CraftingItemState;
      const nextActions=legalActions(after).filter((a)=>a.legal);
      const safest=[...nextActions].sort((a,b)=>riskRank(a.risk)-riskRank(b.risk))[0];
      return{id:row.id,characterId:row.characterId,action:row.action,currencySpentCount:row.currencySpentCount,valueBefore:row.valueBefore,valueAfter:row.valueAfter,gainLoss:row.gainLoss,createdAt:row.createdAt,nextSafeAction:safest?safest.label:null,risks:nextActions.filter((a)=>a.risk==='high').map((a)=>`${a.label} carries high risk if attempted next.`)};
    });
    return res.json({history});
  });
  app.get('/api/admin/knowledge-status',(_req,res)=>{const table=(name:string)=>(db.prepare(`SELECT COUNT(*) count FROM ${name}`).get() as {count:number}).count;const sources=db.prepare('SELECT name,authority,last_success_at AS lastSuccessAt,last_error AS lastError,updated_at AS updatedAt FROM data_sources ORDER BY name').all();const patches=db.prepare('SELECT patch,data_version AS dataVersion,source,confidence,deprecated,updated_at AS updatedAt FROM patch_versions ORDER BY updated_at DESC').all();return res.json({patches,sources,counts:{itemBases:table('item_bases'),modifiers:table('modifier_definitions'),modifierGroups:table('modifier_groups'),craftingRules:table('crafting_rules'),skills:table('skill_profiles')},generatedAt:new Date().toISOString()});});

  app.get('/api/admin/patch/versions', (_req, res) => res.json({ versions: listCatalogVersions(db) }));
  app.post('/api/admin/patch/stage', async (req, res) => {
    const parsed = z.object({ patch: z.string().trim().min(1).max(30), dataVersion: z.string().trim().min(1).max(30), source: z.string().trim().min(1).max(300), modifiers: z.array(z.record(z.unknown())).optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(', ') });
    try {
      let raw: unknown = parsed.data.modifiers;
      if (!raw) {
        let sourceUrl: URL;
        try { sourceUrl = new URL(parsed.data.source); } catch { return res.status(400).json({ error: 'Provide either an inline "modifiers" array or a valid https:// "source" URL to download from.' }); }
        if (sourceUrl.protocol !== 'https:') return res.status(400).json({ error: 'Patch source URLs must use HTTPS.' });
        const response = await fetch(sourceUrl.toString(), { signal: AbortSignal.timeout(15_000) });
        if (!response.ok) return res.status(422).json({ error: `Could not download the patch source (HTTP ${response.status}).` });
        try { raw = await response.json(); } catch { return res.status(422).json({ error: 'The patch source did not return valid JSON.' }); }
      }
      const validated = validateModifierCatalog(raw);
      if (!validated.ok) return res.status(422).json({ error: 'Patch schema validation failed.', details: validated.errors });
      const staged = stagePatch(db, { patch: parsed.data.patch, dataVersion: parsed.data.dataVersion, source: parsed.data.source, entries: validated.entries });
      return res.status(201).json({ version: staged });
    } catch (error) { return res.status(422).json({ error: message(error) }); }
  });
  app.post('/api/admin/patch/:id/activate', (req, res) => {
    try { return res.json({ version: activatePatch(db, Number(req.params.id)) }); }
    catch (error) { return res.status(422).json({ error: message(error) }); }
  });
  app.post('/api/admin/patch/:id/rollback', (req, res) => {
    try { return res.json({ version: rollbackToVersion(db, Number(req.params.id)) }); }
    catch (error) { return res.status(422).json({ error: message(error) }); }
  });

  app.post('/api/build-doctor', (req, res) => {
    const parsed = z.object({
      equipment: z.array(z.object({ slot: z.string().trim().min(1).max(50), itemText: z.string().max(20000) })).min(1).max(20),
      selectedBuildProfileId: z.string().trim().max(100).optional(),
      selectedBuildProfileName: z.string().trim().max(100).optional(),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map((issue) => issue.message).join(', ') });
    const selectedKey = parsed.data.selectedBuildProfileId || parsed.data.selectedBuildProfileName;
    const build = selectedKey ? resolveBuildFitProfile(db, selectedKey) : (getActiveBuildProfile(db) || genericBuildFitProfile);
    if (!build) return res.status(400).json({ error: 'Selected build profile was not found.' });
    try { return res.json(diagnoseBuild(parsed.data.equipment, build)); }
    catch (error) { return res.status(422).json({ error: message(error) }); }
  });

  app.post('/api/trade/parse-url', (req, res) => {
    try {
      const parsed = parseTradeUrl(String(req.body?.url || ''));
      const result = db.prepare('INSERT INTO trade_queries(source_url, league, parsed_json) VALUES (?, ?, ?)').run(req.body.url, parsed.league, JSON.stringify(parsed));
      res.json({ id: Number(result.lastInsertRowid), ...parsed });
    } catch (error) { res.status(400).json({ error: message(error) }); }
  });

  app.post('/api/trade/build-url', (req, res) => {
    try {
      const parsed = parseItemText(String(req.body?.itemText || ''));
      const item = mergeItem(parsed, (req.body?.item || {}) as Partial<ItemStats>);
      const league = String(req.body?.league || 'Runes of Aldur');
      res.json({ url: buildTradeUrl(item, league), item });
    } catch (error) { res.status(400).json({ error: message(error) }); }
  });

  app.post('/api/analyze', async (req, res) => {
    const validated = analyzeSchema.safeParse(req.body);
    if (!validated.success) return res.status(400).json({ error: validated.error.issues.map((i) => i.message).join(', ') });
    try {
      const input = validated.data;
      const settings = getSettings(db);
      const rate = input.divineToExalted || settings.divineToExalted;
      const item = mergeItem(parseItemText(input.itemText), input.item as Partial<ItemStats>);
      if (!item.baseType && !item.itemType) return res.status(400).json({ error: 'Paste an item or enter at least its base/type.' });
      const character = input.characterId ? getCharacterRow(db, input.characterId) : null;
      if (character && !req.body.league) input.league = character.league;
      const effectiveCharacterTotals = { ...(character ? getSavedCharacterTotals(db, character.id) : {}), ...input.characterTotals };
      const normalizedItem = buildItemAnalysis(item, input.itemText, { league: input.league });
      const selectedKey=input.selectedBuildProfileId||input.selectedBuildProfileName||(character?.buildProfileId||undefined);
      const selectedBuild=selectedKey?resolveBuildFitProfile(db,selectedKey):(getActiveBuildProfile(db)||genericBuildFitProfile);
      if(!selectedBuild)return res.status(400).json({error:'Selected build profile was not found.'});
      const personalizationProfile=selectedBuild.source==='generic'?undefined:selectedBuild;
      const evaluation = evaluateItem(item, personalizationProfile);
      evaluation.buildFitAnalysis=analyzeBuildFit(item,evaluation,selectedBuild);
      const statContextBase={critical:deriveCritical(selectedBuild),damageTags:deriveDamageTags(selectedBuild),current:effectiveCharacterTotals,requirements:{strength:selectedBuild.attributeRequirements?.strength,dexterity:selectedBuild.attributeRequirements?.dexterity,intelligence:selectedBuild.attributeRequirements?.intelligence,spirit:selectedBuild.spiritTarget},caps:selectedBuild.resistanceCaps,buildWeight:deriveBuildWeights(selectedBuild)};
      const candidateSlot=evaluation.categoryAnalysis?.detectedCategory.key||'other';
      const candidateStatContext={...statContextBase,slot:candidateSlot,slotWeight:deriveSlotWeights(selectedBuild,candidateSlot)};
      const statValuation=valueItemStats(item,candidateStatContext);
      let equippedItem:ItemStats|undefined;let equippedEvaluation:ItemEvaluation|undefined;let equippedStatValuation:ReturnType<typeof valueItemStats>|undefined;
      if (input.equippedItemText.trim()) {
        equippedItem = mergeItem(parseItemText(input.equippedItemText), {});
        if (!equippedItem.baseType && !equippedItem.itemType) return res.status(400).json({ error: 'The equipped item could not be read.' });
        equippedEvaluation=evaluateItem(equippedItem,personalizationProfile);
        equippedEvaluation.buildFitAnalysis=analyzeBuildFit(equippedItem,equippedEvaluation,selectedBuild);
        const equippedSlot=equippedEvaluation.categoryAnalysis?.detectedCategory.key||'other';
        equippedStatValuation=valueItemStats(equippedItem,{...statContextBase,slot:equippedSlot,slotWeight:deriveSlotWeights(selectedBuild,equippedSlot)});
      }
      const manual = parseManualListings(input.manualListings, rate);
      let marketAnalysis: MarketAnalysisResult;
      if (manual.length) {
        marketAnalysis = manualMarketAnalysis(item, manual, rate);
      } else {
        marketAnalysis = await runMarketPipeline({ item, itemAnalysis: normalizedItem, build: selectedBuild, league: input.league, divineRate: rate });
        if (!marketAnalysis.usedCount) {
          const cached = findCachedListings(db, item, input.league, rate);
          if (cached.length) {
            const cacheAnalysis = manualMarketAnalysis(item, cached, rate);
            marketAnalysis = { ...cacheAnalysis, strategyUsed: 'cache', dataSource: 'cache', officialUrl: marketAnalysis.officialUrl, warning: `${marketAnalysis.warning} Showing previously saved official comparable listings instead.` };
          }
        }
      }
      const dataSource = marketAnalysis.dataSource;
      const warning = marketAnalysis.warning;
      if (item.baseType) recordPriceSnapshot(db, { baseType: item.baseType, itemClass: item.itemType || item.itemClass || '', league: input.league, dataSource, valuation: marketAnalysis.valuation });
      const officialUrl = marketAnalysis.officialUrl || buildTradeUrl(item, input.league);
      const estimate = toLegacyEstimate(marketAnalysis, item, rate);
      const comparableListings: Listing[] = [...marketAnalysis.comparablesUsed, ...marketAnalysis.comparablesRejected];
      const marketVerified = isLiveVerifiedSource(dataSource) && Boolean(estimate);
      const craftingPotential=assessCraftingPotential(item,evaluation,{craftingRiskTolerance:settings.craftingRiskTolerance,showCurrencyWarnings:settings.showCurrencyWarnings,conservativeCraftingRecommendations:settings.conservativeCraftingRecommendations,marketVerified});
      const comparison=equippedItem?compareItems(item,equippedItem,{selectedBuildProfile:selectedBuild,candidateEvaluation:evaluation,equippedEvaluation,characterTotals:effectiveCharacterTotals,candidateMarketValue:estimate?.fair,marketVerified}):undefined;
      const recommendation=decideItem({item,evaluation,comparison,estimate,dataSource,warning,statValuation},craftingPotential);
      const {evaluations,decision}=buildFourEvaluations({evaluation,comparison,craftingPotential,estimate,marketAnalysis,dataSource,recommendation});
      const opportunity=analyzeOpportunity({item,statContext:candidateStatContext,candidateOverallScore:statValuation.overallScore,estimate,marketAnalysis,comparison,craftingPotential,wastedStats:statValuation.contributions.filter((c)=>c.wasted).map((c)=>c.stat)});
      const beginnerSummary=buildBeginnerSummary({comparison,decision,evaluation});
      const payload = { item, normalizedItem, evaluation, comparison, craftingPotential, recommendation, evaluations, decision, opportunity, beginnerSummary, league: input.league, dataSource, warning, officialUrl, divineToExalted: rate, estimate, comparableListings, marketAnalysis, statValuation, equippedStatValuation, timestamp: new Date().toISOString() };
      let checkId: number | undefined;
      if (input.save) checkId = saveCheck(db, payload);
      if (character) {
        const summary = `${decision.action}: ${item.name || item.baseType || item.itemType || 'item'}${estimate ? ` (~${estimate.fair} Exalted)` : ''}`;
        db.prepare('INSERT INTO character_analysis_history(character_id, check_id, summary) VALUES (?, ?, ?)').run(character.id, checkId ?? null, summary);
        db.prepare('UPDATE characters SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(character.id);
      }
      return res.json({ id: checkId, characterId: character?.id, ...payload });
    } catch (error) { return res.status(500).json({ error: message(error) }); }
  });

  app.get('/api/market-history', (req, res) => {
    const parsed = z.object({ baseType: z.string().trim().min(1), league: z.string().trim().min(1) }).safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: 'Provide a baseType and league to look up market history.' });
    return res.json(getMarketHistory(db, parsed.data.baseType, parsed.data.league));
  });

  app.get('/api/checks', (_req, res) => {
    const rows = db.prepare('SELECT id, league, item_json, result_json, data_source, official_url, warning, created_at FROM checks ORDER BY id DESC').all() as any[];
    res.json(rows.map((row) => {
      const stored = normalizeStoredResult(JSON.parse(row.result_json));
      return { id: row.id, league: row.league, item: JSON.parse(row.item_json), result: stored.estimate, evaluation: stored.evaluation, comparison:stored.comparison, craftingPotential:stored.craftingPotential, recommendation:stored.recommendation, marketAnalysis: stored.marketAnalysis, statValuation: stored.statValuation, equippedStatValuation: stored.equippedStatValuation, evaluations: stored.evaluations, decision: stored.decision, opportunity: stored.opportunity, beginnerSummary: stored.beginnerSummary, dataSource: row.data_source, officialUrl: row.official_url, warning: row.warning, createdAt: row.created_at };
    }));
  });

  app.get('/api/checks/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM checks WHERE id = ?').get(req.params.id) as any;
    if (!row) return res.status(404).json({ error: 'Saved check not found.' });
    const comps = db.prepare('SELECT listing_json, similarity, excluded_reason FROM comparable_listings WHERE check_id = ? ORDER BY similarity DESC').all(req.params.id) as any[];
    const stored = normalizeStoredResult(JSON.parse(row.result_json));
    return res.json({ id: row.id, league: row.league, item: JSON.parse(row.item_json), result: stored.estimate, evaluation: stored.evaluation, comparison:stored.comparison, craftingPotential:stored.craftingPotential, recommendation:stored.recommendation, marketAnalysis: stored.marketAnalysis, statValuation: stored.statValuation, equippedStatValuation: stored.equippedStatValuation, evaluations: stored.evaluations, decision: stored.decision, opportunity: stored.opportunity, beginnerSummary: stored.beginnerSummary, dataSource: row.data_source, officialUrl: row.official_url, warning: row.warning, createdAt: row.created_at, comparableListings: comps.map((c) => ({ ...JSON.parse(c.listing_json), similarity: c.similarity, excludedReason: c.excluded_reason })) });
  });

  app.delete('/api/checks/:id', (req, res) => {
    const result = db.prepare('DELETE FROM checks WHERE id = ?').run(req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Saved check not found.' });
    return res.status(204).send();
  });

  app.get('/api/settings', (_req, res) => res.json(getSettings(db)));
  app.put('/api/settings', (req, res) => {
    const schema = z.object({ divineToExalted: z.number().positive().max(100000), defaultLeague: z.string().min(1).max(100),craftingRiskTolerance:z.enum(['Low','Medium','High']).default('Medium'),showCurrencyWarnings:z.boolean().default(true),conservativeCraftingRecommendations:z.boolean().default(true),interfaceMode:z.enum(['Beginner','Advanced']).default('Beginner') });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(', ') });
    withTransaction(db, () => {
      for (const [key, value] of Object.entries(parsed.data)) db.prepare(`INSERT INTO settings(key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`).run(key, String(value));
      db.prepare('INSERT INTO currency_rates(divine_to_exalted, source) VALUES (?, ?)').run(parsed.data.divineToExalted, 'manual');
    });
    return res.json(getSettings(db));
  });

  app.get('/api/build-profile', (_req, res) => res.json({ profile: getActiveBuildProfile(db) }));
  app.get('/api/build-profiles', (_req,res) => res.json({profiles:[...allCodeProfiles(),...loadCustomBuildProfiles(db)]}));
  app.post('/api/build-profiles',(req,res)=>{
    const parsed=customBuildProfileSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:parsed.error.issues.map((issue)=>issue.message).join(', ')});
    try{const temp=createCustomBuildProfile(0,parsed.data);const result=db.prepare('INSERT INTO build_profiles(name,profile_json) VALUES (?,?)').run(parsed.data.name,JSON.stringify(temp));const profile=createCustomBuildProfile(Number(result.lastInsertRowid),parsed.data);db.prepare('UPDATE build_profiles SET profile_json=? WHERE id=?').run(JSON.stringify(profile),result.lastInsertRowid);return res.status(201).json({profile});}catch(error){return res.status(409).json({error:message(error)});}
  });
  app.put('/api/build-profiles/:id',(req,res)=>{
    const parsed=customBuildProfileSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:parsed.error.issues.map((issue)=>issue.message).join(', ')});
    const id=customId(req.params.id);if(!id)return res.status(400).json({error:'Only custom profiles can be edited.'});const profile=createCustomBuildProfile(id,parsed.data);
    try{const result=db.prepare('UPDATE build_profiles SET name=?,profile_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(profile.name,JSON.stringify(profile),id);return result.changes?res.json({profile}):res.status(404).json({error:'Custom build profile not found.'});}catch(error){return res.status(409).json({error:message(error)});}
  });
  app.delete('/api/build-profiles/:id',(req,res)=>{const id=customId(req.params.id);if(!id)return res.status(400).json({error:'Default profiles cannot be deleted.'});const result=db.prepare('DELETE FROM build_profiles WHERE id=?').run(id);return result.changes?res.status(204).send():res.status(404).json({error:'Custom build profile not found.'});});
  app.post('/api/build-profile/import', async (req, res) => {
    const parsed = z.object({ url: z.string().trim().min(1).max(500) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Enter a supported PoE 2 build URL.' });
    try {
      const result = await importBuildGuide(parsed.data.url);
      const snapshot = db.prepare('INSERT INTO build_import_snapshots(url, provider, method, partial, fields_json, warnings_json) VALUES (?,?,?,?,?,?)')
        .run(parsed.data.url, result.provider, result.method, result.partial ? 1 : 0, JSON.stringify(result.fields), JSON.stringify(result.warnings));
      return res.json({ ...result, snapshotId: Number(snapshot.lastInsertRowid) });
    } catch (error) { return res.status(422).json({ error: message(error) }); }
  });
  app.post('/api/leveling/search', async (req, res) => {
    const parsed = z.object({
      guideUrl: z.string().trim().min(1).max(500),
      level: z.number().int().min(10).max(100),
      league: z.string().trim().min(1).max(100).default('Runes of Aldur'),
      // High budgets are useful when the player is already mapping; do not reject
      // a legitimate guide simply because the item budget is above 1,000 Ex.
      maxPrice: z.number().positive().max(10000).default(3),
      equipment: z.array(z.object({ slot: z.string().trim().min(1).max(50), itemText: z.string().max(20000) })).max(20).optional(),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Enter a valid build link, a level from 10 to 100, and a positive budget.' });
    try {
      const imported = await importBuildGuide(parsed.data.guideUrl);
      const weakestSlots = parsed.data.equipment?.length ? diagnoseBuild(parsed.data.equipment, imported.profile).weakestSlots.map(mapToLevelingSlot).filter((s): s is LevelingSlot => Boolean(s)) : undefined;
      const slots = await searchLevelingItems(imported.profile, parsed.data.level, parsed.data.league, parsed.data.maxPrice, { weakestSlots });
      const milestone = milestoneFor(parsed.data.level);
      return res.json({ profile: imported.profile, source: imported.source, provider: imported.provider, warnings: imported.warnings, level: parsed.data.level, league: parsed.data.league, maxPrice: parsed.data.maxPrice, slots, milestone, nextMilestoneLevel: nextMilestoneLevel(parsed.data.level), whatChangesNext: whatChangesAtNextMilestone(parsed.data.level) });
    } catch (error) { return res.status(422).json({ error: message(error) }); }
  });
  app.put('/api/build-profile', (req, res) => {
    const parsed = buildProfileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map((issue) => issue.message).join(', ') });
    try { return res.json({ profile: upsertActiveBuildProfile(db, parsed.data) }); }
    catch (error) { return res.status(409).json({ error: message(error) }); }
  });
  app.delete('/api/build-profile', (_req, res) => {
    db.prepare("DELETE FROM settings WHERE key = 'activeBuildProfileId'").run();
    db.prepare("DELETE FROM settings WHERE key = 'buildProfile'").run();
    return res.status(204).send();
  });

  app.get('/api/race-reviews', (_req, res) => {
    const rows = db.prepare('SELECT id, title, cause, lesson, item_category AS itemCategory, created_at AS createdAt FROM race_reviews ORDER BY id DESC LIMIT 50').all();
    return res.json({ reviews: rows });
  });
  app.post('/api/race-reviews', (req, res) => {
    const parsed = z.object({ title:z.string().trim().min(1).max(100), cause:z.string().trim().min(1).max(500), lesson:z.string().trim().min(1).max(500), itemCategory:z.string().trim().max(50).optional().default('') }).safeParse(req.body);
    if(!parsed.success)return res.status(400).json({ error:parsed.error.issues.map((issue)=>issue.message).join(', ') });
    const result=db.prepare('INSERT INTO race_reviews(title,cause,lesson,item_category) VALUES (?,?,?,?)').run(parsed.data.title,parsed.data.cause,parsed.data.lesson,parsed.data.itemCategory||null);
    const review=db.prepare('SELECT id, title, cause, lesson, item_category AS itemCategory, created_at AS createdAt FROM race_reviews WHERE id=?').get(result.lastInsertRowid);
    return res.status(201).json({ review });
  });
  app.delete('/api/race-reviews/:id', (req,res) => {
    const result=db.prepare('DELETE FROM race_reviews WHERE id=?').run(req.params.id);
    return result.changes?res.status(204).send():res.status(404).json({error:'Review not found.'});
  });

  app.get('/api/characters', (_req, res) => {
    const rows = db.prepare('SELECT id, name, league, level, class_name AS className, ascendancy, build_profile_id AS buildProfileId, stage, budget, target_content AS targetContent, current_issues AS currentIssues, updated_at AS updatedAt FROM characters ORDER BY updated_at DESC').all();
    return res.json({ characters: rows });
  });
  app.post('/api/characters', (req, res) => {
    const parsed = characterSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map((issue) => issue.message).join(', ') });
    try {
      const result = db.prepare('INSERT INTO characters(name, league, level, class_name, ascendancy, build_profile_id, stage, budget, target_content, current_issues) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .run(parsed.data.name, parsed.data.league, parsed.data.level ?? null, parsed.data.className, parsed.data.ascendancy, parsed.data.buildProfileId, parsed.data.stage ?? null, parsed.data.budget ?? null, parsed.data.targetContent, parsed.data.currentIssues);
      return res.status(201).json({ character: getCharacterRow(db, Number(result.lastInsertRowid)) });
    } catch (error) { return res.status(409).json({ error: message(error) }); }
  });
  app.get('/api/characters/:id', (req, res) => {
    const character = getCharacterRow(db, Number(req.params.id));
    if (!character) return res.status(404).json({ error: 'Character not found.' });
    const equipment = db.prepare('SELECT slot, item_text AS itemText FROM character_equipment WHERE character_id = ? ORDER BY slot').all(character.id) as Array<{ slot: string; itemText: string }>;
    const build = character.buildProfileId ? resolveBuildFitProfile(db, character.buildProfileId) : (getActiveBuildProfile(db) || genericBuildFitProfile);
    const diagnosis = equipment.length && build ? diagnoseBuild(equipment, build) : null;
    const history = db.prepare('SELECT h.id, h.check_id AS checkId, h.summary, h.created_at AS createdAt FROM character_analysis_history h WHERE h.character_id = ? ORDER BY h.created_at DESC LIMIT 25').all(character.id);
    return res.json({ character, equipment, diagnosis, history });
  });
  app.put('/api/characters/:id', (req, res) => {
    const character = getCharacterRow(db, Number(req.params.id));
    if (!character) return res.status(404).json({ error: 'Character not found.' });
    const parsed = characterSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map((issue) => issue.message).join(', ') });
    try {
      db.prepare('UPDATE characters SET name=?, league=?, level=?, class_name=?, ascendancy=?, build_profile_id=?, stage=?, budget=?, target_content=?, current_issues=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
        .run(parsed.data.name, parsed.data.league, parsed.data.level ?? null, parsed.data.className, parsed.data.ascendancy, parsed.data.buildProfileId, parsed.data.stage ?? null, parsed.data.budget ?? null, parsed.data.targetContent, parsed.data.currentIssues, character.id);
      return res.json({ character: getCharacterRow(db, character.id) });
    } catch (error) { return res.status(409).json({ error: message(error) }); }
  });
  app.put('/api/characters/:id/equipment', (req, res) => {
    const character = getCharacterRow(db, Number(req.params.id));
    if (!character) return res.status(404).json({ error: 'Character not found.' });
    const parsed = characterEquipmentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map((issue) => issue.message).join(', ') });
    withTransaction(db, () => {
      const upsert = db.prepare('INSERT INTO character_equipment(character_id, slot, item_text, updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(character_id, slot) DO UPDATE SET item_text = excluded.item_text, updated_at = CURRENT_TIMESTAMP');
      for (const entry of parsed.data.equipment) upsert.run(character.id, entry.slot, entry.itemText);
      db.prepare('UPDATE characters SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(character.id);
    });
    const equipment = db.prepare('SELECT slot, item_text AS itemText FROM character_equipment WHERE character_id = ? ORDER BY slot').all(character.id) as Array<{ slot: string; itemText: string }>;
    return res.json({ equipment });
  });
  app.delete('/api/characters/:id', (req, res) => {
    const result = db.prepare('DELETE FROM characters WHERE id = ?').run(req.params.id);
    return result.changes ? res.status(204).send() : res.status(404).json({ error: 'Character not found.' });
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(500).json({ error: message(err) }));
  return app;
}

function saveCheck(db: AppDatabase, payload: any) {
  return withTransaction(db, () => {
    const result = db.prepare('INSERT INTO checks(league, item_json, result_json, data_source, official_url, warning) VALUES (?, ?, ?, ?, ?, ?)').run(payload.league, JSON.stringify(payload.item), JSON.stringify({ estimate: payload.estimate, evaluation: payload.evaluation, comparison:payload.comparison, craftingPotential:payload.craftingPotential, recommendation:payload.recommendation, marketAnalysis: payload.marketAnalysis, statValuation: payload.statValuation, equippedStatValuation: payload.equippedStatValuation, evaluations: payload.evaluations, decision: payload.decision, opportunity: payload.opportunity, beginnerSummary: payload.beginnerSummary }), payload.dataSource, payload.officialUrl, payload.warning || null);
    const checkId = Number(result.lastInsertRowid);
    const insert = db.prepare('INSERT INTO comparable_listings(check_id, external_id, listing_json, similarity, excluded_reason) VALUES (?, ?, ?, ?, ?)');
    for (const listing of payload.comparableListings) insert.run(checkId, listing.id, JSON.stringify(listing), listing.similarity || 0, listing.excludedReason || null);
    return checkId;
  });
}

function withTransaction<T>(db: AppDatabase, operation: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = operation();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function findCachedListings(db: AppDatabase, item: ItemStats, league: string, divineRate: number): Listing[] {
  const rows = db.prepare(`SELECT cl.listing_json FROM comparable_listings cl JOIN checks c ON c.id = cl.check_id WHERE c.league = ? AND c.data_source IN ('live','relaxed-live') AND cl.excluded_reason IS NULL AND c.created_at >= datetime('now', '-24 hours') ORDER BY c.created_at DESC LIMIT 100`).all(league) as Array<{ listing_json: string }>;
  const listings = rows.map((row) => JSON.parse(row.listing_json) as Listing).filter((row) => row.baseType.toLowerCase() === item.baseType.toLowerCase());
  return dedupeListings(listings).map((row) => ({ ...row, source: 'cache', exaltedPrice: row.currency === 'divine' ? row.price * divineRate : row.price }));
}

const message = (error: unknown) => error instanceof Error ? error.message : String(error);
const riskRank = (risk: 'low' | 'medium' | 'high' | 'unknown') => ({ low: 0, medium: 1, unknown: 2, high: 3 }[risk]);

function normalizeStoredResult(value: any) {
  if (value && Object.prototype.hasOwnProperty.call(value, 'estimate')) return { marketAnalysis: null, statValuation: null, equippedStatValuation: null, evaluations: null, decision: null, opportunity: null, beginnerSummary: null, ...value };
  return { estimate: value || null, evaluation: null, comparison:null, craftingPotential:null, recommendation:null, marketAnalysis: null, statValuation: null, equippedStatValuation: null, evaluations: null, decision: null, opportunity: null, beginnerSummary: null };
}

function loadCustomBuildProfiles(db:AppDatabase):BuildFitProfile[]{return(db.prepare('SELECT profile_json FROM build_profiles ORDER BY name').all() as Array<{profile_json:string}>).flatMap((row)=>{try{return[JSON.parse(row.profile_json) as BuildFitProfile];}catch{return[];}});}
function resolveBuildFitProfile(db:AppDatabase,idOrName:string){const builtIn=findDefaultBuildProfile(idOrName);if(builtIn)return builtIn;const value=idOrName.toLowerCase();return loadCustomBuildProfiles(db).find((profile)=>profile.id.toLowerCase()===value||profile.name.toLowerCase()===value);}
function customId(value:string){const match=value.match(/^(?:custom:)?(\d+)$/);return match?Number(match[1]):0;}

function getCharacterRow(db:AppDatabase,id:number){
  if(!id)return null;
  return db.prepare('SELECT id, name, league, level, class_name AS className, ascendancy, build_profile_id AS buildProfileId, stage, budget, target_content AS targetContent, current_issues AS currentIssues, updated_at AS updatedAt FROM characters WHERE id = ?').get(id) as {id:number;name:string;league:string;level:number|null;className:string;ascendancy:string;buildProfileId:string;stage:string|null;budget:number|null;targetContent:string;currentIssues:string;updatedAt:string}|undefined||null;
}
function importPoeCharacter(db:AppDatabase, remote:PoeCharacter){
  const name=String(remote.name||'').trim();if(!name)throw new Error('Path of Exile returned a character without a name.');
  const league=String(remote.league||'Unknown League');const className=String(remote.className||remote.class||'');const ascendancy=String(remote.ascendancy||'');const level=Number(remote.level)||null;
  db.prepare(`INSERT INTO characters(name,league,level,class_name,ascendancy,stage,updated_at) VALUES (?,?,?,?,?,'endgame',CURRENT_TIMESTAMP) ON CONFLICT(name,league) DO UPDATE SET level=excluded.level,class_name=excluded.class_name,ascendancy=excluded.ascendancy,updated_at=CURRENT_TIMESTAMP)`).run(name,league,level,className,ascendancy);
  const character=db.prepare('SELECT id FROM characters WHERE name=? AND league=?').get(name,league) as {id:number};const equipment=equipmentFromPoeCharacter(remote);const upsert=db.prepare('INSERT INTO character_equipment(character_id,slot,item_text,updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(character_id,slot) DO UPDATE SET item_text=excluded.item_text,updated_at=CURRENT_TIMESTAMP');for(const entry of equipment)upsert.run(character.id,entry.slot,entry.itemText);return character.id;
}
function equipmentFromPoeCharacter(remote:PoeCharacter){
  const raw=[...(Array.isArray(remote.equipment)?remote.equipment:[]),...(Array.isArray(remote.items)?remote.items:[])];const bySlot=new Map<string,string>();for(const value of raw){if(!value||typeof value!=='object')continue;const item=value as Record<string,unknown>;const slot=poeSlot(String(item.inventoryId||item.slot||''));if(!slot||bySlot.has(slot))continue;const text=poeItemText(item);if(text)bySlot.set(slot,text);}return[...bySlot].map(([slot,itemText])=>({slot,itemText}));
}
function poeSlot(value:string){const normalized=value.toLowerCase();if(/weapon|mainhand/.test(normalized))return'Weapon';if(/offhand/.test(normalized))return'Offhand';if(/helm/.test(normalized))return'Helmet';if(/body|chest/.test(normalized))return'Body Armour';if(/glove/.test(normalized))return'Gloves';if(/boot/.test(normalized))return'Boots';if(/belt/.test(normalized))return'Belt';if(/amulet/.test(normalized))return'Amulet';if(/ring/.test(normalized))return normalized.includes('2')||normalized.includes('right')?'Ring 2':'Ring 1';return'';}
function poeItemText(item:Record<string,unknown>){const typeLine=String(item.typeLine||item.baseType||'').trim();if(!typeLine)return'';const rarity=String(item.rarity||'Rare');const lines=[`Item Class: ${String(item.itemClass||'Unknown')}`,`Rarity: ${rarity}`];if(item.name)lines.push(String(item.name));lines.push(typeLine,'--------');if(item.ilvl)lines.push(`Item Level: ${item.ilvl}`);const mods=[...readPoeLines(item.implicitMods),...readPoeLines(item.explicitMods),...readPoeLines(item.enchantMods),...readPoeLines(item.craftedMods)];if(mods.length)lines.push(...mods);return lines.join('\n');}
function readPoeLines(value:unknown){return Array.isArray(value)?value.map(row=>typeof row==='string'?row:(row&&typeof row==='object'?String((row as Record<string,unknown>).description||''):'' )).filter(Boolean):[] as string[];}
function getSavedCharacterTotals(db:AppDatabase, characterId:number) {
  const totals:{fireResistance:number;coldResistance:number;lightningResistance:number;chaosResistance:number;strength:number;dexterity:number;intelligence:number;spirit:number}={fireResistance:0,coldResistance:0,lightningResistance:0,chaosResistance:0,strength:0,dexterity:0,intelligence:0,spirit:0};
  const rows=db.prepare('SELECT item_text AS itemText FROM character_equipment WHERE character_id = ?').all(characterId) as Array<{itemText:string}>;
  for(const row of rows){const item=mergeItem(parseItemText(row.itemText),{});for(const key of Object.keys(totals) as Array<keyof typeof totals>)totals[key]+=Number(item[key])||0;}
  return totals;
}

function mapToLevelingSlot(slot:string):LevelingSlot|undefined{
  const value=slot.toLowerCase();
  if(/weapon|bow|crossbow|wand|staff|sceptre|axe|sword|mace|dagger|flail|spear/.test(value))return'weapon';
  if(/boot/.test(value))return'boots';
  if(/body|chest|armour/.test(value)&&!/gloves|boots/.test(value))return'body-armour';
  if(/helm/.test(value))return'helmet';
  if(/glove/.test(value))return'gloves';
  if(/ring/.test(value))return'ring';
  if(/amulet/.test(value))return'amulet';
  if(/belt/.test(value))return'belt';
  return undefined;
}

function upsertActiveBuildProfile(db:AppDatabase,input:LegacyBuildProfileInput):BuildFitProfile{
  const existing=db.prepare('SELECT id FROM build_profiles WHERE name = ?').get(input.name) as {id:number}|undefined;
  const id=existing?.id??Number(db.prepare('INSERT INTO build_profiles(name,profile_json) VALUES (?,?)').run(input.name,'{}').lastInsertRowid);
  const profile=createBuildProfileFromPriorities(`custom:${id}`,input);
  db.prepare('UPDATE build_profiles SET name=?,profile_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(input.name,JSON.stringify(profile),id);
  db.prepare(`INSERT INTO settings(key, value, updated_at) VALUES ('activeBuildProfileId', ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`).run(profile.id);
  return profile;
}

function getActiveBuildProfile(db:AppDatabase):BuildFitProfile|null{
  const pointer=db.prepare("SELECT value FROM settings WHERE key = 'activeBuildProfileId'").get() as {value:string}|undefined;
  if(pointer){const resolved=resolveBuildFitProfile(db,pointer.value);if(resolved)return resolved;}
  const legacy=db.prepare("SELECT value FROM settings WHERE key = 'buildProfile'").get() as {value:string}|undefined;
  if(!legacy)return null;
  try{
    const old=JSON.parse(legacy.value);
    const migrated=upsertActiveBuildProfile(db,{name:old.name,className:old.className,ascendancy:old.ascendancy,mainSkill:old.mainSkill,guideUrl:old.guideUrl,stage:old.stage||'endgame',evaluationStyle:old.evaluationStyle||'balanced',defenceStyle:old.defenceStyle||'custom',priorities:old.priorities||[],requiredMods:old.requiredMods||[],desiredMods:old.desiredMods||[],notes:old.notes});
    db.prepare("DELETE FROM settings WHERE key = 'buildProfile'").run();
    return migrated;
  }catch{return null;}
}
