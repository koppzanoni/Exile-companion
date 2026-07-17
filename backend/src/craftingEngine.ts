import type { CraftingEngine, CraftState, ItemAnalysisInput } from './engineContracts.js';
import { craftingCurrencies } from './craftingCurrencies.js';
import {
  compareContinueSellBuy,
  evaluateAction,
  legalActions,
  MAX_AFFIXES_PER_TYPE,
  stateFromItem,
  type ActionEvaluation,
  type CraftGoal,
  type CraftingItemState,
} from './craftingStateMachine.js';

export type { CraftGoal } from './craftingStateMachine.js';

export class Poe2CraftingEngine implements CraftingEngine {
  inspect(item: ItemAnalysisInput): CraftState {
    const known = item.unknownModifiers.length === 0;
    const prefixCount = item.prefixes.length;
    const suffixCount = item.suffixes.length;
    const rarityCap =
      MAX_AFFIXES_PER_TYPE[item.rarity as keyof typeof MAX_AFFIXES_PER_TYPE] ?? MAX_AFFIXES_PER_TYPE.normal;
    const state: CraftState = {
      item,
      openPrefixes: known ? Math.max(0, rarityCap - prefixCount) : null,
      openSuffixes: known ? Math.max(0, rarityCap - suffixCount) : null,
      modifierGroups: [...item.prefixes, ...item.suffixes].flatMap((mod) => (mod.group ? [mod.group] : [])),
      availableActions: [],
      blockedActions: [],
    };
    for (const evaluation of legalActions(stateFromItem(item))) {
      if (evaluation.legal) state.availableActions.push(evaluation.label);
      else state.blockedActions.push({ action: evaluation.label, reason: evaluation.reasons.join(' ') });
    }
    return state;
  }

  async plan(state: CraftState, goal: unknown) {
    const target = goal as CraftGoal;
    const craftState = stateFromItem(state.item, target, target.currentValue);
    const tiers: Array<{ budget: string; currencyIds: string[] }> = [
      { budget: 'cheap', currencyIds: ['orb-of-augmentation', 'orb-of-alchemy', 'regal-orb'] },
      { budget: 'intermediate', currencyIds: ['exalted-orb', 'chaos-orb'] },
      { budget: 'expensive', currencyIds: ['orb-of-annulment', 'divine-orb'] },
    ];
    const routes = tiers.map(({ budget, currencyIds }) => routeFor(craftState, currencyIds, budget));
    const comparison = compareContinueSellBuy(craftState, {
      buyPrice: target.buyPrice,
      sellValue: target.currentValue,
    });
    const stopConditions = [
      'Stop when the current item satisfies every mandatory target.',
      'Stop when the next action costs more than buying a verified comparable item.',
      'Stop when a mandatory modifier is lost.',
      'Stop before an expensive action when success probability is unknown and the current item is usable.',
    ];
    return {
      state,
      goal: target,
      status: routes.some((route) => route.steps.length) ? 'planned' : 'blocked',
      prerequisites: [
        `Correct ${state.item.itemClass || 'item'} base`,
        target.minimumItemLevel
          ? `Item Level ${target.minimumItemLevel}+`
          : 'Verify the item level required by target modifiers',
        'Advanced Item Description data to prove affix space and modifier groups',
      ],
      routes,
      stopConditions,
      comparison,
      warning: routes.some((route) => route.unknownProbability)
        ? 'At least one probability is unknown; no numeric success chance was invented.'
        : undefined,
    };
  }
}

function outcomesFor(currencyId: string): string[] {
  const currency = craftingCurrencies.find((c) => c.id === currencyId);
  if (!currency) return [];
  switch (currency.effect) {
    case 'upgrade-rarity-magic':
      return ['Changes rarity to Magic'];
    case 'upgrade-rarity-rare':
      return ['Changes rarity to Rare and adds one random affix'];
    case 'upgrade-rarity-rare-direct':
      return ['Changes rarity directly to Rare and adds four random affixes'];
    case 'add-affix':
      return ['Adds one random affix from an unknown pool'];
    case 'remove-affix':
      return ['Removes one random existing affix'];
    case 'remove-and-add-affix':
      return ['Removes one random existing affix and adds one new random affix in its place'];
    case 'reroll-numeric':
      return ['Rerolls the numeric values of existing modifiers'];
    case 'corrupt':
      return [
        'Corrupts the item, permanently blocking further currency use. The specific outcome cannot be predicted: it may leave the item otherwise unchanged, reroll it as a new random item of the same rarity, add a corruption-only modifier, or in rare cases destroy the item entirely. This tool never recommends corrupting an item automatically.',
      ];
    default:
      return [];
  }
}

function routeFor(state: CraftingItemState, currencyIds: string[], budget: string) {
  const evaluations: ActionEvaluation[] = currencyIds.map((id) => evaluateAction(state, id));
  const steps = evaluations
    .filter((e) => e.legal)
    .map((e) => ({
      action: e.label,
      preconditions: [],
      outcomes: outcomesFor(e.currencyId),
      probability: e.knownChance !== undefined ? `mechanic guaranteed (specific roll unknown)` : 'unknown',
      risk: e.risk,
    }));
  const blocked = evaluations.filter((e) => !e.legal).map((e) => ({ action: e.label, reasons: e.reasons }));
  return { budget, steps, blocked, unknownProbability: steps.some((step) => step.probability === 'unknown') };
}
