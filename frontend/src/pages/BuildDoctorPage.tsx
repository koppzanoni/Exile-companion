import { useEffect, useState } from 'react';
import { api } from '../api';
import { GeminiCoach } from '../components/GeminiCoach';
import { UpgradeCandidatePlanner } from '../components/UpgradeCandidatePlanner';
import { parseEquipmentBundle, type EquipmentImportPreview } from '../equipmentImport';
import { DiagnosisResultSection } from './buildDoctor/DiagnosisResultSection';
import { EquipmentInputSection } from './buildDoctor/EquipmentInputSection';
import { RoadmapsSection } from './buildDoctor/RoadmapsSection';
import { SnapshotComparisonSection } from './buildDoctor/SnapshotComparisonSection';
import type {
  BuildDoctorResult,
  BuildFitProfile,
  BuildSwapSimulation,
  CharacterActionPlan,
  CharacterSummary,
  EquipmentSlotInput,
  PoeOAuthStatus,
  ReconciliationResult,
} from '../types';
import { useI18n } from '../i18n';

const slotNames = [
  'Weapon',
  'Offhand',
  'Helmet',
  'Body Armour',
  'Gloves',
  'Boots',
  'Belt',
  'Amulet',
  'Ring 1',
  'Ring 2',
];
const blankEquipment: EquipmentSlotInput[] = slotNames.map((slot) => ({
  slot,
  itemText: '',
}));

