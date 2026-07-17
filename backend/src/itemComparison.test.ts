import { describe,expect,it } from 'vitest';
import { compareItems } from './itemComparison.js';
import type { ItemCategory, ItemEvaluation, ItemStats } from './types.js';

describe('equipped item comparison',()=>{
  it('detects a clear upgrade',()=>{const result=compareItems(boots({life:95,movementSpeed:35,fireResistance:40,coldResistance:40,evasion:500}),boots({life:35,movementSpeed:15,fireResistance:10,evasion:100}));expect(result.verdict).toBe('Clear Upgrade');expect(result.scoreDelta).toBeGreaterThan(0);});
  it('detects a small upgrade',()=>{const candidate=ring({life:70});const equipped=ring({life:50});const result=compareItems(candidate,equipped,{candidateEvaluation:evaluation('ring',60,62,60),equippedEvaluation:evaluation('ring',50,52,50)});expect(result.verdict).toBe('Small Upgrade');});
  it('detects a sidegrade',()=>{const result=compareItems(ring({strength:30}),ring({dexterity:30}));expect(result.verdict).toBe('Sidegrade');expect(result.gains.join(' ')).toMatch(/Strength/);expect(result.losses.join(' ')).toMatch(/Dexterity/);});
  it('detects a downgrade',()=>{const result=compareItems(boots({life:40}),boots({life:90,movementSpeed:30,fireResistance:35,coldResistance:35,evasion:400}));expect(result.verdict).toBe('Downgrade');});
  it('rejects incompatible categories',()=>{const result=compareItems(boots({}),shield({}));expect(result.verdict).toBe('Not Comparable');expect(result.comparable).toBe(false);});
  it('compares weapon DPS',()=>{const result=compareItems(crossbow({physicalDamageMin:220,physicalDamageMax:440,attacksPerSecond:1.7}),crossbow({physicalDamageMin:90,physicalDamageMax:180,attacksPerSecond:1.3}));expect(result.statDeltas.totalDps).toBeGreaterThan(300);expect(['Clear Upgrade','Offensive Upgrade']).toContain(result.verdict);});
  it('does not penalize weapons for missing defensive stats',()=>{const result=compareItems(crossbow({physicalDamageMin:220,physicalDamageMax:440,attacksPerSecond:1.7}),crossbow({physicalDamageMin:90,physicalDamageMax:180,attacksPerSecond:1.3,life:100,fireResistance:40,armour:500}));expect(result.verdict).not.toBe('Downgrade');expect(result.worseFor).not.toContain('defence');});
  it('treats losing movement speed on Boots as a downgrade',()=>{const result=compareItems(boots({life:100,fireResistance:40}),boots({life:70,movementSpeed:30,fireResistance:30}));expect(result.verdict).toBe('Downgrade');expect(result.warnings.join(' ')).toMatch(/movement speed/i);});
  it('heavily compares Shield block',()=>{const result=compareItems(shield({blockChance:38,armour:1000,life:90}),shield({blockChance:20,armour:350,life:70}));expect(result.statDeltas.blockChance).toBe(18);expect(result.betterFor).toContain('defence');});
  it('warns about resistance loss',()=>{const result=compareItems(ring({coldResistance:5}),ring({coldResistance:35}));expect(result.warnings.join(' ')).toMatch(/lose 30% Cold Resistance/i);});
  it('warns about attribute loss',()=>{const result=compareItems(ring({dexterity:5}),ring({dexterity:47}));expect(result.warnings.join(' ')).toMatch(/lose 42 Dexterity/i);});
  it('calculates character total impact and cap risk',()=>{const result=compareItems(ring({coldResistance:15,strength:10}),ring({coldResistance:40,strength:35}),{characterTotals:{coldResistance:75,strength:120}});expect(result.characterImpact?.after.coldResistance).toBe(50);expect(result.characterImpact?.after.strength).toBe(95);expect(result.characterImpact?.warnings.join(' ')).toMatch(/break your Cold Resistance cap/i);});
  it('does not credit a resistance gain toward the defensive dimension once the character is already at the cap',()=>{
    const candidate=ring({fireResistance:40});const equipped=ring({fireResistance:5});
    const fresh=compareItems(candidate,equipped);
    const alreadyCapped=compareItems(candidate,equipped,{characterTotals:{fireResistance:75}});
    expect(fresh.betterFor).toContain('defence');
    expect(alreadyCapped.betterFor).not.toContain('defence');
  });
});

function base(category:string,extra:Partial<ItemStats>):ItemStats{return{itemType:category,itemClass:category,baseType:category,rarity:'rare',customMods:[],...extra};}
const boots=(extra:Partial<ItemStats>)=>base('Boots',extra);const ring=(extra:Partial<ItemStats>)=>base('Rings',extra);const shield=(extra:Partial<ItemStats>)=>base('Shields',extra);const crossbow=(extra:Partial<ItemStats>)=>base('Crossbows',extra);
function evaluation(category:ItemCategory,score:number,categoryScore:number,fit:number):ItemEvaluation{return{score,grade:score>=74?'excellent':score>=55?'good':score>=34?'basic':'poor',label:'test',verdict:'test',marketability:'niche',strengths:[],weaknesses:[],buildFits:[],upgradePriorities:[],categoryAnalysis:{detectedCategory:{key:category,label:category,priorities:[]},detectionReason:'test',categoryScore,positiveStats:[],weakOrWastedStats:[],missingImportantStats:[],marketRelevantStats:[],buildRelevantStats:[],tradeSearchPriorities:[],confidence:90,warnings:[],parsedLines:[]},buildFitAnalysis:{profileId:'test',profileName:'Test',buildSpecific:true,score:fit,label:fit>=85?'Build-defining':fit>=65?'Great':fit>=45?'Good':fit>=25?'Usable':'Bad',fitsBecause:[],doesNotFitBecause:[],bestUseCase:'endgame',missingImportantStats:[],wastedStats:[],recommendedAction:'Use',confidence:90,warnings:[]}};}
