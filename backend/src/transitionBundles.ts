import type { BuildStage } from './offenceTypes.js';

export type TransitionBundleKind =
  | 'crit'
  | 'CoC'
  | 'CI'
  | 'Hollow Palm'
  | 'Hollow unarmed'
  | 'companion roster'
  | 'Spirit Walker'
  | 'reservation package'
  | 'required unique'
  | 'weapon-set package';
export interface TransitionBundle {
  kind: TransitionBundleKind;
  stage: BuildStage;
  requiredSignals: string[];
  presentSignals: string[];
}
export interface TransitionBundleResult {
  complete: boolean;
  missingSignals: string[];
  recommendationAllowed: boolean;
  reason: string;
}

/** Evaluates only caller-declared requirements; it never guesses a build package from popularity. */
export function evaluateTransitionBundle(bundle: TransitionBundle): TransitionBundleResult {
  const present = new Set(bundle.presentSignals.map((value) => value.trim().toLowerCase()));
  const missingSignals = bundle.requiredSignals.filter((value) => !present.has(value.trim().toLowerCase()));
  const complete = missingSignals.length === 0;
  return {
    complete,
    missingSignals,
    recommendationAllowed: complete,
    reason: complete
      ? 'All explicitly required transition signals are present.'
      : `Final-build item is withheld until the declared ${bundle.kind} package is complete.`,
  };
}

export function evaluateHollowUnarmedTransition(input: {
  hollow: boolean;
  unarmed: boolean;
  compatibleGloves: boolean;
  transformedGloves: boolean;
  attributesMet: boolean;
  resistancesMet: boolean;
  defencesMet: boolean;
  skillCompatible: boolean;
  comboConfigured: boolean;
  weaponSetCompatible: boolean;
  runesKnown: boolean;
}) {
  const required: Record<string, boolean> = {
    'Hollow state': input.hollow,
    'unarmed state': input.unarmed,
    'compatible gloves': input.compatibleGloves,
    'transformed gloves': input.transformedGloves,
    'attribute requirements': input.attributesMet,
    'resistance requirements': input.resistancesMet,
    'defensive floor': input.defencesMet,
    'skill compatibility': input.skillCompatible,
    'Combo configuration': input.comboConfigured,
    'weapon-set compatibility': input.weaponSetCompatible,
    'known body runes': input.runesKnown,
  };
  return evaluateTransitionBundle({
    kind: 'Hollow unarmed',
    stage: 'transition',
    requiredSignals: Object.keys(required),
    presentSignals: Object.entries(required)
      .filter(([, present]) => present)
      .map(([signal]) => signal),
  });
}
