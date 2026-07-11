import type { ItemAnalysisInput, NormalizedModifier } from './engineContracts.js';
import { craftingCurrencies, findCurrency, type CraftingCurrencyDef } from './craftingCurrencies.js';

export interface CraftGoal { description: string; minimumItemLevel?: number; mandatoryGroups?: string[]; targetStats?: Record<string, number>; buyPrice?: number; currentValue?: number }

export interface CraftingItemState {
  itemClass: string;
  baseType: string;
  itemLevel?: number;
  rarity: 'normal' | 'magic' | 'rare' | 'unique';
  quality: number;
  corrupted: boolean;
  prefixes: NormalizedModifier[];
  suffixes: NormalizedModifier[];
  modifierGroups: string[];
  sockets: string[];
  currencySpent: Array<{ currencyId: string; label: string }>;
  estimatedValue?: number;
  goal?: CraftGoal;
}

export interface ActionEvaluation {
  currencyId: string;
  label: string;
  legal: boolean;
  reasons: string[];
  reversible: false;
  outcomeCertainty: CraftingCurrencyDef['outcomeCertainty'];
  knownChance?: number;
  accumulatedCostCount: number;
  risk: 'low' | 'medium' | 'high' | 'unknown';
  recommendedStop: boolean;
  stopReason?: string;
}

export interface HistoryEntry {
  action: string;
  before: CraftingItemState;
  after: CraftingItemState;
  costSpentSoFar: number;
}

const MAX_AFFIXES = 3;

export function stateFromItem(item: ItemAnalysisInput, goal?: CraftGoal, estimatedValue?: number): CraftingItemState {
  return {
    itemClass: item.itemClass, baseType: item.baseType, itemLevel: item.itemLevel,
    rarity: (item.rarity as CraftingItemState['rarity']) || 'normal', quality: item.quality, corrupted: item.corrupted,
    prefixes: item.prefixes, suffixes: item.suffixes,
    modifierGroups: [...item.prefixes, ...item.suffixes].flatMap((mod) => (mod.group ? [mod.group] : [])),
    sockets: item.sockets, currencySpent: [], estimatedValue, goal,
  };
}

function openSlots(state: CraftingItemState) {
  const knownAffixes = state.prefixes.length + state.suffixes.length;
  const identityKnown = state.prefixes.every((m) => m.group) && state.suffixes.every((m) => m.group);
  return identityKnown ? Math.max(0, MAX_AFFIXES * 2 - state.prefixes.length - state.suffixes.length) : null;
}

function duplicateGroupWarning(state: CraftingItemState): string | null {
  const seen = new Set<string>();
  for (const group of state.modifierGroups) {
    if (seen.has(group)) return `The item already has two modifiers from the "${group}" group, which should not be possible on a legal item.`;
    seen.add(group);
  }
  return null;
}

export function evaluateAction(state: CraftingItemState, currencyId: string): ActionEvaluation {
  const currency = findCurrency(currencyId);
  const accumulatedCostCount = state.currencySpent.length;
  if (!currency) return { currencyId, label: currencyId, legal: false, reasons: [`Unknown currency "${currencyId}".`], reversible: false, outcomeCertainty: 'random-from-pool', accumulatedCostCount, risk: 'unknown', recommendedStop: false };
  const reasons: string[] = [];
  if (state.corrupted) reasons.push('Corrupted items cannot use normal crafting currency.');
  if (state.rarity === 'unique') reasons.push('This action is not supported on Unique items.');
  if (!currency.compatibleRarities.includes(state.rarity as CraftRarityGuard)) reasons.push(`${currency.label} requires a ${currency.compatibleRarities.join(' or ')} item, not ${state.rarity}.`);
  const slots = openSlots(state);
  if (currency.effect === 'add-affix') {
    if (slots === 0) reasons.push('The item has no open affix slot.');
    if (slots === null) reasons.push('Affix availability is unknown; paste Advanced Item Description data before adding a modifier.');
  }
  if (currency.effect === 'remove-affix' && state.prefixes.length + state.suffixes.length === 0) reasons.push('There is no affix to remove.');
  if (state.goal?.minimumItemLevel && (!state.itemLevel || state.itemLevel < state.goal.minimumItemLevel)) reasons.push(`Item Level ${state.itemLevel ?? 'unknown'} does not meet the required ${state.goal.minimumItemLevel}.`);
  const conflict = duplicateGroupWarning(state);
  if (conflict) reasons.push(conflict);
  if (state.goal?.buyPrice !== undefined && state.goal.currentValue !== undefined && state.goal.currentValue >= state.goal.buyPrice) reasons.push('Buying the target outright is no more expensive than the current item value; further investment is not justified.');

  const risk: ActionEvaluation['risk'] = currency.outcomeCertainty === 'guaranteed' ? 'low' : state.rarity === 'rare' && (slots ?? 1) <= 1 ? 'high' : 'medium';
  const recommendedStop = Boolean(state.goal?.buyPrice !== undefined && state.estimatedValue !== undefined && state.estimatedValue >= state.goal.buyPrice);
  return {
    currencyId: currency.id, label: currency.label, legal: reasons.length === 0, reasons,
    reversible: false, outcomeCertainty: currency.outcomeCertainty, knownChance: currency.knownChance,
    accumulatedCostCount, risk, recommendedStop, stopReason: recommendedStop ? 'Buying a ready item now costs the same or less than what has already been invested.' : undefined,
  };
}
type CraftRarityGuard = 'normal' | 'magic' | 'rare';

