import {
  AlertTriangle,
  Check,
  Cloud,
  Coins,
  Eraser,
  ExternalLink,
  HeartPulse,
  History,
  Import,
  LoaderCircle,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Target,
  TestTube2,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import { GeminiCoach } from "../components/GeminiCoach";
import { UpgradeCandidatePlanner } from "../components/UpgradeCandidatePlanner";
import {
  parseEquipmentBundle,
  type EquipmentImportPreview,
} from "../equipmentImport";
import type {
  BuildDoctorResult,
  BuildFitProfile,
  BuildSwapSimulation,
  CharacterActionPlan,
  CharacterSummary,
  EquipmentSlotInput,
  PoeOAuthStatus,
  ReconciliationResult,
} from "../types";
import { useI18n } from "../i18n";

const slotNames = [
  "Weapon",
  "Offhand",
  "Helmet",
  "Body Armour",
  "Gloves",
  "Boots",
  "Belt",
  "Amulet",
  "Ring 1",
  "Ring 2",
];
const blankEquipment: EquipmentSlotInput[] = slotNames.map((slot) => ({
  slot,
  itemText: "",
}));
function snapshotDiagnosis(
  row: Record<string, unknown>,
): BuildDoctorResult | null {
  try {
    return typeof row.diagnosisJson === "string"
      ? (JSON.parse(row.diagnosisJson) as BuildDoctorResult)
      : null;
  } catch {
    return null;
  }
}

export function BuildDoctorPage() {
  const { t, locale } = useI18n();
  const text = (english: string, portuguese: string) =>
    locale === "pt-BR" ? portuguese : english;
  const diagnosticText = (entry: {
    code?: string;
    params?: Record<string, string | number>;
    original?: string;
    message?: string;
  }) => {
    const p = entry.params || {};
    if (locale !== "pt-BR") return entry.original || entry.message || "";
    switch (entry.code) {
      case "equipment.empty":
        return "Nenhum equipamento foi informado; o diagnóstico representa um personagem vazio.";
      case "spirit.target_unknown":
        return "A demanda de Spirit é desconhecida porque a build não possui um alvo de Spirit configurado.";
      case "budget.relative_only":
        return "O orçamento sugerido é uma prioridade relativa, não um preço, pois não há um modelo verificado de custos de mercado ou crafting.";
      case "swap.attribute_dependency":
        return `Não substitua ${p.slot} antes de recuperar ${p.gap} de ${p.attribute}; outro item exige ${p.required} e restariam apenas ${p.remaining}.`;
      case "swap.resistance_dependency":
        return `Não substitua ${p.slot} antes de recuperar ${p.missing}% de ${p.resistance}; restariam ${p.remaining}%, abaixo do limite de ${p.cap}%.`;
      default:
        return entry.original || entry.message || "";
    }
  };
  const [equipment, setEquipment] =
    useState<EquipmentSlotInput[]>(blankEquipment);
  const [buildProfiles, setBuildProfiles] = useState<BuildFitProfile[]>([]);
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [loadedCharacter, setLoadedCharacter] =
    useState<CharacterSummary | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [poe, setPoe] = useState<PoeOAuthStatus | null>(null);
  const [reconciliation, setReconciliation] =
    useState<ReconciliationResult | null>(null);
  const [bulkText, setBulkText] = useState("");
  const [bulkPreview, setBulkPreview] = useState<EquipmentImportPreview | null>(
    null,
  );
  const [roadmaps, setRoadmaps] = useState<
    Array<{ label: string; plan: CharacterActionPlan }>
  >([]);
  const [syncApplied, setSyncApplied] = useState<
    ReconciliationResult["differences"]
  >([]);
  const [snapshots, setSnapshots] = useState<Array<Record<string, unknown>>>(
    [],
  );
  const [roadmapToSave, setRoadmapToSave] = useState<{
    label: string;
    plan: CharacterActionPlan;
  } | null>(null);
  const [savedRoadmap, setSavedRoadmap] = useState("");
  const [selectedBuildProfileId, setSelectedBuildProfileId] =
    useState("generic-build-fit");
  const [result, setResult] = useState<BuildDoctorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeSlot, setActiveSlot] = useState("");
  const [candidateItemText, setCandidateItemText] = useState("");
  const [tolerance, setTolerance] = useState(100);
  const [simulation, setSimulation] = useState<BuildSwapSimulation | null>(
    null,
  );
  const [toolLoading, setToolLoading] = useState(false);

  useEffect(() => {
    api
      .buildProfiles()
      .then((response) => setBuildProfiles(response?.profiles || []))
      .catch(() => {});
    api
      .characters()
      .then((response) => setCharacters(response?.characters || []))
      .catch(() => {});
    api
      .poeOAuthStatus()
      .then(setPoe)
      .catch(() => {});
  }, []);

  function setSlotText(slot: string, itemText: string) {
    setEquipment((old) =>
      old.map((entry) =>
        entry.slot === slot ? { ...entry, itemText } : entry,
      ),
    );
  }

  async function loadRoadmaps(character: CharacterSummary) {
    const maximum = Math.max(0, character.budget || 0);
    const tiers = [
      { label: "Economy", budget: Math.round(maximum * 0.25 * 100) / 100 },
      { label: "Balanced", budget: Math.round(maximum * 0.6 * 100) / 100 },
      { label: "Goal", budget: maximum },
    ];
    try {
      setRoadmaps(
        await Promise.all(
          tiers.map(async (tier) => ({
            label: tier.label,
            plan: await api.characterActionPlan(character.id, tier.budget),
          })),
        ),
      );
    } catch {
      setRoadmaps([]);
    }
  }
  async function loadSnapshots(characterId: number) {
    try {
      setSnapshots((await api.characterSnapshots(characterId)).snapshots || []);
    } catch {
      setSnapshots([]);
    }
  }
  async function saveRoadmap() {
    if (!loadedCharacter || !roadmapToSave) return;
    setImportLoading(true);
    setError("");
    try {
      await api.persistCharacterActionPlan(
        loadedCharacter.id,
        roadmapToSave.plan.purchases,
      );
      setSavedRoadmap(roadmapToSave.label);
      setRoadmapToSave(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this roadmap.");
    } finally {
      setImportLoading(false);
    }
  }

  function clearEquipment() {
    setEquipment(blankEquipment);
    setResult(null);
    setLoadedCharacter(null);
    setError("");
  }

  function previewBulkImport() {
    if (!bulkText.trim()) return;
    setBulkPreview(parseEquipmentBundle(bulkText));
    setError("");
  }
  function applyBulkImport() {
    if (!bulkPreview) return;
    if (equipment.some((entry) => entry.itemText.trim())) {
      setError(
        "Clear the current equipment before applying this import so no existing item is overwritten.",
      );
      return;
    }
    const bySlot = new Map(
      bulkPreview.equipment.map((entry) => [entry.slot, entry.itemText]),
    );
    setEquipment(
      slotNames.map((slot) => ({ slot, itemText: bySlot.get(slot) || "" })),
    );
    setBulkText("");
    setBulkPreview(null);
    setLoadedCharacter(null);
    setResult(null);
  }

  async function previewOfficialSync() {
    if (!loadedCharacter || !poe?.connections[0]) return;
    setImportLoading(true);
    setError("");
    try {
      setReconciliation(
        await api.reconcileCharacter(
          loadedCharacter.id,
          poe.connections[0].id,
          false,
        ),
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not compare with the official account.",
      );
    } finally {
      setImportLoading(false);
    }
  }
  async function applyOfficialSync() {
    if (!loadedCharacter || !poe?.connections[0]) return;
    setImportLoading(true);
    setError("");
    try {
      const applied = await api.reconcileCharacter(
        loadedCharacter.id,
        poe.connections[0].id,
        true,
      );
      const detail = await api.character(loadedCharacter.id);
      const bySlot = new Map(
        detail.equipment.map((entry) => [
          entry.slot.toLowerCase(),
          entry.itemText,
        ]),
      );
      setEquipment(
        slotNames.map((slot) => ({
          slot,
          itemText: bySlot.get(slot.toLowerCase()) || "",
        })),
      );
      setResult(detail.diagnosis);
      setLoadedCharacter(detail.character);
      setSyncApplied(applied.differences);
      setReconciliation(null);
      void loadRoadmaps(detail.character);
      void loadSnapshots(detail.character.id);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not apply official synchronization.",
      );
    } finally {
      setImportLoading(false);
    }
  }

  async function loadCharacter() {
    if (!selectedCharacterId) return;
    if (equipment.some((entry) => entry.itemText.trim())) {
      setError(
        "Clear the current equipment before loading a character so nothing you pasted is overwritten.",
      );
      return;
    }
    setImportLoading(true);
    setError("");
    setResult(null);
    try {
      const detail = await api.character(Number(selectedCharacterId));
      const bySlot = new Map(
        detail.equipment.map((entry) => [
          entry.slot.toLowerCase(),
          entry.itemText,
        ]),
      );
      const imported = slotNames.map((slot) => ({
        slot,
        itemText: bySlot.get(slot.toLowerCase()) || "",
      }));
      setEquipment(imported);
      setLoadedCharacter(detail.character);
      void loadRoadmaps(detail.character);
      void loadSnapshots(detail.character.id);
      if (detail.character.buildProfileId)
        setSelectedBuildProfileId(detail.character.buildProfileId);
      if (!detail.equipment.length) {
        setError(
          "This character has no saved equipment yet. Import it from Characters or paste items below.",
        );
        return;
      }
      setResult(
        detail.diagnosis ||
          (await api.buildDoctor({
            equipment: detail.equipment,
            selectedBuildProfileId:
              detail.character.buildProfileId || selectedBuildProfileId,
          })),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load this character.",
      );
    } finally {
      setImportLoading(false);
    }
  }

  async function diagnose() {
    setError("");
    setLoading(true);
    setResult(null);
    try {
      const filled = equipment.filter((entry) => entry.itemText.trim());
      if (!filled.length) {
        setError("Paste at least one equipped item.");
        return;
      }
      setResult(
        await api.buildDoctor({ equipment: filled, selectedBuildProfileId }),
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not diagnose this equipment set",
      );
    } finally {
      setLoading(false);
    }
  }

  async function findUpgrade() {
    const current = equipment.find((entry) => entry.slot === activeSlot);
    if (!current?.itemText) return;
    setToolLoading(true);
    setError("");
    try {
      const preserveStats = [
        "life",
        "fireResistance",
        "coldResistance",
        "lightningResistance",
        "chaosResistance",
        "movementSpeed",
        "spirit",
      ];
      const response = await api.buildDoctorUpgradeSearch({
        itemText: current.itemText,
        league: "Runes of Aldur",
        tolerance,
        preserveStats,
      });
      window.open(response.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not create the upgrade search.",
      );
    } finally {
      setToolLoading(false);
    }
  }
  async function simulateSwap() {
    if (!activeSlot || !candidateItemText.trim()) return;
    setToolLoading(true);
    setError("");
    try {
      setSimulation(
        await api.simulateBuildSwap({
          equipment: equipment.filter((entry) => entry.itemText.trim()),
          slot: activeSlot,
          candidateItemText,
          selectedBuildProfileId,
        }),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not simulate this swap.",
      );
    } finally {
      setToolLoading(false);
    }
  }

  return (
    <div className="page standard-page">
      <header className="page-header">
        <span className="eyebrow">{t("doctor.eyebrow").toUpperCase()}</span>
        <h1>{t("doctor.title")}</h1>
        <p>{t("doctor.help")}</p>
      </header>
      <div className="build-layout build-doctor-layout">
        <div className="build-main">
          <section className="card build-card">
            <div className="build-section-title">
              <Stethoscope />
              <div>
                <h2>{t("doctor.equipment")}</h2>
                <p>{t("doctor.equipmentHelp")}</p>
              </div>
            </div>
            <div className="build-doctor-character-import">
              <div>
                <UserRound />
                <div>
                  <strong>{t("doctor.saved")}</strong>
                  <span>{t("doctor.savedHelp")}</span>
                </div>
              </div>
              <label>
                {t("doctor.character")}
                <select
                  aria-label="Saved character"
                  value={selectedCharacterId}
                  onChange={(e) => setSelectedCharacterId(e.target.value)}
                >
                  <option value="">{t("doctor.select")}</option>
                  {characters.map((character) => (
                    <option key={character.id} value={character.id}>
                      {character.name} · {character.league}
                      {character.level ? ` · Lv ${character.level}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="secondary-button"
                type="button"
                disabled={!selectedCharacterId || importLoading}
                onClick={loadCharacter}
              >
                {importLoading ? (
                  <LoaderCircle className="spin" />
                ) : (
                  <HeartPulse />
                )}
                {t("doctor.load")}
              </button>
            </div>
            {loadedCharacter && (
              <div className="build-doctor-loaded" role="status">
                <span>
                  <UserRound />
                  <b>{loadedCharacter.name}</b> · {loadedCharacter.league}
                  {loadedCharacter.level
                    ? ` · Level ${loadedCharacter.level}`
                    : ""}
                </span>
                <div>
                  {poe?.connections.length ? (
                    <button
                      type="button"
                      disabled={importLoading}
                      onClick={previewOfficialSync}
                    >
                      <Cloud />
                      Compare with PoE
                    </button>
                  ) : null}
                  <button type="button" onClick={clearEquipment}>
                    <Eraser />
                    Clear equipment
                  </button>
                </div>
              </div>
            )}
            {reconciliation && (
              <div className="build-doctor-sync-preview">
                <div>
                  <strong>Official synchronization preview</strong>
                  <span>
                    {reconciliation.differences.length
                      ? `${reconciliation.differences.length} equipment changes found. A snapshot of the current build will be created before applying.`
                      : "Your saved equipment already matches the official character."}
                  </span>
                </div>
                {reconciliation.differences.length > 0 && (
                  <div className="build-doctor-sync-list">
                    {reconciliation.differences.map((diff) => (
                      <span key={diff.slot}>
                        <b>{diff.slot}</b>
                        {diff.status.replace("-", " ")}
                      </span>
                    ))}
                  </div>
                )}
                {reconciliation.requiresConfirmation && (
                  <button
                    className="primary-button"
                    type="button"
                    disabled={importLoading}
                    onClick={applyOfficialSync}
                  >
                    <Check />
                    Confirm synchronization
                  </button>
                )}
              </div>
            )}
            {syncApplied.length > 0 && (
              <div className="build-doctor-sync-applied" role="status">
                <Check />
                <div>
                  <strong>Official equipment synchronized</strong>
                  <span>
                    {syncApplied
                      .map(
                        (change) =>
                          `${change.slot}: ${change.status.replace("-", " ")}`,
                      )
                      .join(" · ")}
                  </span>
                  <small>
                    A snapshot of the previous equipment was preserved for
                    comparison.
                  </small>
                </div>
              </div>
            )}
            <details className="build-doctor-bulk">
              <summary>
                <Import />
                {text(
                  "Paste a complete equipment export",
                  "Colar uma exportação completa dos equipamentos",
                )}
              </summary>
              <div>
                <label>
                  {text("Equipment bundle", "Conjunto de equipamentos")}
                  <textarea
                    aria-label="Complete equipment export"
                    rows={8}
                    value={bulkText}
                    onChange={(e) => {
                      setBulkText(e.target.value);
                      setBulkPreview(null);
                    }}
                    placeholder="Paste several exported items here. Each item must include its Item Class line…"
                  />
                </label>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={!bulkText.trim()}
                  onClick={previewBulkImport}
                >
                  {text("Review import", "Revisar importação")}
                </button>
                {bulkPreview && (
                  <div className="build-doctor-import-review" role="status">
                    <strong>
                      {bulkPreview.equipment.length}{" "}
                      {text("items recognized", "itens reconhecidos")}
                    </strong>
                    <div>
                      {bulkPreview.equipment.map((item) => (
                        <span key={item.slot}>
                          <Check />
                          {item.slot}
                        </span>
                      ))}
                    </div>
                    {bulkPreview.rejected.map((item, index) => (
                      <p key={`${item.itemClass}-${index}`}>
                        <AlertTriangle />
                        <b>{item.itemClass}:</b> {item.reason}
                      </p>
                    ))}
                    <button
                      className="primary-button"
                      type="button"
                      disabled={!bulkPreview.equipment.length}
                      onClick={applyBulkImport}
                    >
                      {text(
                        "Apply recognized items",
                        "Aplicar itens reconhecidos",
                      )}
                    </button>
                  </div>
                )}
              </div>
            </details>
            <label className="build-doctor-profile">
              {t("doctor.profile")}
              <select
                aria-label="Build profile"
                value={selectedBuildProfileId}
                onChange={(e) => setSelectedBuildProfileId(e.target.value)}
              >
                {buildProfiles.length ? (
                  buildProfiles.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                      {entry.source === "custom" ? " · Custom" : ""}
                    </option>
                  ))
                ) : (
                  <option value="generic-build-fit">Generic Build Fit</option>
                )}
              </select>
            </label>
            <div className="build-doctor-equipment-grid">
              {equipment.map((entry) => (
                <article className="build-doctor-slot" key={entry.slot}>
                  <div>
                    <strong>{entry.slot}</strong>
                  </div>
                  <textarea
                    aria-label={`${entry.slot} item text`}
                    rows={4}
                    value={entry.itemText}
                    onChange={(e) => setSlotText(entry.slot, e.target.value)}
                    placeholder={t("doctor.paste")}
                  />
                </article>
              ))}
            </div>
            {error && <div className="error-box">{error}</div>}
            <div className="build-actions">
              <button
                className="primary-button"
                type="button"
                onClick={diagnose}
                disabled={loading}
              >
                {loading ? <LoaderCircle className="spin" /> : <HeartPulse />}
                {t("doctor.diagnose")}
              </button>
              {equipment.some((entry) => entry.itemText.trim()) && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={clearEquipment}
                >
                  <Eraser />
                  {t("doctor.clear")}
                </button>
              )}
            </div>
          </section>

          {result && (
            <section
              className="card build-card"
              data-testid="build-doctor-result"
            >
              <div className="build-doctor-executive">
                <div className="build-doctor-executive-head">
                  <div>
                    <span className="eyebrow">
                      {text("EXECUTIVE DIAGNOSIS", "DIAGNÓSTICO EXECUTIVO")}
                    </span>
                    <h2>
                      {text("Your next decisions", "Suas próximas decisões")}
                    </h2>
                  </div>
                  <span
                    className={`build-doctor-confidence ${result.profile.equipmentCoverage.percent >= 80 ? "high" : result.profile.equipmentCoverage.percent >= 40 ? "medium" : "low"}`}
                  >
                    {result.profile.equipmentCoverage.percent}%{" "}
                    {text(
                      "equipment coverage",
                      "de cobertura dos equipamentos",
                    )}
                  </span>
                </div>
                <div className="build-doctor-critical-grid">
                  <article>
                    <AlertTriangle />
                    <small>{text("TOP PROBLEM", "PROBLEMA PRINCIPAL")}</small>
                    <strong>
                      {result.profile.gaps[0] ||
                        text(
                          "No critical tracked gap found.",
                          "Nenhuma falha crítica identificada.",
                        )}
                    </strong>
                  </article>
                  <article>
                    <Target />
                    <small>{text("NEXT UPGRADE", "PRÓXIMO UPGRADE")}</small>
                    <strong>
                      {result.recommendedUpgradeOrder[0]?.slot ||
                        text(
                          "No priority available",
                          "Nenhuma prioridade disponível",
                        )}
                    </strong>
                    <span>{result.profile.nextMove}</span>
                  </article>
                  <article>
                    <ShieldCheck />
                    <small>{text("SWAP RISK", "RISCO DA TROCA")}</small>
                    <strong>
                      {result.alerts.length
                        ? `${result.alerts.length} ${text("dependency warnings", "alertas de dependência")}`
                        : text(
                            "No tracked dependency warning",
                            "Nenhum alerta de dependência",
                          )}
                    </strong>
                  </article>
                </div>
              </div>
              {result.offenceResult && (
                <div className="doctor-offence-summary" data-testid="build-doctor-offence">
                  <div><small>{text("VERSIONED OFFENCE", "OFENSIVA VERSIONADA")}</small><strong>{result.offenceResult.skillName} · {result.offenceResult.patch}</strong><span>{result.offenceResult.mechanicCoverage.reason}</span></div>
                  <div><small>{text("SUSTAINED DPS", "DPS SUSTENTADO")}</small><strong>{result.offenceResult.sustainedDps ?? text("Withheld", "NÃ£o exibido")}</strong><span>{result.offenceResult.confidence} · {result.offenceResult.mechanicCoverage.status}</span></div>
                  <div><small>{text("MISSING INPUTS", "DADOS AUSENTES")}</small><strong>{result.offenceResult.missingInputs.length}</strong><span>{result.offenceResult.missingInputs.slice(0, 2).join(" · ") || text("None", "Nenhum")}</span></div>
                </div>
              )}
              {result.rosterCompatibility&&result.spiritFeasibility&&<section className="card deterministic-offence" data-testid="doctor-foundations"><div className="doctor-summary-grid"><div><small>{text("ROSTER CATALOG","CATÁLOGO DO ROSTER")}</small><strong>{result.rosterCompatibility.catalogPatch} · {result.rosterCompatibility.status}</strong><span>{result.rosterCompatibility.recognized?text("Class and ascendancy recognized","Classe e ascendência reconhecidas"):result.rosterCompatibility.issues.join(" ")}</span></div><div><small>SPIRIT · SET {result.spiritFeasibility.weaponSet??"?"}</small><strong>{result.spiritFeasibility.valid===null?text("Unknown","Desconhecido"):result.spiritFeasibility.valid?text("Valid","Válido"):text("Broken","Inválido")}</strong><span>{result.spiritFeasibility.availableSpirit??"?"} / {result.spiritFeasibility.reservedSpirit??"?"}</span></div><div><small>{text("ASCENDANCY COVERAGE","COBERTURA DA ASCENDÊNCIA")}</small><strong>{result.ascendancyMechanicModeled===false?text("Not modeled","Não modelado"):result.ascendancyMechanicCoverage?.length??0}</strong><span>{result.ascendancyMechanicModeled===false?text("no dedicated package for this ascendancy yet","ainda sem pacote dedicado para esta ascendência"):`${result.ascendancyMechanicCoverage?.filter((entry)=>entry.status==="unknown").length??0} ${text("unknown components","componentes desconhecidos")}`}</span></div></div>{result.criticalRegressions&&result.criticalRegressions.length>0&&<div className="category-warnings">{result.criticalRegressions.map((line)=><span key={line}><AlertTriangle/>{line}</span>)}</div>}{result.transitionBundle&&!result.transitionBundle.complete&&<p><strong>{text("Transition blocked:","Transição bloqueada:")}</strong> {result.transitionBundle.reason}</p>}</section>}
              <div
                className={`profile-analysis-hero ${result.profile.status.toLowerCase().replace(" ", "-")}`}
              >
                <div className="profile-score">
                  <strong>{result.profile.overallScore}</strong>
                  <span>/100</span>
                  <small>{result.profile.status}</small>
                </div>
                <div>
                  <span className="eyebrow">BUILD PROFILE ANALYSIS</span>
                  <h2>{result.profile.build.name}</h2>
                  <p>
                    {result.profile.build.className}
                    {result.profile.build.ascendancy
                      ? ` · ${result.profile.build.ascendancy}`
                      : ""}{" "}
                    · {result.profile.build.mainSkill || "No main skill"} ·{" "}
                    {result.profile.build.stage}
                  </p>
                  <div className="profile-tags">
                    {[
                      ...result.profile.build.damageTypes,
                      ...result.profile.build.defensiveLayers,
                    ].map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="profile-coverage">
                  <small>EQUIPMENT READ</small>
                  <strong>
                    {result.profile.equipmentCoverage.filled}/
                    {result.profile.equipmentCoverage.total}
                  </strong>
                  <span>
                    {result.profile.equipmentCoverage.percent}% coverage
                  </span>
                </div>
              </div>
              <div className="profile-insights">
                <article>
                  <h3>
                    <ShieldCheck />
                    What is working
                  </h3>
                  {result.profile.strengths.length ? (
                    result.profile.strengths.map((line) => (
                      <span key={line}>+ {line}</span>
                    ))
                  ) : (
                    <span>No confirmed strength yet.</span>
                  )}
                </article>
                <article>
                  <h3>
                    <AlertTriangle />
                    Current gaps
                  </h3>
                  {result.profile.gaps.length ? (
                    result.profile.gaps.map((line) => (
                      <span key={line}>− {line}</span>
                    ))
                  ) : (
                    <span>No critical tracked gap found.</span>
                  )}
                </article>
              </div>
              <div className="profile-next-move">
                <Target />
                <div>
                  <small>BEST NEXT MOVE</small>
                  <strong>{result.profile.nextMove}</strong>
                </div>
              </div>
              <div className="build-section-title">
                <HeartPulse />
                <div>
                  <h2>{text("Character totals", "Totais do personagem")}</h2>
                  <p>
                    {text(
                      "Computed from every pasted slot combined.",
                      "Calculados combinando todos os slots informados.",
                    )}
                  </p>
                </div>
              </div>
              <div className="market-search-meta">
                {Object.entries(result.resistances.current).map(
                  ([key, value]) => (
                    <span key={key}>
                      <small>
                        {key.replace(/Resistance/i, " RES").toUpperCase()}
                      </small>
                      <b>
                        {value}% ({result.resistances.missing[key]}% to cap)
                      </b>
                    </span>
                  ),
                )}
              </div>
              <div className="market-search-meta">
                {Object.entries(result.attributes.total).map(([key, value]) => (
                  <span key={key}>
                    <small>{key.toUpperCase()}</small>
                    <b>
                      {value}
                      {result.attributes.required[key]
                        ? ` / ${result.attributes.required[key]} needed`
                        : ""}{" "}
                      {result.attributes.met[key] ? "" : "⚠"}
                    </b>
                  </span>
                ))}
                <span>
                  <small>SPIRIT</small>
                  <b>
                    {result.spirit.current}
                    {result.spirit.required
                      ? ` / ${result.spirit.required} target`
                      : ""}
                    {result.spirit.missing
                      ? ` · ${result.spirit.missing} missing`
                      : ""}
                  </b>
                </span>
              </div>
              <div className="market-search-meta">
                {Object.entries(result.defenceByType)
                  .filter(([, value]) => value > 0)
                  .map(([key, value]) => (
                    <span key={key}>
                      <small>{key.toUpperCase()}</small>
                      <b>{value}</b>
                    </span>
                  ))}
              </div>
              <p className="liquidity-basis">{result.spirit.note}</p>

              {result.alerts.length > 0 && (
                <div className="decision-warnings">
                  <strong style={{ padding: "0 22px" }}>
                    {text(
                      "Swap safety alerts",
                      "Alertas de segurança da troca",
                    )}
                  </strong>
                  {result.alerts.map((a) => (
                    <span key={a.slot + a.message}>
                      <AlertTriangle />
                      {diagnosticText(a)}
                    </span>
                  ))}
                </div>
              )}

              <div
                className="build-doctor-paperdoll"
                aria-label="Visual equipment overview"
              >
                <div className="paperdoll-avatar">
                  <UserRound />
                  <strong>{loadedCharacter?.name || "Current build"}</strong>
                  <span>Click a slot to inspect it</span>
                </div>
                {slotNames.map((slot) => {
                  const data = result.slots.find(
                    (entry) => entry.slot === slot,
                  );
                  const score = data?.overallScore ?? null;
                  const strength =
                    score === null
                      ? "empty"
                      : score < 45
                        ? "weak"
                        : score < 70
                          ? "possible"
                          : "strong";
                  return (
                    <button
                      type="button"
                      key={slot}
                      className={`paperdoll-slot slot-${slot.toLowerCase().replace(/\s+/g, "-")} ${strength} ${activeSlot === slot ? "active" : ""}`}
                      onClick={() => {
                        setActiveSlot(slot);
                        setCandidateItemText("");
                        setSimulation(null);
                      }}
                      aria-label={`${slot}: ${data?.baseType || "Empty"}, ${score === null ? "not scored" : `${score} score`}`}
                    >
                      <small>{slot}</small>
                      <strong>{data?.baseType || "Empty"}</strong>
                      <span>{score === null ? "—" : score}</span>
                    </button>
                  );
                })}
              </div>

              <div className="build-fit-section">
                <div className="build-fit-title">
                  <Target />
                  <div>
                    <h3>
                      {text(
                        "Equipment heatmap",
                        "Mapa de qualidade dos equipamentos",
                      )}
                    </h3>
                    <p>
                      {text(
                        "Select a slot to search for upgrades or simulate a replacement.",
                        "Selecione um slot para buscar upgrades ou simular uma substituição.",
                      )}
                    </p>
                  </div>
                </div>
                <div className="equipment-heatmap">
                  {slotNames.map((slot) => {
                    const data = result.slots.find(
                      (entry) => entry.slot === slot,
                    );
                    const score = data?.overallScore ?? null;
                    const level =
                      score === null
                        ? "empty"
                        : score < 45
                          ? "weak"
                          : score < 70
                            ? "possible"
                            : "strong";
                    return (
                      <button
                        type="button"
                        key={slot}
                        className={`${level} ${activeSlot === slot ? "active" : ""}`}
                        onClick={() => {
                          setActiveSlot(slot);
                          setCandidateItemText("");
                          setSimulation(null);
                        }}
                      >
                        <span>{slot}</span>
                        <strong>{score === null ? "—" : score}</strong>
                        <small>{data?.baseType || "Empty slot"}</small>
                      </button>
                    );
                  })}
                </div>
                {activeSlot && (
                  <div className="upgrade-workbench">
                    <div className="upgrade-workbench-head">
                      <div>
                        <small>SELECTED SLOT</small>
                        <h3>{activeSlot}</h3>
                      </div>
                      <label>
                        {text("Search quality", "Qualidade da busca")}{" "}
                        <strong>{tolerance}%</strong>
                        <input
                          aria-label="Upgrade search quality"
                          type="range"
                          min="70"
                          max="120"
                          step="5"
                          value={tolerance}
                          onChange={(e) => setTolerance(Number(e.target.value))}
                        />
                      </label>
                    </div>
                    <p className="liquidity-basis">
                      70–90% finds cheaper alternatives, 100% keeps similar
                      values, and 105–120% asks for a stricter upgrade.
                    </p>
                    <div className="upgrade-actions">
                      <button
                        type="button"
                        onClick={findUpgrade}
                        disabled={
                          toolLoading ||
                          !equipment.find((entry) => entry.slot === activeSlot)
                            ?.itemText
                        }
                      >
                        <Search />
                        {text(
                          "Find upgrade on Trade2",
                          "Buscar upgrade no Trade2",
                        )}{" "}
                        <ExternalLink />
                      </button>
                    </div>
                    <label>
                      {text(
                        "Candidate item to simulate",
                        "Item candidato para simular",
                      )}
                      <textarea
                        aria-label={text(
                          "Candidate item to simulate",
                          "Item candidato para simular",
                        )}
                        rows={5}
                        value={candidateItemText}
                        onChange={(e) => setCandidateItemText(e.target.value)}
                        placeholder="Paste an item from Trade2 before buying it…"
                      />
                    </label>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={simulateSwap}
                      disabled={toolLoading || !candidateItemText.trim()}
                    >
                      {toolLoading ? (
                        <LoaderCircle className="spin" />
                      ) : (
                        <TestTube2 />
                      )}
                      {text("Simulate swap", "Simular troca")}
                    </button>
                    {simulation && (
                      <div
                        className={`swap-simulation ${simulation.verdict.toLowerCase().replace(/ /g, "-")}`}
                      >
                        <div>
                          <small>
                            {text(
                              "SIMULATION RESULT",
                              "RESULTADO DA SIMULAÇÃO",
                            )}
                          </small>
                          <h3>{simulation.verdict}</h3>
                          <strong>
                            {simulation.beforeScore} → {simulation.afterScore}{" "}
                            <em>
                              {simulation.scoreDelta >= 0 ? "+" : ""}
                              {simulation.scoreDelta}
                            </em>
                          </strong>
                        </div>
                        {simulation.resolvedGaps.length > 0 && (
                          <p>
                            <b>Resolved:</b>{" "}
                            {simulation.resolvedGaps.join(" · ")}
                          </p>
                        )}
                        {simulation.newGaps.length > 0 && (
                          <p className="danger">
                            <b>New risks:</b> {simulation.newGaps.join(" · ")}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="build-fit-section">
                <div className="build-fit-title">
                  <Stethoscope />
                  <div>
                    <h3>{text("Slot diagnosis", "Diagnóstico por slot")}</h3>
                    <p>
                      {text(
                        "Stat-valuation score per slot, weakest first.",
                        "Pontuação dos atributos por slot, começando pelo mais fraco.",
                      )}
                    </p>
                  </div>
                </div>
                <div className="build-fit-grid">
                  {[...result.slots]
                    .filter((s) => s.baseType)
                    .sort(
                      (a, b) => (a.overallScore ?? 0) - (b.overallScore ?? 0),
                    )
                    .map((s) => (
                      <article
                        key={s.slot}
                        className={`build-fit ${result.weakestSlots.includes(s.slot) ? "weak" : (s.overallScore ?? 0) >= 68 ? "strong" : "possible"}`}
                      >
                        <div>
                          <strong>{s.slot}</strong>
                          <span>{s.baseType}</span>
                        </div>
                        <div className="fit-meter">
                          <i style={{ width: `${s.overallScore ?? 0}%` }} />
                        </div>
                        <b>{s.overallScore ?? 0}%</b>
                        {s.wastedStats.length > 0 && (
                          <small>Wasted: {s.wastedStats.join(", ")}</small>
                        )}
                        <div className="slot-score-pills">
                          <span>OFF {s.scoreBreakdown.offence}</span>
                          <span>DEF {s.scoreBreakdown.defence}</span>
                          <span>UTIL {s.scoreBreakdown.utility}</span>
                        </div>
                        <details className="slot-breakdown">
                          <summary>
                            <Sparkles />
                            Why this score?
                          </summary>
                          <div>
                            {s.statBreakdown.length ? (
                              s.statBreakdown.map((entry) => (
                                <p
                                  key={`${entry.stat}-${entry.value}`}
                                  className={entry.wasted ? "wasted" : ""}
                                >
                                  <b>
                                    {entry.stat}{" "}
                                    {entry.value > 0
                                      ? `+${entry.value}`
                                      : entry.value}
                                  </b>
                                  <em>
                                    {entry.category} · {entry.score} pts
                                  </em>
                                  <span>
                                    {entry.reason}
                                    {entry.conditional
                                      ? " Conditional on the current build state."
                                      : ""}
                                  </span>
                                </p>
                              ))
                            ) : (
                              <p>
                                <span>
                                  No recognized stat contributions for this
                                  slot.
                                </span>
                              </p>
                            )}
                          </div>
                        </details>
                      </article>
                    ))}
                </div>
              </div>

              <div className="quality-details">
                <article>
                  <h3>Recommended upgrade order</h3>
                  {result.recommendedUpgradeOrder.map((entry) => (
                    <span key={entry.slot}>
                      → {entry.slot} ({entry.budgetPriority} priority):{" "}
                      {entry.reason}
                    </span>
                  ))}
                </article>
              </div>
              {result.limitations.length > 0 && (
                <div className="category-warnings">
                  {(
                    result.structuredLimitations ||
                    result.limitations.map((original) => ({
                      original,
                      code: undefined,
                      params: {},
                    }))
                  ).map((entry) => (
                    <span key={entry.original}>
                      <AlertTriangle />
                      {diagnosticText(entry)}
                    </span>
                  ))}
                </div>
              )}
            </section>
          )}
          {result &&
            loadedCharacter &&
            snapshots.length >= 2 &&
            (() => {
              const current = snapshotDiagnosis(snapshots[0]),
                previous = snapshotDiagnosis(snapshots[1]);
              if (!current || !previous) return null;
              const delta =
                current.profile.overallScore - previous.profile.overallScore;
              return (
                <section className="card build-card build-doctor-snapshot-compare">
                  <div className="build-section-title">
                    <History />
                    <div>
                      <h2>
                        {text(
                          "Latest snapshot comparison",
                          "Comparação dos snapshots mais recentes",
                        )}
                      </h2>
                      <p>
                        Immutable saved states from before confirmed equipment
                        changes.
                      </p>
                    </div>
                  </div>
                  <div className="snapshot-score-change">
                    <span>
                      <small>PREVIOUS</small>
                      <strong>{previous.profile.overallScore}</strong>
                    </span>
                    <b className={delta >= 0 ? "positive" : "negative"}>
                      {delta >= 0 ? "+" : ""}
                      {delta}
                    </b>
                    <span>
                      <small>LATEST</small>
                      <strong>{current.profile.overallScore}</strong>
                    </span>
                  </div>
                  <div className="snapshot-stat-grid">
                    {Object.keys(current.resistances.current).map((key) => {
                      const before = previous.resistances.current[key] || 0,
                        after = current.resistances.current[key] || 0,
                        diff = after - before;
                      return (
                        <span key={key}>
                          <small>{key.replace("Resistance", " RES")}</small>
                          <b>
                            {before}% → {after}%
                          </b>
                          <em className={diff >= 0 ? "positive" : "negative"}>
                            {diff >= 0 ? "+" : ""}
                            {diff}
                          </em>
                        </span>
                      );
                    })}
                  </div>
                </section>
              );
            })()}
          {result && loadedCharacter && roadmaps.length > 0 && (
            <section className="card build-card build-doctor-roadmaps">
              <div className="build-section-title">
                <Coins />
                <div>
                  <h2>{text("Upgrade roadmaps", "Roteiros de upgrades")}</h2>
                  <p>
                    Three allocations derived from the character's saved budget.
                    Prices are planning limits, not verified listing prices.
                  </p>
                </div>
              </div>
              {savedRoadmap && (
                <div className="roadmap-saved" role="status">
                  <Check /> {savedRoadmap} roadmap saved to the shopping list.
                </div>
              )}
              <div className="roadmap-grid">
                {roadmaps.map((entry) => (
                  <article key={entry.label}>
                    <div>
                      <span>{entry.label}</span>
                      <strong>{entry.plan.budget} Exalted</strong>
                    </div>
                    <ol>
                      {entry.plan.purchases.slice(0, 3).map((item) => (
                        <li key={item.slot}>
                          <b>
                            #{item.rank} {item.slot}
                          </b>
                          <span>
                            {item.suggestedBudget} Ex · {item.priority}
                          </span>
                          <small>{item.reason}</small>
                          {item.tradeUrl && (
                            <a
                              href={item.tradeUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open Trade2 <ExternalLink />
                            </a>
                          )}
                        </li>
                      ))}
                    </ol>
                    {!entry.plan.purchases.length && (
                      <p>
                        No upgrade priority is available with the current
                        diagnosis.
                      </p>
                    )}
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={!entry.plan.purchases.length}
                      onClick={() => setRoadmapToSave(entry)}
                    >
                      <Save />
                      {text("Save roadmap", "Salvar roteiro")}
                    </button>
                  </article>
                ))}
              </div>
              {roadmapToSave && (
                <div
                  className="roadmap-confirm"
                  role="alertdialog"
                  aria-labelledby="roadmap-confirm-title"
                >
                  <div>
                    <strong id="roadmap-confirm-title">
                      Save {roadmapToSave.label} roadmap?
                    </strong>
                    <span>
                      This will add its {roadmapToSave.plan.purchases.length}{" "}
                      recommendations to the character shopping list.
                    </span>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => setRoadmapToSave(null)}
                    >
                      Cancel
                    </button>
                    <button
                      className="primary-button"
                      type="button"
                      disabled={importLoading}
                      onClick={saveRoadmap}
                    >
                      <Check />
                      {text("Confirm save", "Confirmar salvamento")}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
          {result && (
            <GeminiCoach
              mode="build"
              characterId={loadedCharacter?.id}
              context={{
                character: loadedCharacter,
                profile: result.profile,
                totals: {
                  resistances: result.resistances,
                  attributes: result.attributes,
                  spirit: result.spirit,
                  defences: result.defenceByType,
                },
                weakestSlots: result.weakestSlots,
                upgradeOrder: result.recommendedUpgradeOrder,
                alerts: result.alerts,
                limitations: result.limitations,
                slots: result.slots,
                roadmaps,
                synchronizationChanges: syncApplied,
                offenceResult: result.offenceResult,
              }}
              onAction={(action) => {
                if (action.slot) setActiveSlot(action.slot);
              }}
            />
          )}
          {result && (
            <UpgradeCandidatePlanner
              equipment={equipment.filter((entry) => entry.itemText.trim())}
              buildProfileId={selectedBuildProfileId}
            />
          )}
        </div>
      </div>
    </div>
  );
}
