import type { ItemStats } from "./types.js";
import type { DamageType, OffenceResult, RotationScenario, SkillMechanicProfile } from "./offenceTypes.js";

const damageTypes: DamageType[] = ["physical", "fire", "cold", "lightning", "chaos"];
const average = (min?: number, max?: number) => min === undefined || max === undefined ? 0 : (min + max) / 2;

export function evaluateOffence(profile: SkillMechanicProfile | undefined, weapon: ItemStats, scenario: RotationScenario, requestedPatch = "0.5.x"): OffenceResult {
  if (!profile) return unknownResult("No compatible versioned skill profile is active.", requestedPatch);
  const exactPatch = requestedPatch === profile.patch || (requestedPatch.startsWith("0.5") && profile.patch === "0.5.x");
  if (!exactPatch) return { ...unknownResult(`Skill profile ${profile.patch} does not support ${requestedPatch}.`, requestedPatch), skillId: profile.id, skillName: profile.name, patchCompatibility: "unsupported", sourceEvidence: profile.sources };

  const missing: string[] = [];
  const assumptions: string[] = [`Damage and cost figures assume a level ${profile.level} skill gem; a lower-level (e.g. leveling-stage) gem would deal less damage and may cost less resource than shown.`];
  const ignored = profile.components.filter((component) => component.knownSingleTargetHits === null).map((component) => component.label);
  const attack = profile.use.kind !== "spell";
  if (profile.weaponRequirements.length && !profile.weaponRequirements.some((required) => `${weapon.itemType} ${weapon.itemClass}`.toLowerCase().includes(required))) missing.push(`compatible ${profile.weaponRequirements.join("/")} weapon`);
  const base: Record<DamageType, number> = {
    physical: average(weapon.physicalDamageMin, weapon.physicalDamageMax), fire: average(weapon.fireDamageMin, weapon.fireDamageMax),
    cold: average(weapon.coldDamageMin, weapon.coldDamageMax), lightning: average(weapon.lightningDamageMin, weapon.lightningDamageMax), chaos: average(weapon.chaosDamageMin, weapon.chaosDamageMax),
  };
  if (attack && damageTypes.every((type) => base[type] === 0)) missing.push("displayed local weapon damage");
  if (attack && !weapon.attacksPerSecond) missing.push("weapon attacks per second");
  if (scenario.hitChance === undefined && attack) missing.push("hit chance against the selected target");
  if (scenario.targetRarity === "unknown") missing.push("target rarity");

  const componentValues: number[] = [];
  for (const component of profile.components) {
    if (component.knownSingleTargetHits === null) continue;
    if (component.kind === "attack-hit" && component.attackDamagePercent === undefined) {
      missing.push(`${component.label} attack-damage effectiveness`);
      continue;
    }
    let values: Record<DamageType, number> = { ...base };
    if (component.baseDamage) for (const type of damageTypes) values[type] = component.baseDamage[type] ? average(component.baseDamage[type]!.min, component.baseDamage[type]!.max) : 0;
    if (component.attackDamagePercent) for (const type of damageTypes) values[type] *= component.attackDamagePercent / 100;
    values = applyConversions(values, profile.conversions);
    let total = damageTypes.reduce((sum, type) => sum + values[type], 0);
    total *= 1 + (scenario.increasedDamagePercent || 0) / 100;
    for (const more of scenario.moreDamageMultipliers || []) total *= more;
    if (attack) total *= scenario.hitChance ?? 1;
    const critChance = scenario.criticalChance;
    if (critChance !== undefined) total *= 1 + Math.max(0, Math.min(1, critChance)) * ((scenario.criticalDamageBonus ?? 100) / 100);
    else assumptions.push("Critical expectation is excluded because critical chance was not supplied.");
    componentValues.push(total * component.knownSingleTargetHits);
  }

  const damagePerUse = componentValues.length ? componentValues.reduce((a, b) => a + b, 0) : null;
  let usesPerSecond: number | null = null;
  let resourceCostPerSecond: number | null = null;
  if (profile.use.kind === "spell") usesPerSecond = profile.use.baseSeconds ? 1 / profile.use.baseSeconds : null;
  else if (profile.use.kind === "attack") usesPerSecond = weapon.attacksPerSecond ? weapon.attacksPerSecond * profile.use.multiplier : null;
  else if (profile.reload) {
    const reload = readReloadSeconds(weapon);
    if (reload === null) missing.push("crossbow reload time");
    else {
      const reloadSpeed = Math.max(0.01, 1 + (scenario.reloadSpeedPercent || 0) / 100);
      const effectiveReload = reload / reloadSpeed / profile.reload.speedMultiplier;
      const preservation = Math.max(0, Math.min(0.95, scenario.ammunitionPreservationChance || 0));
      const expectedBolts = profile.reload.bolts / (1 - preservation);
      const fireTime = weapon.attacksPerSecond ? expectedBolts / weapon.attacksPerSecond : 0;
      usesPerSecond = expectedBolts / (effectiveReload + fireTime);
      resourceCostPerSecond = profile.cost.amount / (effectiveReload + fireTime);
    }
  }
  if (resourceCostPerSecond === null && usesPerSecond !== null) resourceCostPerSecond = profile.cost.amount * usesPerSecond;
  const movementUptime = Math.max(0, Math.min(1, 1 - scenario.movementShare));
  const sustained = damagePerUse !== null && usesPerSecond !== null ? damagePerUse * usesPerSecond * movementUptime : null;
  if (scenario.movementShare > 0) assumptions.push(`Sustained output uses ${(movementUptime * 100).toFixed(0)}% attacking/casting uptime.`);
  const sustainable = resourceCostPerSecond !== null && scenario.manaRecoveryPerSecond !== undefined ? scenario.manaRecoveryPerSecond >= resourceCostPerSecond : null;
  if (scenario.manaRecoveryPerSecond === undefined) missing.push("resource recovery per second");
  if (ignored.length) missing.push("verified secondary-hit geometry");
  const exact = missing.length === 0 && ignored.length === 0 && sustained !== null;
  return {
    skillId: profile.id, skillName: profile.name, patch: profile.patch, patchCompatibility: "exact",
    ailmentDps: null, burstDps: exact ? round(damagePerUse! * usesPerSecond!) : null, sustainedDps: exact ? round(sustained) : null,
    clearCoverage: profile.projectilePolicy.clearCoverageOnlyProjectiles || profile.components.length > 1 ? "multi-target" : "single-target",
    resourceBalance: { costPerSecond: resourceCostPerSecond === null ? null : round(resourceCostPerSecond), recoveryPerSecond: scenario.manaRecoveryPerSecond ?? null, sustainable },
    mechanicCoverage: { status: exact ? "complete" : "partial", covered: ["skill profile", "conversion order", "primary hit", ...(profile.reload ? ["reload cycle"] : [])], missing: [...new Set(missing)], ignored, exactDpsAvailable: exact, reason: exact ? "All material inputs for the selected scenario are present." : "Exact DPS is withheld because material inputs or geometry are missing." },
    breakpointFailures: sustainable === false ? [{ code: "resource.unsustainable", message: "Resource recovery is below the calculated skill cost rate.", required: resourceCostPerSecond!, available: scenario.manaRecoveryPerSecond!, severity: "blocking" }] : [],
    assumptions: [...new Set(assumptions)], missingInputs: [...new Set(missing)], sourceEvidence: profile.sources, confidence: exact ? profile.confidence : "Low",
  };
}