export function legalActions(state: CraftingItemState): ActionEvaluation[] {
  return craftingCurrencies.map((currency) => evaluateAction(state, currency.id));
}

export function applyAction(state: CraftingItemState, currencyId: string): { state: CraftingItemState; evaluation: ActionEvaluation } {
  const evaluation = evaluateAction(state, currencyId);
  if (!evaluation.legal) return { state, evaluation };
  const currency = findCurrency(currencyId)!;
  const next: CraftingItemState = { ...state, prefixes: [...state.prefixes], suffixes: [...state.suffixes], modifierGroups: [...state.modifierGroups], currencySpent: [...state.currencySpent, { currencyId: currency.id, label: currency.label }] };
  if (currency.effect === 'upgrade-rarity-magic') next.rarity = 'magic';
  if (currency.effect === 'upgrade-rarity-rare') next.rarity = 'rare';
  if (currency.effect === 'add-affix') {
    const placeholder: NormalizedModifier = { id: `unknown:${next.currencySpent.length}`, text: '(newly added affix — specific modifier unknown without an authoritative mod pool)', type: 'unknown', tags: [], local: false, confidence: 'Low', crafted: true, desecrated: false, source: 'crafting-simulation' };
    if (next.prefixes.length <= next.suffixes.length) next.prefixes.push(placeholder); else next.suffixes.push(placeholder);
  }
  if (currency.effect === 'remove-affix') {
    if (next.suffixes.length > next.prefixes.length) next.suffixes.pop(); else if (next.prefixes.length) next.prefixes.pop(); else next.suffixes.pop();
  }
  return { state: next, evaluation };
}

export interface ComparisonResult { recommendation: 'continue' | 'sell' | 'buy-instead' | 'unknown'; reason: string }

export function compareContinueSellBuy(state: CraftingItemState, options: { sellValue?: number; buyPrice?: number } = {}): ComparisonResult {
  const { sellValue, buyPrice } = options;
  if (buyPrice === undefined) return { recommendation: 'unknown', reason: 'No verified market price for a ready-made equivalent was provided, so buy-vs-craft cannot be compared.' };
  if (sellValue !== undefined && sellValue >= buyPrice) return { recommendation: 'sell', reason: `Selling the current state (~${sellValue}) covers the ${buyPrice} cost of a ready item; further crafting risk is not justified.` };
  if (state.estimatedValue !== undefined && state.estimatedValue >= buyPrice) return { recommendation: 'buy-instead', reason: `A ready-made item (~${buyPrice}) is no more expensive than the value already invested (~${state.estimatedValue}); stop crafting.` };
  return { recommendation: 'continue', reason: 'Neither selling the current state nor buying a ready item is clearly cheaper yet, based on the available price evidence.' };
}

export class CraftingStateMachine {
  private history: HistoryEntry[] = [];
  private pointer = 0;
  private states: CraftingItemState[];

  constructor(initial: CraftingItemState) { this.states = [initial]; }

  get current(): CraftingItemState { return this.states[this.pointer]; }
  get log(): HistoryEntry[] { return this.history; }

  legalActions(): ActionEvaluation[] { return legalActions(this.current); }

  apply(currencyId: string): { evaluation: ActionEvaluation; state: CraftingItemState } {
    const { state: next, evaluation } = applyAction(this.current, currencyId);
    if (evaluation.legal) {
      this.states = [...this.states.slice(0, this.pointer + 1), next];
      this.pointer += 1;
      this.history.push({ action: evaluation.label, before: this.states[this.pointer - 1], after: next, costSpentSoFar: next.currencySpent.length });
    }
    return { evaluation, state: this.current };
  }

  canUndo(): boolean { return this.pointer > 0; }
  undo(): CraftingItemState {
    if (this.canUndo()) this.pointer -= 1;
    return this.current;
  }

  compare(options: { sellValue?: number; buyPrice?: number } = {}): ComparisonResult { return compareContinueSellBuy(this.current, options); }
}
