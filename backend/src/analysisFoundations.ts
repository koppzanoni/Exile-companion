import type { AppDatabase } from './db.js';
import { evaluateActorScope, type ScopedModifier } from './actorStatScope.js';
import { evaluateHollowUnarmedTransition } from './transitionBundles.js';
import {
  evaluateIdolatry,
  evaluateSpiritFeasibility,
  IDOLATRY_RESISTANCE_PENALTY_PER_AUGMENT,
  martialArtistMechanics,
  spiritWalkerMechanics,
  type SpiritFeasibilityInput,
} from './ascendancyMechanics.js';
import { loadActiveRosterCatalog, rosterCompatibility } from './rosterCatalog.js';

export interface AnalysisFoundationInput {
  className?: string;
  ascendancy?: string;
  patch?: string;
  scopedModifiers?: ScopedModifier[];
  spirit?: SpiritFeasibilityInput;
  nonIdolAugments?: number | null;
  hollow?: Parameters<typeof evaluateHollowUnarmedTransition>[0];
}
export function evaluateAnalysisFoundations(db: AppDatabase, input: AnalysisFoundationInput) {
  const loaded = loadActiveRosterCatalog(db);
  const compatibility = rosterCompatibility(loaded.catalog, input.className, input.ascendancy, input.patch);
  const actorScopeCoverage = {
    player: evaluateActorScope(input.scopedModifiers ?? [], 'player'),
    minion: evaluateActorScope(input.scopedModifiers ?? [], 'minion'),
    companion: evaluateActorScope(input.scopedModifiers ?? [], 'companion'),
    tamedBeast: evaluateActorScope(input.scopedModifiers ?? [], 'tamed-beast'),
    totem: evaluateActorScope(input.scopedModifiers ?? [], 'totem'),
  };
  const spiritFeasibility = input.spirit
    ? evaluateSpiritFeasibility(input.spirit)
    : {
        availableSpirit: null,
        reservedSpirit: null,
        remainingSpirit: null,
        activeRoster: [],
        disabledSkills: [],
        disabledCompanions: [],
        invalidRequirements: [],
        weaponSet: null,
        assumptions: [],
        missingInputs: ['Spirit plan and active weapon set'],
        sourceEvidence: [],
        confidence: 'Low' as const,
        exactFeasibilityAvailable: false,
        valid: null,
      };
  const ascendancyMechanicCoverage =
    input.ascendancy === 'Spirit Walker'
      ? spiritWalkerMechanics
      : input.ascendancy === 'Martial Artist'
        ? martialArtistMechanics
        : [];
  // An empty coverage array is otherwise indistinguishable from "verified, nothing to report" —
  // this flag makes "no dedicated mechanics package exists yet for this ascendancy" explicit.
  const ascendancyMechanicModeled = input.ascendancy === 'Spirit Walker' || input.ascendancy === 'Martial Artist';
  const idolatry =
    input.ascendancy === 'Spirit Walker'
      ? evaluateIdolatry({
          nonIdolAugments: input.nonIdolAugments ?? null,
          resistancePenaltyPerAugment: IDOLATRY_RESISTANCE_PENALTY_PER_AUGMENT,
        })
      : null;
  const transitionBundle =
    input.ascendancy === 'Martial Artist' && input.hollow ? evaluateHollowUnarmedTransition(input.hollow) : null;
  const criticalRegressions = [...spiritFeasibility.invalidRequirements];
  if (transitionBundle && !transitionBundle.complete) criticalRegressions.push(transitionBundle.reason);
  return {
    rosterCompatibility: {
      ...compatibility,
      catalogPatch: loaded.catalog.patch,
      dataVersion: loaded.catalog.dataVersion,
      status: loaded.status,
      checksum: loaded.checksum,
      source: loaded.catalog.source,
      confidence: loaded.catalog.confidence,
      limitations: loaded.catalog.limitations,
    },
    actorScopeCoverage,
    spiritFeasibility,
    ascendancyMechanicCoverage,
    ascendancyMechanicModeled,
    idolatry,
    transitionBundle,
    criticalRegressions,
    assumptions: spiritFeasibility.assumptions,
    missingInputs: [...spiritFeasibility.missingInputs, ...(idolatry?.missingInputs ?? [])],
    sourceEvidence: [
      ...spiritFeasibility.sourceEvidence,
      ...ascendancyMechanicCoverage.flatMap((entry) => entry.sourceEvidence),
      ...(idolatry?.sourceEvidence ?? []),
    ],
  };
}