export function applyConversions(input: Record<DamageType, number>, rules: SkillMechanicProfile["conversions"]) {
  const result = { ...input };
  for (const scope of ["skill-inherent", "external"] as const) {
    const scopedConvert = rules.filter((rule) => rule.scope === scope && rule.kind === "convert");
    for (const from of damageTypes) {
      const matching = scopedConvert.filter((rule) => rule.from === from && rule.to !== from);
      const total = matching.reduce((sum, rule) => sum + rule.percent, 0);
      if (!total) continue;
      const available = result[from];
      for (const rule of matching) result[rule.to] += available * (rule.percent / Math.max(100, total));
      result[from] = total >= 100 ? 0 : available * (1 - total / 100);
    }
    // "gain as extra" reads the pool as it stands after this scope's conversions, not the
    // pre-conversion pool — by the time an external-scope gain applies, any skill-inherent
    // conversion has already consumed part of the source damage type.
    for (const rule of rules.filter((entry) => entry.scope === scope && entry.kind === "gain-as-extra")) {
      result[rule.to] += result[rule.from] * rule.percent / 100;
    }
  }
  return result;
}

function readReloadSeconds(item: ItemStats) {
  const explicit = (item as ItemStats & { reloadTime?: number }).reloadTime;
  if (explicit && explicit > 0) return explicit;
  const match = `${item.rawText || ""}\n${(item.customMods || []).join("\n")}`.match(/Reload Time:\s*([\d.]+)/i);
  return match ? Number(match[1]) : null;
}
const round = (value: number) => Math.round(value * 100) / 100;
function unknownResult(reason: string, patch: string): OffenceResult {
  return { skillId: null, skillName: "Unknown", patch, patchCompatibility: "unknown", ailmentDps: null, burstDps: null, sustainedDps: null, clearCoverage: "unknown", resourceBalance: { costPerSecond: null, recoveryPerSecond: null, sustainable: null }, mechanicCoverage: { status: "unknown", covered: [], missing: ["versioned skill profile"], ignored: [], exactDpsAvailable: false, reason }, breakpointFailures: [], assumptions: [], missingInputs: ["versioned skill profile"], sourceEvidence: [], confidence: "Low" };
}