export function BuildDoctorPage() {
  const { t, locale } = useI18n();
  const text = (english: string, portuguese: string) => (locale === 'pt-BR' ? portuguese : english);
  const diagnosticText = (entry: {
    code?: string;
    params?: Record<string, string | number>;
    original?: string;
    message?: string;
  }) => {
    const p = entry.params || {};
    if (locale !== 'pt-BR') return entry.original || entry.message || '';
    switch (entry.code) {
      case 'equipment.empty':
        return 'Nenhum equipamento foi informado; o diagnóstico representa um personagem vazio.';
      case 'spirit.target_unknown':
        return 'A demanda de Spirit é desconhecida porque a build não possui um alvo de Spirit configurado.';
      case 'budget.relative_only':
        return 'O orçamento sugerido é uma prioridade relativa, não um preço, pois não há um modelo verificado de custos de mercado ou crafting.';
      case 'swap.attribute_dependency':
        return `Não substitua ${p.slot} antes de recuperar ${p.gap} de ${p.attribute}; outro item exige ${p.required} e restariam apenas ${p.remaining}.`;
      case 'swap.resistance_dependency':
        return `Não substitua ${p.slot} antes de recuperar ${p.missing}% de ${p.resistance}; restariam ${p.remaining}%, abaixo do limite de ${p.cap}%.`;
      default:
        return entry.original || entry.message || '';
    }
  };
  const [equipment, setEquipment] = useState<EquipmentSlotInput[]>(blankEquipment);
  const [buildProfiles, setBuildProfiles] = useState<BuildFitProfile[]>([]);
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState('');
  const [loadedCharacter, setLoadedCharacter] = useState<CharacterSummary | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [poe, setPoe] = useState<PoeOAuthStatus | null>(null);
  const [reconciliation, setReconciliation] = useState<ReconciliationResult | null>(null);
  const [bulkText, setBulkText] = useState('');
  const [bulkPreview, setBulkPreview] = useState<EquipmentImportPreview | null>(null);
  const [roadmaps, setRoadmaps] = useState<Array<{ label: string; plan: CharacterActionPlan }>>([]);
  const [syncApplied, setSyncApplied] = useState<ReconciliationResult['differences']>([]);
  const [snapshots, setSnapshots] = useState<Array<Record<string, unknown>>>([]);
  const [roadmapToSave, setRoadmapToSave] = useState<{
    label: string;
    plan: CharacterActionPlan;
  } | null>(null);
  const [savedRoadmap, setSavedRoadmap] = useState('');
  const [selectedBuildProfileId, setSelectedBuildProfileId] = useState('generic-build-fit');
  const [result, setResult] = useState<BuildDoctorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeSlot, setActiveSlot] = useState('');
  const [candidateItemText, setCandidateItemText] = useState('');
  const [tolerance, setTolerance] = useState(100);
  const [simulation, setSimulation] = useState<BuildSwapSimulation | null>(null);
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
    setEquipment((old) => old.map((entry) => (entry.slot === slot ? { ...entry, itemText } : entry)));
  }

  async function loadRoadmaps(character: CharacterSummary) {
    const maximum = Math.max(0, character.budget || 0);
    const tiers = [
      { label: 'Economy', budget: Math.round(maximum * 0.25 * 100) / 100 },
      { label: 'Balanced', budget: Math.round(maximum * 0.6 * 100) / 100 },
      { label: 'Goal', budget: maximum },
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
    setError('');
    try {
      await api.persistCharacterActionPlan(loadedCharacter.id, roadmapToSave.plan.purchases);
      setSavedRoadmap(roadmapToSave.label);
      setRoadmapToSave(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this roadmap.');
    } finally {
      setImportLoading(false);
    }
  }

  function clearEquipment() {
    setEquipment(blankEquipment);
    setResult(null);
    setLoadedCharacter(null);
    setError('');
  }

  function previewBulkImport() {
    if (!bulkText.trim()) return;
    setBulkPreview(parseEquipmentBundle(bulkText));
    setError('');
  }
  function applyBulkImport() {
    if (!bulkPreview) return;
    if (equipment.some((entry) => entry.itemText.trim())) {
      setError('Clear the current equipment before applying this import so no existing item is overwritten.');
      return;
    }
    const bySlot = new Map(bulkPreview.equipment.map((entry) => [entry.slot, entry.itemText]));
    setEquipment(slotNames.map((slot) => ({ slot, itemText: bySlot.get(slot) || '' })));
    setBulkText('');
    setBulkPreview(null);
    setLoadedCharacter(null);
    setResult(null);
  }

  async function previewOfficialSync() {
    if (!loadedCharacter || !poe?.connections[0]) return;
    setImportLoading(true);
    setError('');
    try {
      setReconciliation(await api.reconcileCharacter(loadedCharacter.id, poe.connections[0].id, false));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not compare with the official account.');
    } finally {
      setImportLoading(false);
    }
  }
  async function applyOfficialSync() {
    if (!loadedCharacter || !poe?.connections[0]) return;
    setImportLoading(true);
    setError('');
    try {
      const applied = await api.reconcileCharacter(loadedCharacter.id, poe.connections[0].id, true);
      const detail = await api.character(loadedCharacter.id);
      const bySlot = new Map(detail.equipment.map((entry) => [entry.slot.toLowerCase(), entry.itemText]));
      setEquipment(
        slotNames.map((slot) => ({
          slot,
          itemText: bySlot.get(slot.toLowerCase()) || '',
        })),
      );
      setResult(detail.diagnosis);
      setLoadedCharacter(detail.character);
      setSyncApplied(applied.differences);
      setReconciliation(null);
      void loadRoadmaps(detail.character);
      void loadSnapshots(detail.character.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not apply official synchronization.');
    } finally {
      setImportLoading(false);
    }
  }

  async function loadCharacter() {
    if (!selectedCharacterId) return;
    if (equipment.some((entry) => entry.itemText.trim())) {
      setError('Clear the current equipment before loading a character so nothing you pasted is overwritten.');
      return;
    }
    setImportLoading(true);
    setError('');
    setResult(null);
    try {
      const detail = await api.character(Number(selectedCharacterId));
      const bySlot = new Map(detail.equipment.map((entry) => [entry.slot.toLowerCase(), entry.itemText]));
      const imported = slotNames.map((slot) => ({
        slot,
        itemText: bySlot.get(slot.toLowerCase()) || '',
      }));
      setEquipment(imported);
      setLoadedCharacter(detail.character);
      void loadRoadmaps(detail.character);
      void loadSnapshots(detail.character.id);
      if (detail.character.buildProfileId) setSelectedBuildProfileId(detail.character.buildProfileId);
      if (!detail.equipment.length) {
        setError('This character has no saved equipment yet. Import it from Characters or paste items below.');
        return;
      }
      setResult(
        detail.diagnosis ||
          (await api.buildDoctor({
            equipment: detail.equipment,
            selectedBuildProfileId: detail.character.buildProfileId || selectedBuildProfileId,
          })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this character.');
    } finally {
      setImportLoading(false);
    }
  }

  async function diagnose() {
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const filled = equipment.filter((entry) => entry.itemText.trim());
      if (!filled.length) {
        setError('Paste at least one equipped item.');
        return;
      }
      setResult(await api.buildDoctor({ equipment: filled, selectedBuildProfileId }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not diagnose this equipment set');
    } finally {
      setLoading(false);
    }
  }

  async function findUpgrade() {
    const current = equipment.find((entry) => entry.slot === activeSlot);
    if (!current?.itemText) return;
    setToolLoading(true);
    setError('');
    try {
      const preserveStats = [
        'life',
        'fireResistance',
        'coldResistance',
        'lightningResistance',
        'chaosResistance',
        'movementSpeed',
        'spirit',
      ];
      const response = await api.buildDoctorUpgradeSearch({
        itemText: current.itemText,
        league: 'Runes of Aldur',
        tolerance,
        preserveStats,
      });
      window.open(response.url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the upgrade search.');
    } finally {
      setToolLoading(false);
    }
  }
  async function simulateSwap() {
    if (!activeSlot || !candidateItemText.trim()) return;
    setToolLoading(true);
    setError('');
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
      setError(e instanceof Error ? e.message : 'Could not simulate this swap.');
    } finally {
      setToolLoading(false);
    }
  }

  return (
    <div className="page standard-page">
      <header className="page-header">
        <span className="eyebrow">{t('doctor.eyebrow').toUpperCase()}</span>
        <h1>{t('doctor.title')}</h1>
        <p>{t('doctor.help')}</p>
      </header>
      <div className="build-layout build-doctor-layout">
        <div className="build-main">
          <EquipmentInputSection
            selectedCharacterId={selectedCharacterId}
            setSelectedCharacterId={setSelectedCharacterId}
            characters={characters}
            importLoading={importLoading}
            loadCharacter={loadCharacter}
            loadedCharacter={loadedCharacter}
            poe={poe}
            previewOfficialSync={previewOfficialSync}
            clearEquipment={clearEquipment}
            reconciliation={reconciliation}
            applyOfficialSync={applyOfficialSync}
            syncApplied={syncApplied}
            bulkText={bulkText}
            setBulkText={setBulkText}
            setBulkPreview={setBulkPreview}
            bulkPreview={bulkPreview}
            previewBulkImport={previewBulkImport}
            applyBulkImport={applyBulkImport}
            buildProfiles={buildProfiles}
            selectedBuildProfileId={selectedBuildProfileId}
            setSelectedBuildProfileId={setSelectedBuildProfileId}
            equipment={equipment}
            setSlotText={setSlotText}
            error={error}
            diagnose={diagnose}
            loading={loading}
            t={t}
            text={text}
          />

          {result && (
            <DiagnosisResultSection
              result={result}
              text={text}
              diagnosticText={diagnosticText}
              activeSlot={activeSlot}
              setActiveSlot={setActiveSlot}
              candidateItemText={candidateItemText}
              setCandidateItemText={setCandidateItemText}
              simulation={simulation}
              setSimulation={setSimulation}
              tolerance={tolerance}
              setTolerance={setTolerance}
              findUpgrade={findUpgrade}
              simulateSwap={simulateSwap}
              toolLoading={toolLoading}
              equipment={equipment}
              loadedCharacter={loadedCharacter}
            />
          )}
          {result && loadedCharacter && <SnapshotComparisonSection snapshots={snapshots} text={text} />}
          {result && loadedCharacter && roadmaps.length > 0 && (
            <RoadmapsSection
              roadmaps={roadmaps}
              savedRoadmap={savedRoadmap}
              roadmapToSave={roadmapToSave}
              setRoadmapToSave={setRoadmapToSave}
              saveRoadmap={saveRoadmap}
              importLoading={importLoading}
              text={text}
            />
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
