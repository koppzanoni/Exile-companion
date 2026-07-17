import type { EvidenceConfidence, SourceEvidence } from "./offenceTypes.js";

export type CombatActor = "player" | "minion" | "companion" | "tamed-beast" | "totem" | "clone-illusion" | "granted-ascendancy-effect" | "enemy-target-state";
export interface ScopedModifier { stat: string; value: number; appliesTo?: CombatActor[]; explicitText: string; sourceActor?:CombatActor; statDomain?:string; condition?:string; patch?:string; evidence?:SourceEvidence[]; confidence?:EvidenceConfidence; limitations?:string[] }

/** Player modifiers never leak to another actor unless the parsed text explicitly scoped them. */
export function modifiersForActor(modifiers: ScopedModifier[], actor: CombatActor) {
  return modifiers.filter((modifier) => actor === "player" ? !modifier.appliesTo || modifier.appliesTo.includes("player") : modifier.appliesTo?.includes(actor));
}

export function evaluateActorScope(modifiers:ScopedModifier[],actor:CombatActor){
  const applied=modifiersForActor(modifiers,actor);
  // "Unknown for actor X" must be scoped to X the same way `applied` is: either the modifier has
  // no scope information at all (ambiguous for every actor equally), or it could plausibly apply
  // to X specifically but with low confidence. A modifier low-confidence-scoped to an unrelated
  // actor (e.g. "totem") must not count as unknown coverage for player/minion/companion/etc.
  const unknown=modifiers.filter((modifier)=>{
    if(modifier.appliesTo?.length===0)return true;
    const mayApplyToActor=actor==="player"?!modifier.appliesTo||modifier.appliesTo.includes("player"):Boolean(modifier.appliesTo?.includes(actor));
    return mayApplyToActor&&modifier.confidence==="Low";
  });
  return{actor,applied,ignored:modifiers.filter((modifier)=>!applied.includes(modifier)&&!unknown.includes(modifier)),unknown,coverage:unknown.length?"partial" as const:"complete" as const};
}

export interface RosterCoverage { availableSpirit: number | null; reservedSpirit: number | null; activeCount: number | null; companionLimit: number | null }
export function validateRoster(coverage: RosterCoverage) {
  const missing = Object.entries(coverage).filter(([, value]) => value === null).map(([key]) => key);
  const spiritValid = coverage.availableSpirit === null || coverage.reservedSpirit === null ? null : coverage.reservedSpirit <= coverage.availableSpirit;
  const countValid = coverage.activeCount === null || coverage.companionLimit === null ? null : coverage.activeCount <= coverage.companionLimit;
  return { valid: spiritValid === false || countValid === false ? false : spiritValid === null || countValid === null ? null : true, missing };
}
