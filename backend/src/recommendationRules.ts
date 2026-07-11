import { itemActionLabels } from './itemActionLabels.js';
import type { StatValuation } from './statValuationEngine.js';
import { isLiveVerifiedSource, type CraftingPotential, type DataSource, type Estimate, type ItemAction, type ItemCategory, type ItemEvaluation, type ItemStats } from './types.js';

export interface RecommendationContext {
  item: ItemStats;
  evaluation: ItemEvaluation;
  craftingPotential: CraftingPotential;
  estimate: Estimate | null;
  dataSource: DataSource;
  warning?: string;
  comparison?: { compatible: boolean; comparable?:boolean; scoreDelta?: number; verdict?:string; recommendationImpact?:string };
  statValuation?: StatValuation;
}

export interface RuleDecision {
  action: ItemAction;
  secondaryAction?: ItemAction;
  shortReason: string;
  reasons: string[];
  hiddenValueFlags: string[];
  safeToVendor: boolean;
}

export function chooseItemAction(context: RecommendationContext): RuleDecision {
  const { item, evaluation, craftingPotential, estimate, dataSource, statValuation } = context;
  const category = evaluation.categoryAnalysis;
  const fit = evaluation.buildFitAnalysis;
  const rawCategoryScore = category?.categoryScore ?? evaluation.score;
  const categoryScore = statValuation && statValuation.contributions.length ? Math.round(rawCategoryScore * 0.6 + statValuation.overallScore * 0.4) : rawCategoryScore;
  const fitScore = fit?.score ?? 0;
  const hasSpecificBuild = Boolean(fit?.buildSpecific);
  const liveVerified = isLiveVerifiedSource(dataSource) && Boolean(estimate);
  const missing = unique([...(category?.missingImportantStats || []), ...(fit?.missingImportantStats || [])]);
  const statWasted = (statValuation?.contributions || []).filter((entry) => entry.wasted).map((entry) => entry.stat);
  const wasted = unique([...(category?.weakOrWastedStats || []), ...(fit?.wastedStats || []), ...statWasted]);
  const hiddenValueFlags = detectHiddenValue(item, evaluation);
  const isBootsWithoutSpeed = category?.detectedCategory.key === 'boots' && !(item.movementSpeed || 0);
  const displayedWeaponDps = weaponDps(item);
  const strongDisplayedWeapon = isStrongDisplayedWeapon(category?.detectedCategory.key, displayedWeaponDps);
  const coreFlaw = isBootsWithoutSpeed || missing.length >= 2 || (category?.warnings || []).some((line) => /major|low dps|weak local|block/i.test(line));
  const clearUpgrade = Boolean(context.comparison?.compatible && (context.comparison.scoreDelta || 0) >= 5);
  const generallyGood = evaluation.score >= 55 || categoryScore >= 60;
  const marketable = evaluation.marketability !== 'low' && generallyGood;

  if (item.rarity === 'unique' || hiddenValueFlags.some((flag) => /build-enabling|unusual|top-end|corruption/i.test(flag))) {
    return decision('Price Check', liveVerified ? 'Keep for Later' : undefined, 'Possible build-specific or hidden value should be checked manually.', [item.rarity === 'unique' ? 'Unique interactions cannot be valued safely from generic affix scoring.' : 'One or more uncommon value signals were detected.', liveVerified ? 'Live comparables exist, but special interactions may need a narrower search.' : 'No live official price was verified.'], hiddenValueFlags, false);
  }

  if(context.comparison?.compatible&&context.comparison.verdict==='Downgrade')return decision(liveVerified&&marketable?'Sell':'Keep for Later',craftingPotential.score>=55&&!item.corrupted?'Craft':undefined,'The new item is a downgrade from the currently equipped item.',[context.comparison.recommendationImpact||'Keep the currently equipped item.',`Universal quality changes by ${context.comparison.scoreDelta||0}.`],hiddenValueFlags,false);
  if(context.comparison?.compatible&&['Clear Upgrade','Small Upgrade','Offensive Upgrade','Defensive Upgrade'].includes(context.comparison.verdict||'')&&!isBootsWithoutSpeed&&fitScore>=45)return decision('Use',liveVerified&&marketable?'Sell':undefined,`The new item is a ${String(context.comparison.verdict).toLowerCase()} over the equipped item.`,[context.comparison.recommendationImpact||'The equipped comparison supports replacing the current item.',`Selected-build fit is ${fitScore}/100.`],hiddenValueFlags,false);

  if (hasSpecificBuild && !isBootsWithoutSpeed && context.comparison?.verdict!=='Downgrade' && ((fitScore >= 68 && categoryScore >= 42) || (strongDisplayedWeapon && fitScore >= 55))) {
    return decision('Use', liveVerified && marketable ? 'Sell' : undefined, clearUpgrade ? 'This is a measured upgrade with a strong fit for the selected build.' : strongDisplayedWeapon ? 'The weapon has strong displayed DPS and supports the selected attack build.' : 'The item strongly supports the selected build and its slot priorities.', [`Build fit is ${fitScore}/100 (${fit?.label}).`, `Category score is ${categoryScore}/100.`, ...(strongDisplayedWeapon ? [`Displayed weapon DPS is approximately ${Math.round(displayedWeaponDps)}.`] : []), ...(clearUpgrade ? [`It improves the equipped-item quality score by ${context.comparison?.scoreDelta}.`] : [])], hiddenValueFlags, false);
  }

  if (liveVerified && marketable && (!hasSpecificBuild || fitScore < 45)) {
    return decision('Sell', craftingPotential.score >= 60 ? 'Craft' : 'Keep for Later', 'The item has verified market appeal but does not suit the selected build.', [`Official live Trade2 comparables support a real market decision.`, `General quality is ${evaluation.score}/100 and category score is ${categoryScore}/100.`, ...(hasSpecificBuild ? [`Selected-build fit is only ${fitScore}/100.`] : ['No specific build profile was selected.'])], hiddenValueFlags, false);
  }

  if (!item.corrupted && item.rarity === 'rare' && craftingPotential.score >= 64 && wasted.length <= 2) {
    return decision('Craft', marketable ? (liveVerified ? 'Sell' : 'Price Check') : undefined, 'A good base and manageable missing stats make this a realistic craft.', [`Crafting potential is ${craftingPotential.score}/100 (${craftingPotential.label}).`, ...craftingPotential.reasons.slice(0, 3)], hiddenValueFlags, false);
  }

  if ((hasSpecificBuild && fitScore >= 25 && fitScore < 68) || (generallyGood && coreFlaw)) {
    const flaw = isBootsWithoutSpeed ? 'Movement speed is missing from Boots, which is a slot-defining weakness.' : missing.length ? `Important stats are missing: ${missing.slice(0, 3).join(', ')}.` : 'The item is usable but below the expected strength for this slot.';
    return decision('Replace Soon', craftingPotential.score >= 48 && !item.corrupted ? 'Craft' : undefined, flaw, [`Build fit is ${fitScore}/100.`, `Category score is ${categoryScore}/100.`, flaw], hiddenValueFlags, false);
  }

  if (!liveVerified && (generallyGood || marketable || hiddenValueFlags.length > 0)) {
    return decision('Price Check', hasSpecificBuild && fitScore >= 45 ? 'Use' : 'Keep for Later', 'The item may be useful or valuable, but no live official market price was verified.', [`General quality is ${evaluation.score}/100.`, `Market appeal is ${evaluation.marketability}.`, 'A manual Trade2 comparison is required before listing or discarding it.'], hiddenValueFlags, false);
  }

  const safeToVendor = hiddenValueFlags.length === 0 && evaluation.score < 28 && categoryScore < 28 && (!hasSpecificBuild || fitScore < 20) && craftingPotential.score < 28 && (evaluation.marketability === 'low' || (evaluation.score < 15 && categoryScore < 15));
  if (safeToVendor) return decision('Vendor', undefined, 'Quality, build fit, market appeal, and crafting potential are all very low.', [`General quality is ${evaluation.score}/100.`, `Category score is ${categoryScore}/100.`, `Crafting potential is ${craftingPotential.score}/100.`, 'No build-enabling or hidden-value signal was detected.'], hiddenValueFlags, true);

  if ((!hasSpecificBuild || fitScore < 30) && (evaluation.score >= 35 || categoryScore >= 40 || evaluation.marketability === 'niche')) {
    return decision('Keep for Later', liveVerified ? 'Sell' : (craftingPotential.score >= 50 ? 'Craft' : undefined), hasSpecificBuild ? 'It does not fit the selected build, but it can still serve another build or progression stage.' : 'Without a selected build, the item retains some general progression value.', [`General quality is ${evaluation.score}/100.`, `Category score is ${categoryScore}/100.`], hiddenValueFlags, false);
  }

  return decision('Keep for Later', liveVerified && marketable ? 'Sell' : 'Price Check', 'The evidence is not strong enough to vendor this item safely.', [`General quality is ${evaluation.score}/100.`, `Category score is ${categoryScore}/100.`, 'The conservative fallback preserves items with uncertain use or value.'], hiddenValueFlags, false);
}

