export type EvidenceConfidence = "High" | "Medium" | "Low";
export type DamageType = "physical" | "fire" | "cold" | "lightning" | "chaos";
export type BuildStage = "campaign" | "early-maps" | "established" | "transition" | "endgame" | "aspirational";

export interface SourceEvidence {
  label: string;
  url: string;
  patch: string;
  dataVersion: string;
  confidence: EvidenceConfidence;
  inspectedAt: string;
  limitation?: string;
}

export interface ConversionRule {
  from: DamageType;
  to: DamageType;
  percent: number;
  kind: "convert" | "gain-as-extra";
  scope: "skill-inherent" | "external";
}

export interface ProjectilePolicy {
  mode: "single" | "simultaneous" | "sequential" | "unknown";
  sameTarget: "one" | "all" | "interval-limited" | "unknown";
  intervalSeconds?: number;
  secondaryGeometryKnown: boolean;
  clearCoverageOnlyProjectiles: boolean;
}

export interface SkillComponent {
  id: string;
  label: string;
  kind: "attack-hit" | "spell-hit" | "ailment" | "secondary";
  damageTypes: DamageType[];
  attackDamagePercent?: number;
  baseDamage?: Partial<Record<DamageType, { min: number; max: number }>>;
  knownSingleTargetHits: number | null;
  limitation?: string;
}

export interface SkillMechanicProfile {
  id: string;
  name: string;
  patch: string;
  dataVersion: string;
  source: string;
  confidence: EvidenceConfidence;
  limitations: string[];
  level: number;
  tags: string[];
  weaponRequirements: string[];
  use: { kind: "attack" | "spell" | "ammunition"; multiplier: number; baseSeconds?: number };
  cost: { resource: "mana" | "life" | "energy-shield"; amount: number; paid: "use" | "reload" };
  reload?: { baseSecondsFromWeapon: true; bolts: number; speedMultiplier: number };
  components: SkillComponent[];
  conversions: ConversionRule[];
  projectilePolicy: ProjectilePolicy;
  sources: SourceEvidence[];
}

export interface RotationScenario {
  contentTarget: "mapping" | "bossing" | "unknown";
  targetRarity: "normal" | "magic" | "rare" | "unique" | "unknown";
  durationSeconds: number;
  movementShare: number;
  targetResistance?: Partial<Record<DamageType, number>>;
  manaRecoveryPerSecond?: number;
  hitChance?: number;
  increasedDamagePercent?: number;
  moreDamageMultipliers?: number[];
  criticalChance?: number;
  criticalDamageBonus?: number;
  reloadSpeedPercent?: number;
  ammunitionPreservationChance?: number;
}

export interface BreakpointFailure {
  code: string;
  message: string;
  required?: number;
  available?: number;
  severity: "blocking" | "warning";
}

export interface MechanicCoverage {
  status: "complete" | "partial" | "unknown";
  covered: string[];
  missing: string[];
  ignored: string[];
  exactDpsAvailable: boolean;
  reason: string;
}

export interface OffenceResult {
  skillId: string | null;
  skillName: string;
  patch: string;
  patchCompatibility: "exact" | "unsupported" | "unknown";
  ailmentDps: number | null;
  burstDps: number | null;
  sustainedDps: number | null;
  clearCoverage: "single-target" | "multi-target" | "unknown";
  resourceBalance: { costPerSecond: number | null; recoveryPerSecond: number | null; sustainable: boolean | null };
  mechanicCoverage: MechanicCoverage;
  breakpointFailures: BreakpointFailure[];
  assumptions: string[];
  missingInputs: string[];
  sourceEvidence: SourceEvidence[];
  confidence: EvidenceConfidence;
}

export interface ReservationPlan {
  availableSpirit: number | null;
  reservedSpirit: number | null;
  weaponSet: 1 | 2;
  activeSkills: Array<{ id: string; reservation: number | null }>;
}

export interface DefensiveScenario {
  incomingHit: number;
  damageType: DamageType;
  armourAppliesPercent: number;
}