function decision(action: ItemAction, secondaryAction: ItemAction | undefined, shortReason: string, reasons: string[], hiddenValueFlags: string[], safeToVendor: boolean): RuleDecision {
  return { action, secondaryAction, shortReason: shortReason || itemActionLabels[action].summary, reasons: unique(reasons), hiddenValueFlags, safeToVendor };
}

function detectHiddenValue(item: ItemStats, evaluation: ItemEvaluation) {
  const text = `${item.rawText || ''}\n${item.customMods.join('\n')}`;
  const flags: string[] = [];
  if (item.rarity === 'unique') flags.push('Unique item may have a build-specific interaction.');
  if (/level of all|level of .* skills|Spirit|additional Projectile|additional Arrow|reservation|gain .* as extra|trigger/i.test(text)) flags.push('Build-enabling modifier detected.');
  if ((evaluation.knowledge?.rolls || []).some((roll) => roll.label === 'perfect' || (roll.tier || 99) <= 2)) flags.push('Top-end or high-tier displayed roll detected.');
  if ((item.itemLevel || 0) >= 82 && (evaluation.categoryAnalysis?.categoryScore || 0) >= 55) flags.push('High-item-level base with a coherent modifier package.');
  if (item.corrupted && /implicit|corrupted/i.test(text)) flags.push('Corruption may add unusual value and needs a dedicated search.');
  if (evaluation.marketability === 'niche' && evaluation.score >= 55) flags.push('Niche stat combination may be valuable to a specialised build.');
  return unique(flags);
}

const unique = <T>(values: T[]) => [...new Set(values)];
function weaponDps(item:ItemStats){const average=(min?:number,max?:number)=>min===undefined||max===undefined?0:(min+max)/2;return(average(item.physicalDamageMin,item.physicalDamageMax)+average(item.fireDamageMin,item.fireDamageMax)+average(item.coldDamageMin,item.coldDamageMax)+average(item.lightningDamageMin,item.lightningDamageMax)+average(item.chaosDamageMin,item.chaosDamageMax))*(item.attacksPerSecond||1);}
function isStrongDisplayedWeapon(category:ItemCategory|undefined,dps:number){if(!category||!['bow','crossbow','one-handed-melee','two-handed-melee','quarterstaff'].includes(category))return false;const threshold=category==='bow'?280:category==='crossbow'||category==='two-handed-melee'?400:275;return dps>=threshold;}
