import {
  Award,
  Camera,
  Check,
  Cloud,
  GitBranch,
  History,
  LoaderCircle,
  RefreshCw,
  Save,
  ScrollText,
  Trash2,
  UserCircle2,
  Users,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { GeminiCoach } from '../components/GeminiCoach';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PassiveAllocationMap } from '../components/PassiveAllocationMap';
import { BuildScenarioLab } from '../components/BuildScenarioLab';
import { PublicProfileTimeline } from '../components/PublicProfileTimeline';
import { BuildTab } from './characters/BuildTab';
import { EquipmentTab } from './characters/EquipmentTab';
import { useI18n } from '../i18n';
import { ascendanciesForRoster, rosterOptions, type RosterResponse } from '../poeClasses';
import type {
  CharacterActionPlan,
  CharacterAlert,
  CharacterBuildKnowledge,
  CharacterBuildLoadout,
  CharacterDetail,
  CharacterEvolution,
  CharacterInput,
  CharacterSummary,
  EquipmentSlotInput,
  LoadoutSimulation,
  MarketUpgradeCandidates,
  NetUpgradeCosts,
  PoeOAuthStatus,
  PoeRemoteCharacter,
  PublicCharacterProfile,
  ProfileCatalogStatus,
  ProfileDiagnostic,
  PurchaseHistory,
  ReconciliationResult,
  RecommendationCalibration,
  ReplacementSaleDraft,
  ShoppingPlanItem,
} from '../types';

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
const blankCharacter: CharacterInput = {
  name: '',
  league: 'Runes of Aldur',
  className: '',
  ascendancy: '',
  buildProfileId: '',
  stage: 'endgame',
  targetContent: '',
  currentIssues: '',
};
const blankLoadout: CharacterBuildLoadout = {
  patch: 'unknown',
  source: 'manual',
  confidence: 'Medium',
  mainSkill: '',
  weaponSet: '',
  skills: [],
  keyPassives: [],
};
const skillsToText = (loadout: CharacterBuildLoadout) =>
  loadout.skills
    .map(
      (skill) =>
        `${skill.name} | ${skill.supports.join(', ')}${skill.spiritReservation !== undefined ? ` | ${skill.spiritReservation}` : ''}`,
    )
    .join('\n');
function textToSkills(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = '', supports = '', spirit = ''] = line.split('|').map((value) => value.trim());
      return {
        name,
        supports: supports
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        ...(spirit && Number.isFinite(Number(spirit)) ? { spiritReservation: Number(spirit) } : {}),
      };
    });
}

export function CharactersPage() {
  const { locale, format } = useI18n();
  const br = locale === 'pt-BR';
  const text = (english: string, portuguese: string) => (br ? portuguese : english);
  const tabLabels = {
    overview: text('Overview', 'Visão geral'),
    profile: text('Profile', 'Perfil'),
    equipment: text('Equipment', 'Equipamentos'),
    build: 'Build',
    upgrades: text('Upgrades', 'Melhorias'),
    evolution: text('Evolution', 'Evolução'),
    assistant: text('Assistant', 'Assistente'),
  };
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [roster, setRoster] = useState<RosterResponse | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CharacterDetail | null>(null);
  const [form, setForm] = useState<CharacterInput>(blankCharacter);
  const [equipment, setEquipment] = useState<EquipmentSlotInput[]>(slotNames.map((slot) => ({ slot, itemText: '' })));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [poe, setPoe] = useState<PoeOAuthStatus | null>(null);
  const [remoteCharacters, setRemoteCharacters] = useState<PoeRemoteCharacter[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [snapshots, setSnapshots] = useState<Array<Record<string, unknown>>>([]);
  const [loadout, setLoadout] = useState<CharacterBuildLoadout>(blankLoadout);
  const [skillsText, setSkillsText] = useState('');
  const [passivesText, setPassivesText] = useState('');
  const [knowledge, setKnowledge] = useState<CharacterBuildKnowledge | null>(null);
  const [simulation, setSimulation] = useState<LoadoutSimulation | null>(null);
  const [actionPlan, setActionPlan] = useState<CharacterActionPlan | null>(null);
  const [shopping, setShopping] = useState<ShoppingPlanItem[]>([]);
  const [marketCandidates, setMarketCandidates] = useState<MarketUpgradeCandidates | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistory | null>(null);
  const [saleDrafts, setSaleDrafts] = useState<ReplacementSaleDraft[]>([]);
  const [evolution, setEvolution] = useState<CharacterEvolution | null>(null);
  const [netCosts, setNetCosts] = useState<NetUpgradeCosts | null>(null);
  const [alerts, setAlerts] = useState<CharacterAlert[]>([]);
  const [calibration, setCalibration] = useState<RecommendationCalibration | null>(null);
  const [reconciliation, setReconciliation] = useState<ReconciliationResult | null>(null);
  const [evolutionFilters, setEvolutionFilters] = useState({
    patch: '',
    from: '',
    to: '',
  });
  const [activeTab, setActiveTab] = useState<
    'overview' | 'profile' | 'equipment' | 'build' | 'upgrades' | 'evolution' | 'assistant'
  >('overview');
  const [publicProfile, setPublicProfile] = useState<PublicCharacterProfile | null>(null);
  const [profileDiagnostics, setProfileDiagnostics] = useState<ProfileDiagnostic[]>([]);
  const [profileCatalogs, setProfileCatalogs] = useState<ProfileCatalogStatus | null>(null);
  const [poeNinjaUrl, setPoeNinjaUrl] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [dialog, setDialog] = useState<{
    kind: 'sale' | 'reverse';
    id: number;
  } | null>(null);
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set());
  const [tabLoading, setTabLoading] = useState(false);

  function loadList() {
    api
      .characters()
      .then((response) => setCharacters(response?.characters || []))
      .catch(() => {});
  }
  useEffect(() => {
    (api.roster?.() ?? Promise.reject(new Error('Roster unavailable'))).then(setRoster).catch(() => setRoster(null));
  }, []);
  useEffect(() => {
    loadList();
    api
      .poeOAuthStatus()
      .then(setPoe)
      .catch(() => {});
  }, []);
  useEffect(() => {
    // Each top-level section/wrapper under .build-main declares its own tab via
    // data-tab-group; sections without the attribute default to 'overview'. This
    // replaced matching on translated <h2> text, which silently misplaced
    // sections whenever their heading was localized (the group keywords were
    // hardcoded English strings).
    for (const section of document.querySelectorAll<HTMLElement>('.build-main > [data-tab-group]')) {
      section.hidden = section.dataset.tabGroup !== activeTab;
    }
  }, [activeTab, selectedId, detail, shopping, evolution, alerts, calibration, reconciliation, publicProfile]);
  useEffect(() => {
    if (!selectedId || activeTab === 'overview' || activeTab === 'equipment') return;
    const key = `${selectedId}:${activeTab}`;
    if (loadedTabs.has(key)) return;
    void loadTab(selectedId, activeTab).then(() => setLoadedTabs((previous) => new Set(previous).add(key)));
  }, [selectedId, activeTab, loadedTabs]);

  async function loadTab(id: number, tab: typeof activeTab) {
    setTabLoading(true);
    try {
      if (tab === 'profile') {
        const response = await api.publicCharacterProfile(id);
        setPublicProfile(response.profile);
        setProfileDiagnostics(response.diagnostics || []);
        setProfileCatalogs(response.catalogs || null);
      } else if (tab === 'build') {
        const [saved, savedLoadout] = await Promise.all([
          api.characterSnapshots(id).catch(() => ({ snapshots: [] })),
          api.characterLoadout(id).catch(() => ({ loadout: null })),
        ]);
        setSnapshots(saved.snapshots || []);
        const next =
          savedLoadout.loadout && Array.isArray(savedLoadout.loadout.skills) ? savedLoadout.loadout : blankLoadout;
        setLoadout(next);
        setSkillsText(skillsToText(next));
        setPassivesText(next.keyPassives.join('\n'));
        setKnowledge(await api.characterBuildKnowledge(id).catch(() => null));
      } else if (tab === 'upgrades') {
        const [planned, persisted, financial, replacements] = await Promise.all([
          api.characterActionPlan(id, form.budget ?? undefined).catch(() => null),
          api.shoppingPlan(id).catch(() => ({ items: [] })),
          api.purchaseHistory(id).catch(() => null),
          api.replacementSales(id).catch(() => ({ drafts: [] })),
        ]);
        setActionPlan(planned && Array.isArray(planned.purchases) ? planned : null);
        setShopping(Array.isArray(persisted.items) ? persisted.items : []);
        setPurchaseHistory(financial && Array.isArray(financial.purchases) ? financial : null);
        setSaleDrafts(Array.isArray(replacements.drafts) ? replacements.drafts : []);
      } else if (tab === 'evolution') {
        const [evolved, net, characterAlerts, calibrated] = await Promise.all([
          api.characterEvolution(id).catch(() => null),
          api.netUpgradeCosts(id).catch(() => null),
          api.characterAlerts(id).catch(() => ({ alerts: [] })),
          api.calibration(id).catch(() => null),
        ]);
        setEvolution(evolved && Array.isArray(evolved.snapshots) ? evolved : null);
        setNetCosts(net && Array.isArray(net.rows) ? net : null);
        setAlerts(characterAlerts.alerts || []);
        setCalibration(calibrated && Array.isArray(calibrated.bySlot) ? calibrated : null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this workspace tab.');
    } finally {
      setTabLoading(false);
    }
  }

  async function connectPoe() {
    try {
      const { url } = await api.poeOAuthStart();
      window.location.assign(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start Path of Exile connection.');
    }
  }
  async function loadRemote(connectionId: number) {
    setSyncing(true);
    setError('');
    try {
      const response = await api.poeCharacters(connectionId);
      setRemoteCharacters(response.characters);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load Path of Exile characters.');
    } finally {
      setSyncing(false);
    }
  }
  async function importRemote(connectionId: number, name: string) {
    setSyncing(true);
    setError('');
    try {
      const { character, importedEquipment } = await api.importPoeCharacter(connectionId, name);
      loadList();
      await selectCharacter(character.id);
      setMessage(`${name} imported with ${importedEquipment} equipped slots. Review and save any local build details.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not import Path of Exile character.');
    } finally {
      setSyncing(false);
    }
  }

  async function selectCharacter(id: number, preserveMessage = false) {
    setSelectedId(id);
    setError('');
    if (!preserveMessage) setMessage('');
    try {
      const data = await api.character(id);
      setDetail(data);
      setForm({
        name: data.character.name,
        league: data.character.league,
        level: data.character.level ?? undefined,
        className: data.character.className,
        ascendancy: data.character.ascendancy,
        buildProfileId: data.character.buildProfileId,
        stage: (data.character.stage as CharacterInput['stage']) || 'endgame',
        budget: data.character.budget ?? undefined,
        targetContent: data.character.targetContent,
        currentIssues: data.character.currentIssues,
      });
      const merged = slotNames.map((slot) => data.equipment.find((e) => e.slot === slot) || { slot, itemText: '' });
      setEquipment(merged);
      setLoadedTabs(new Set());
      setPublicProfile(null);
      setProfileDiagnostics([]);
      setProfileCatalogs(null);
      setPoeNinjaUrl('');
      setSnapshots([]);
      setLoadout(blankLoadout);
      setSkillsText('');
      setPassivesText('');
      setKnowledge(null);
      setSimulation(null);
      setActionPlan(null);
      setShopping([]);
      setMarketCandidates(null);
      setPurchaseHistory(null);
      setSaleDrafts([]);
      setEvolution(null);
      setNetCosts(null);
      setAlerts([]);
      setCalibration(null);
      setReconciliation(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this character');
    }
  }

  async function createCharacter() {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const { character } = await api.createCharacter(form);
      setMessage(text('Character created.', 'Personagem criado.'));
      loadList();
      await selectCharacter(character.id, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create character');
    } finally {
      setLoading(false);
    }
  }

  async function saveCharacter() {
    if (!selectedId) return;
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await api.updateCharacter(selectedId, form);
      await api.saveCharacterEquipment(
        selectedId,
        equipment.filter((e) => e.itemText.trim()),
      );
      loadList();
      await selectCharacter(selectedId);
      setMessage('Character and equipment saved. You will not need to re-enter this data in future analyses.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save character');
    } finally {
      setLoading(false);
    }
  }

  async function removeCharacter(id: number) {
    await api.deleteCharacter(id);
    if (selectedId === id) {
      setSelectedId(null);
      setDetail(null);
      setForm(blankCharacter);
    }
    loadList();
  }

  function setSlotText(slot: string, itemText: string) {
    setEquipment((old) => old.map((entry) => (entry.slot === slot ? { ...entry, itemText } : entry)));
  }
  async function createSnapshot() {
    if (!selectedId) return;
    await api.createCharacterSnapshot(selectedId);
    const saved = await api.characterSnapshots(selectedId);
    setSnapshots(saved.snapshots);
    setMessage('Character snapshot saved.');
  }
  async function saveLoadout() {
    if (!selectedId) return;
    setError('');
    try {
      const next = {
        ...loadout,
        skills: textToSkills(skillsText),
        keyPassives: passivesText
          .split('\n')
          .map((value) => value.trim())
          .filter(Boolean),
      };
      await api.saveCharacterLoadout(selectedId, next);
      setLoadout(next);
      setKnowledge(await api.characterBuildKnowledge(selectedId));
      setMessage('Versioned build loadout saved and mechanical analysis updated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save build loadout.');
    }
  }
  async function simulateLoadout() {
    if (!selectedId) return;
    setError('');
    try {
      const next = {
        ...loadout,
        skills: textToSkills(skillsText),
        keyPassives: passivesText
          .split('\n')
          .map((value) => value.trim())
          .filter(Boolean),
      };
      setSimulation(await api.simulateCharacterLoadout(selectedId, next));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not simulate loadout. Save the initial loadout first.');
    }
  }
  async function persistPlan() {
    if (!selectedId || !actionPlan) return;
    try {
      await api.persistCharacterActionPlan(selectedId, actionPlan.purchases);
      setShopping((await api.shoppingPlan(selectedId)).items);
      setMessage('Shopping plan confirmed and saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save shopping plan.');
    }
  }
  async function searchCandidates(slot: string) {
    if (!selectedId) return;
    setMarketLoading(true);
    setError('');
    try {
      setMarketCandidates(await api.marketUpgradeCandidates(selectedId, slot));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not search live candidates.');
    } finally {
      setMarketLoading(false);
    }
  }
  async function updateShopping(
    item: ShoppingPlanItem,
    status: ShoppingPlanItem['status'],
    extra: Record<string, unknown> = {},
  ) {
    if (!selectedId) return;
    await api.updateShoppingPlanItem(item.id, { status, ...extra });
    setShopping((await api.shoppingPlan(selectedId)).items);
  }
  async function equipPurchase(item: ShoppingPlanItem) {
    if (!selectedId) return;
    try {
      const result = await api.equipShoppingPlanItem(item.id, true);
      setMessage(
        `Upgrade equipped: score ${result.scoreBefore} → ${result.scoreAfter}; ${result.budgetRemaining} Exalted remain.`,
      );
      await selectCharacter(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not equip this purchase.');
    }
  }
  async function confirmDialog(value: string) {
    if (!dialog || !selectedId) return;
    try {
      if (dialog.kind === 'sale') {
        const price = Number(value);
        if (!Number.isFinite(price) || price <= 0) throw new Error('Enter a valid positive listing price.');
        await api.listReplacementSale(dialog.id, {
          price,
          currency: 'exalted',
          league: form.league,
        });
        setSaleDrafts((await api.replacementSales(selectedId)).drafts);
        setMessage('Replaced item added to the sales journal with your confirmed price.');
      } else {
        const result = await api.reversePurchase(dialog.id, value.trim());
        setMessage(`Purchase reversed safely; ${result.refunded} Exalted returned to the budget.`);
        await selectCharacter(selectedId);
      }
      setDialog(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Confirmation failed.');
    }
  }
  function reversePurchase(id: number) {
    setDialog({ kind: 'reverse', id });
  }
  function listSaleDraft(draft: ReplacementSaleDraft) {
    setDialog({ kind: 'sale', id: draft.id });
  }
  async function monitorItem(item: ShoppingPlanItem) {
    setMarketLoading(true);
    try {
      const result = await api.monitorShoppingItem(item.id);
      setMessage(
        result.events.length
          ? result.events.map((event) => event.message).join(' ')
          : `Checked ${item.slot}: no relevant change detected.`,
      );
      if (selectedId) setAlerts((await api.characterAlerts(selectedId)).alerts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update candidate.');
    } finally {
      setMarketLoading(false);
    }
  }
  async function previewReconciliation(connectionId: number) {
    if (!selectedId) return;
    try {
      setReconciliation(await api.reconcileCharacter(selectedId, connectionId, false));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not compare with the official account.');
    }
  }
  async function applyReconciliation(connectionId: number) {
    if (!selectedId) return;
    try {
      await api.reconcileCharacter(selectedId, connectionId, true);
      setMessage('Official equipment reconciled after confirmation.');
      await selectCharacter(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not apply reconciliation.');
    }
  }
  async function filterEvolution() {
    if (!selectedId) return;
    setEvolution(await api.filteredEvolution(selectedId, evolutionFilters));
  }
  async function importPublicProfile() {
    if (!selectedId || !poeNinjaUrl.trim()) return;
    setProfileLoading(true);
    setError('');
    try {
      const result = await api.importPoeNinjaProfile(selectedId, poeNinjaUrl.trim());
      setPublicProfile(result.profile);
      setProfileDiagnostics(result.diagnostics || []);
      setForm((previous) => ({
        ...previous,
        league: result.profile.identity.league,
        level: result.profile.identity.level,
        className: result.profile.identity.className || previous.className,
        ascendancy: result.profile.identity.ascendancy,
      }));
      loadList();
      setMessage(
        `Public profile imported: ${result.profile.passives.allocated} passives, ${result.profile.skills.length} skill groups and ${result.profile.questRewards.claimed.length} confirmed quest rewards.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not import this poe.ninja profile.');
    } finally {
      setProfileLoading(false);
    }
  }

  return (
    <div className="page standard-page">
      <ConfirmDialog
        open={Boolean(dialog)}
        title={dialog?.kind === 'sale' ? 'List replaced item' : 'Reverse equipped purchase'}
        description={
          dialog?.kind === 'sale'
            ? 'Enter the listing price you chose. No price is inferred automatically.'
            : 'The current item will be replaced by the previous snapshot and the budget refunded.'
        }
        inputLabel={dialog?.kind === 'sale' ? 'Price in Exalted' : 'Reason for reversal'}
        confirmLabel={dialog?.kind === 'sale' ? 'List item' : 'Reverse safely'}
        onCancel={() => setDialog(null)}
        onConfirm={confirmDialog}
      />
      <header className="page-header">
        <span className="eyebrow">{text('SAVED CHARACTERS', 'PERSONAGENS SALVOS')}</span>
        <h1>{text('Characters', 'Personagens')}</h1>
        <p>
          {text(
            'Save a character once — league, build, equipment and totals carry into every future analysis without re-entering them.',
            'Salve um personagem uma vez — liga, build, equipamentos e totais serão reutilizados nas próximas análises.',
          )}
        </p>
      </header>
      <div aria-live="polite" aria-atomic="true">
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div className="success-box" role="status">
            <Check />
            {message}
          </div>
        )}
      </div>
      {tabLoading && (
        <div className="tab-loading" role="status">
          <LoaderCircle className="spin" />
          {text('Loading', 'Carregando')} {tabLabels[activeTab]}…
        </div>
      )}
      <div className="character-tabs" role="tablist">
        {(['overview', 'profile', 'equipment', 'build', 'upgrades', 'evolution', 'assistant'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            tabIndex={activeTab === tab ? 0 : -1}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const tabs = ['overview', 'profile', 'equipment', 'build', 'upgrades', 'evolution', 'assistant'] as const,
                current = tabs.indexOf(tab),
                next =
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? tabs.length - 1
                      : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
              setActiveTab(tabs[next]);
              requestAnimationFrame(() => {
                const tabButtons = document.querySelectorAll<HTMLButtonElement>('.character-tabs [role="tab"]');
                tabButtons[next]?.focus();
              });
            }}
            onClick={() => {
              setActiveTab(tab);
              document.getElementById(`character-${tab}`)?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>
      <div className="build-layout">
        <div className="build-main" id={`character-${activeTab}`}>
          {selectedId && (
            <section className="card build-card public-profile-panel" data-tab-group="profile">
              <div className="build-section-title">
                <Cloud />
                <div>
                  <h2>{text('poe.ninja character profile', 'Perfil de personagem do poe.ninja')}</h2>
                  <p>
                    Import the public character dossier without requiring your PoE credentials. Existing local equipment
                    is not overwritten.
                  </p>
                </div>
              </div>
              <div className="public-profile-import">
                <label>
                  {text('Public profile URL', 'URL do perfil público')}
                  <input
                    type="url"
                    value={poeNinjaUrl}
                    onChange={(event) => setPoeNinjaUrl(event.target.value)}
                    placeholder="https://poe.ninja/poe2/profile/.../character/..."
                  />
                </label>
                <button
                  className="primary-button"
                  type="button"
                  disabled={profileLoading || !poeNinjaUrl.trim()}
                  onClick={importPublicProfile}
                >
                  {profileLoading ? <LoaderCircle className="spin" /> : <RefreshCw />}
                  {profileLoading ? text('Importing…', 'Importando…') : text('Import profile', 'Importar perfil')}
                </button>
              </div>
              {!publicProfile ? (
                <div className="empty-state">
                  <GitBranch />
                  <h3>{text('No public profile imported', 'Nenhum perfil público importado')}</h3>
                  <p>Paste the matching character URL above. The name must match the selected local character.</p>
                </div>
              ) : (
                <>
                  <header className="public-profile-hero">
                    <div>
                      <span className="eyebrow">{publicProfile.identity.league}</span>
                      <h3>{publicProfile.identity.name}</h3>
                      <p>
                        Level {publicProfile.identity.level} {publicProfile.identity.ascendancy} ·{' '}
                        {publicProfile.identity.account}
                      </p>
                    </div>
                    <div>
                      <small>{text('LAST PROFILE UPDATE', 'ÚLTIMA ATUALIZAÇÃO')}</small>
                      <strong>
                        {publicProfile.updatedAt
                          ? format.dateTime(publicProfile.updatedAt)
                          : text('Unknown', 'Desconhecida')}
                      </strong>
                      <a href={publicProfile.sourceUrl} target="_blank" rel="noreferrer">
                        {text('Open source', 'Abrir fonte')}
                      </a>
                    </div>
                  </header>
                  <div className="public-profile-stats">
                    {Object.entries(publicProfile.stats)
                      .filter(([, value]) => value !== null)
                      .map(([key, value]) => (
                        <span key={key}>
                          <small>{key.replace(/([A-Z])/g, ' $1')}</small>
                          <b>{value}</b>
                        </span>
                      ))}
                  </div>
                  <div className="public-profile-grid">
                    <article>
                      <h3>
                        <GitBranch />
                        {text('Passive tree', 'Árvore de passivas')}
                      </h3>
                      <div className="profile-counts">
                        <b>{publicProfile.passives.allocated}</b>
                        <span>{text('passives', 'passivas')}</span>
                        <b>{publicProfile.passives.ascendancyPoints}</b>
                        <span>{text('ascendancy', 'ascendência')}</span>
                      </div>
                      <p>
                        {publicProfile.passives.treeVersion} · {publicProfile.passives.nodeIds.length} node ids
                        preserved
                      </p>
                      <span
                        className={`catalog-status ${profileCatalogs?.passiveTree.status === 'supported' ? 'supported' : 'unsupported'}`}
                      >
                        {profileCatalogs?.passiveTree.status === 'supported'
                          ? 'Exact tree catalog'
                          : 'Safe fallback · exact catalog unavailable'}
                      </span>
                    </article>
                    <article>
                      <h3>
                        <Award />
                        {text('Ascendancy & keystones', 'Ascendência e keystones')}
                      </h3>
                      {publicProfile.keystones.length ? (
                        publicProfile.keystones.map((node) => (
                          <div className="profile-node" key={node.name}>
                            {node.icon && (
                              <img
                                src={node.icon.startsWith('http') ? node.icon : `https://poe.ninja/images/${node.icon}`}
                                alt=""
                              />
                            )}
                            <div>
                              <strong>{node.name}</strong>
                              {node.stats.map((stat) => (
                                <span key={stat}>{stat}</span>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p>
                          {text('No named keystones were returned.', 'Nenhuma keystone identificada foi retornada.')}
                        </p>
                      )}
                    </article>
                    <article>
                      <h3>
                        <ScrollText />
                        {text('Quest rewards', 'Recompensas de quests')}
                      </h3>
                      <small>
                        {publicProfile.questRewards.claimed.length}{' '}
                        {text('confirmed rewards', 'recompensas confirmadas')}
                      </small>
                      <ul>
                        {publicProfile.questRewards.claimed.map((reward) => (
                          <li key={reward}>{reward}</li>
                        ))}
                      </ul>
                      <p>{publicProfile.questRewards.coverageNote}</p>
                    </article>
                    <article>
                      <h3>
                        <Zap />
                        {text('Skills & supports', 'Skills e supports')}
                      </h3>
                      {publicProfile.skills.map((skill) => (
                        <div className="profile-skill" key={skill.name}>
                          {skill.icon && <img src={skill.icon} alt="" />}
                          <div>
                            <strong>
                              {skill.name}
                              {skill.level ? ` · Lv ${skill.level}` : ''}
                            </strong>
                            <span>
                              {skill.supports.length
                                ? skill.supports.map((support) => support.name).join(' · ')
                                : text('No linked supports returned', 'Nenhum support vinculado retornado')}
                            </span>
                            {(skill.reportedDps || []).map((metric) => (
                              <small key={metric.label}>
                                {metric.label}: {metric.value.toLocaleString()} · reported by source
                              </small>
                            ))}
                          </div>
                        </div>
                      ))}
                    </article>
                    <article>
                      <h3>
                        <UserCircle2 /> {text('Public equipment', 'Equipamentos públicos')}
                      </h3>
                      {(publicProfile.equipment || []).length ? (
                        (publicProfile.equipment || []).map((item, index) => (
                          <div className="profile-equipment" key={`${item.slot}-${index}`}>
                            {item.icon && <img src={item.icon} alt="" />}
                            <div>
                              <small>
                                {item.slot} · {item.rarity}
                              </small>
                              <strong>{item.name || item.baseType}</strong>
                              {item.name && <span>{item.baseType}</span>}
                              <span>
                                {item.modifiers.slice(0, 4).join(' · ') || 'No normalized modifiers returned'}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p>
                          {publicProfile.equipmentCount} public item records were reported, but this saved snapshot
                          predates rich item normalization. Re-import to refresh it.
                        </p>
                      )}
                    </article>
                  </div>
                  <section className="profile-detail-panel" aria-labelledby="allocation-map-heading">
                    <h3 id="allocation-map-heading">
                      <GitBranch /> {text('Allocated passive map', 'Mapa de passivas alocadas')}
                    </h3>
                    <PassiveAllocationMap
                      nodeIds={publicProfile.passives.nodeIds}
                      treeVersion={publicProfile.passives.treeVersion}
                    />
                  </section>
                  <PublicProfileTimeline characterId={selectedId} refreshKey={publicProfile.importedAt} />
                  {profileDiagnostics.length > 0 && (
                    <section className="profile-detail-panel" aria-labelledby="profile-findings-heading">
                      <h3 id="profile-findings-heading">
                        {text('Evidence-backed findings', 'Diagnósticos baseados em evidências')}
                      </h3>
                      <div className="profile-findings">
                        {profileDiagnostics.map((finding, index) => (
                          <article
                            className={`profile-finding ${finding.severity}`}
                            key={`${finding.category}-${index}`}
                          >
                            <span>{finding.severity}</span>
                            <div>
                              <strong>{finding.message}</strong>
                              <p>{finding.evidence}</p>
                              <small>
                                {finding.confidence} {text('confidence', 'de confiança')} · {finding.category}
                              </small>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  )}
                  <div className="source-banner cache">
                    <Cloud />
                    <div>
                      <small>{text('PROVENANCE', 'PROVENIÊNCIA')}</small>
                      <strong>Public poe.ninja snapshot · High extraction confidence</strong>
                      <span>{publicProfile.provenance.limitations.join(' ')}</span>
                    </div>
                  </div>
                </>
              )}
            </section>
          )}
          <section className="card build-card" data-tab-group="overview">
            <div className="build-section-title">
              <Cloud />
              <div>
                <h2>{text('Path of Exile account', 'Conta do Path of Exile')}</h2>
                <p>
                  {text(
                    'Connect with official OAuth to import your PoE 2 characters and currently equipped items. The app never asks for your password.',
                    'Conecte-se pelo OAuth oficial para importar personagens e itens equipados. O app nunca solicita sua senha.',
                  )}
                </p>
              </div>
            </div>
            {poe?.configured === false ? (
              <div className="category-warnings">
                <span>OAuth is not configured on this server yet. Required: {(poe.required || []).join(', ')}.</span>
              </div>
            ) : (poe?.connections || []).length ? (
              <>
                <div className="custom-profile-list">
                  {(poe?.connections || []).map((connection) => (
                    <article key={connection.id}>
                      <div>
                        <strong>{connection.username || 'Connected account'}</strong>
                        <small>
                          {connection.lastSyncAt
                            ? `Last sync: ${new Date(connection.lastSyncAt).toLocaleString()}`
                            : 'Not synchronized yet'}
                          {connection.lastError ? ` · ${connection.lastError}` : ''}
                        </small>
                      </div>
                      <button type="button" onClick={() => loadRemote(connection.id)} disabled={syncing}>
                        <RefreshCw />
                      </button>
                    </article>
                  ))}
                </div>
                {remoteCharacters.length > 0 && (
                  <div className="review-list">
                    {remoteCharacters.map((remote) => {
                      const connection = (poe?.connections || [])[0];
                      return (
                        <article key={remote.name}>
                          <div>
                            <strong>{remote.name}</strong>
                            <small>
                              {remote.league || 'PoE 2'}
                              {remote.level ? ` · Level ${remote.level}` : ''}
                              {remote.ascendancy ? ` · ${remote.ascendancy}` : ''}
                            </small>
                          </div>
                          <button
                            type="button"
                            onClick={() => connection && importRemote(connection.id, remote.name)}
                            disabled={syncing || !connection}
                          >
                            {syncing ? <LoaderCircle className="spin" /> : 'Import equipped gear'}
                          </button>
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <button className="primary-button" type="button" onClick={connectPoe}>
                <Cloud />
                {text('Connect Path of Exile account', 'Conectar conta do Path of Exile')}
              </button>
            )}
          </section>
          <section className="card build-card" data-tab-group="overview">
            <div className="build-section-title">
              <Users />
              <div>
                <h2>{text('Your characters', 'Seus personagens')}</h2>
                <p>
                  {text(
                    'Select one to edit, or fill the form below to create a new one.',
                    'Selecione um personagem para editar ou preencha o formulário abaixo para criar um novo.',
                  )}
                </p>
              </div>
            </div>
            {characters.length ? (
              <div className="custom-profile-list">
                {characters.map((c) => (
                  <article key={c.id}>
                    <div>
                      <strong>{c.name}</strong>
                      <small>
                        {c.league} · {c.className}
                        {c.ascendancy ? ` · ${c.ascendancy}` : ''}
                        {c.level ? ` · Level ${c.level}` : ''}
                      </small>
                    </div>
                    <button
                      type="button"
                      onClick={() => selectCharacter(c.id)}
                      aria-label={`${text('Select', 'Selecionar')} ${c.name}`}
                    >
                      <UserCircle2 />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCharacter(c.id)}
                      aria-label={`${text('Delete', 'Excluir')} ${c.name}`}
                    >
                      <Trash2 />
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <p>{text('No characters saved yet.', 'Nenhum personagem salvo ainda.')}</p>
            )}
          </section>

          <section className="card build-card" data-tab-group="overview">
            <div className="build-section-title">
              <UserCircle2 />
              <div>
                <h2>
                  {selectedId ? text('Edit character', 'Editar personagem') : text('New character', 'Novo personagem')}
                </h2>
                <p>
                  {text(
                    'Class, ascendancy, build, stage, budget and target content are reused automatically.',
                    'Classe, ascendência, build, etapa, orçamento e conteúdo-alvo são reutilizados automaticamente.',
                  )}
                </p>
              </div>
            </div>
            <div className="build-fields">
              <label>
                {text('Name', 'Nome')}
                <input
                  aria-label={text('Character name', 'Nome do personagem')}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Frostbolt"
                />
              </label>
              <label>
                {text('League', 'Liga')}
                <input
                  aria-label={text('Character league', 'Liga do personagem')}
                  value={form.league}
                  onChange={(e) => setForm({ ...form, league: e.target.value })}
                />
              </label>
              <label>
                {text('Level', 'Nível')}
                <input
                  aria-label={text('Character level', 'Nível do personagem')}
                  type="number"
                  min="1"
                  max="100"
                  value={form.level ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      level: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                />
              </label>
              <label>
                {text('Class', 'Classe')}
                <select
                  aria-label={text('Character class', 'Classe do personagem')}
                  value={form.className || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      className: e.target.value,
                      ascendancy: '',
                    })
                  }
                >
                  <option value="">{text('Choose a class', 'Escolha uma classe')}</option>
                  {rosterOptions(roster).map((entry) => (
                    <option key={entry.name} value={entry.name}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {text('Ascendancy', 'Ascendência')}
                <select
                  aria-label={text('Character ascendancy', 'Ascendência do personagem')}
                  value={form.ascendancy || ''}
                  disabled={!form.className}
                  onChange={(e) => setForm({ ...form, ascendancy: e.target.value })}
                >
                  <option value="">
                    {form.className
                      ? text('Choose an ascendancy', 'Escolha uma ascendência')
                      : text('Choose a class first', 'Escolha primeiro uma classe')}
                  </option>
                  {ascendanciesForRoster(form.className || '', roster).map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {text('Build profile ID', 'ID do perfil da build')}
                <input
                  aria-label={text('Build profile id', 'ID do perfil da build')}
                  value={form.buildProfileId}
                  onChange={(e) => setForm({ ...form, buildProfileId: e.target.value })}
                  placeholder="e.g. ice-shot-deadeye or custom:1"
                />
              </label>
              <label>
                {text('Progression stage', 'Etapa de progressão')}
                <select
                  aria-label={text('Progression stage', 'Etapa de progressão')}
                  value={form.stage}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      stage: e.target.value as CharacterInput['stage'],
                    })
                  }
                >
                  <option value="campaign">{text('Campaign', 'Campanha')}</option>
                  <option value="early-maps">{text('Early maps', 'Mapas iniciais')}</option>
                  <option value="endgame">Endgame</option>
                </select>
              </label>
              <label>
                {text('Budget (Exalted)', 'Orçamento (Exalted)')}
                <input
                  aria-label={text('Character budget', 'Orçamento do personagem')}
                  type="number"
                  min="0"
                  value={form.budget ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      budget: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                />
              </label>
              <label className="wide">
                {text('Target content', 'Conteúdo-alvo')}
                <input
                  aria-label={text('Target content', 'Conteúdo-alvo')}
                  value={form.targetContent}
                  onChange={(e) => setForm({ ...form, targetContent: e.target.value })}
                  placeholder="T15 maps, Trial of the Sekhemas…"
                />
              </label>
              <label className="wide">
                {text('Current issues', 'Problemas atuais')}
                <textarea
                  aria-label={text('Current issues', 'Problemas atuais')}
                  value={form.currentIssues}
                  onChange={(e) => setForm({ ...form, currentIssues: e.target.value })}
                  placeholder="Uncapped chaos resistance, low DPS on bosses…"
                />
              </label>
            </div>
            <div className="build-actions">
              {selectedId ? (
                <button className="primary-button" type="button" onClick={saveCharacter} disabled={loading}>
                  {loading ? <LoaderCircle className="spin" /> : <Save />}
                  {text('Save character', 'Salvar personagem')}
                </button>
              ) : (
                <button
                  className="primary-button"
                  type="button"
                  onClick={createCharacter}
                  disabled={loading || !form.name}
                >
                  {loading ? <LoaderCircle className="spin" /> : <Save />}
                  {text('Create character', 'Criar personagem')}
                </button>
              )}
            </div>
          </section>

          {selectedId && <EquipmentTab equipment={equipment} setSlotText={setSlotText} text={text} />}

          {selectedId && (
            <BuildTab
              loadout={loadout}
              setLoadout={setLoadout}
              skillsText={skillsText}
              setSkillsText={setSkillsText}
              passivesText={passivesText}
              setPassivesText={setPassivesText}
              simulateLoadout={simulateLoadout}
              saveLoadout={saveLoadout}
              simulation={simulation}
              knowledge={knowledge}
              text={text}
            />
          )}

          {selectedId && actionPlan && (
            <section className="card build-card" data-tab-group="upgrades">
              <div className="build-section-title">
                <Users />
                <div>
                  <h2>Prioritized shopping plan</h2>
                  <p>
                    Budget {actionPlan.budget} Exalted · current build score {actionPlan.score}.
                  </p>
                </div>
              </div>
              <div className="review-list">
                {actionPlan.purchases.map((item) => (
                  <article key={item.slot}>
                    <div>
                      <strong>
                        #{item.rank} {item.slot} · {item.priority}
                      </strong>
                      <small>
                        {item.reason} · suggested allocation {item.suggestedBudget} Exalted
                      </small>
                    </div>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={marketLoading || item.requiresEquippedItem}
                      onClick={() => searchCandidates(item.slot)}
                    >
                      {marketLoading ? 'Searching…' : 'Find and simulate'}
                    </button>
                    {item.tradeUrl && (
                      <a className="secondary-button" href={item.tradeUrl} target="_blank" rel="noreferrer">
                        Open Trade2
                      </a>
                    )}
                  </article>
                ))}
              </div>
              {shopping.length === 0 && (
                <button type="button" className="primary-button" onClick={persistPlan}>
                  <Save />
                  Confirm and save this plan
                </button>
              )}
              {actionPlan.blockers.length > 0 && (
                <div className="category-warnings">
                  {actionPlan.blockers.slice(0, 6).map((blocker) => (
                    <span key={blocker}>{blocker}</span>
                  ))}
                </div>
              )}
              <p>
                <small>{actionPlan.warning}</small>
              </p>
            </section>
          )}

          {marketCandidates && (
            <section className="card build-card" data-tab-group="upgrades">
              <div className="build-section-title">
                <Users />
                <div>
                  <h2>Simulated live candidates</h2>
                  <p>
                    {marketCandidates.sampleSize} usable Trade2 comparables · {marketCandidates.dataSource}.
                  </p>
                </div>
              </div>
              <div className="review-list">
                {marketCandidates.candidates.map((candidate) => (
                  <article key={candidate.id}>
                    <div>
                      <strong>
                        {candidate.listing?.name || candidate.slot} · +{candidate.scoreDelta} score
                      </strong>
                      <small>
                        {candidate.price} Exalted · {candidate.verdict} · {candidate.valuePerExalted} score/Ex
                      </small>
                    </div>
                    {shopping.find((item) => item.slot === candidate.slot && item.status === 'searching') && (
                      <button
                        type="button"
                        onClick={() => {
                          const item = shopping.find(
                            (row) => row.slot === candidate.slot && row.status === 'searching',
                          );
                          if (item)
                            void updateShopping(item, 'candidate', {
                              listingId: candidate.id,
                              itemText: candidate.itemText,
                              price: candidate.price,
                              tradeUrl: candidate.listing?.officialUrl,
                              scoreDelta: candidate.scoreDelta,
                            });
                        }}
                      >
                        Save candidate
                      </button>
                    )}
                  </article>
                ))}
              </div>
              <p>
                <small>{marketCandidates.warning}</small>
              </p>
            </section>
          )}

          {shopping.length > 0 && (
            <section className="card build-card" data-tab-group="upgrades">
              <div className="build-section-title">
                <Check />
                <div>
                  <h2>Saved purchase workflow</h2>
                  <p>Every status change is recorded; monitoring runs only when requested.</p>
                </div>
              </div>
              <div className="review-list">
                {shopping.map((item) => (
                  <article key={item.id}>
                    <div>
                      <strong>
                        {item.slot} · {item.status}
                      </strong>
                      <small>
                        {item.priority} · {item.price !== undefined ? `${item.price} Exalted · ` : ''}
                        {item.scoreDelta !== undefined ? `+${item.scoreDelta} score` : item.reason}
                      </small>
                    </div>
                    {['searching', 'candidate'].includes(item.status) && (
                      <button type="button" disabled={marketLoading} onClick={() => monitorItem(item)}>
                        Check market
                      </button>
                    )}
                    {item.status === 'candidate' && (
                      <button type="button" onClick={() => equipPurchase(item)}>
                        Confirm purchase and equip
                      </button>
                    )}
                    {item.status !== 'bought' && item.status !== 'discarded' && (
                      <button type="button" onClick={() => updateShopping(item, 'discarded')}>
                        Discard
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {purchaseHistory && purchaseHistory.purchases.length > 0 && (
            <section className="card build-card" data-tab-group="evolution">
              <div className="build-section-title">
                <History />
                <div>
                  <h2>Build investment</h2>
                  <p>Confirmed purchases and their measured impact.</p>
                </div>
              </div>
              <div className="market-search-meta">
                <span>
                  <small>Total spent</small>
                  <b>{purchaseHistory.totalSpent} Ex</b>
                </span>
                <span>
                  <small>Score gained</small>
                  <b>+{purchaseHistory.totalScoreGain}</b>
                </span>
                <span>
                  <small>Cost per score</small>
                  <b>{purchaseHistory.costPerScore ?? 'N/A'} Ex</b>
                </span>
              </div>
              <div className="review-list">
                {purchaseHistory.purchases.map((purchase) => (
                  <article key={purchase.id}>
                    <div>
                      <strong>
                        {purchase.slot} · {purchase.price} Exalted
                        {purchase.reversedAt ? ' · reversed' : ''}
                      </strong>
                      <small>
                        Score {purchase.scoreBefore} → {purchase.scoreAfter} ·{' '}
                        {new Date(purchase.createdAt).toLocaleString()}
                        {purchase.reversalReason ? ` · ${purchase.reversalReason}` : ''}
                      </small>
                    </div>
                    {!purchase.reversedAt && (
                      <button type="button" onClick={() => reversePurchase(purchase.id)}>
                        Reverse safely
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {selectedId && (
            <section className="card build-card" data-tab-group="evolution">
              <div className="build-section-title">
                <History />
                <div>
                  <h2>Dashboard filters and export</h2>
                  <p>Filter snapshots without changing saved history.</p>
                </div>
              </div>
              <div className="build-fields">
                <label>
                  Patch
                  <select
                    value={evolutionFilters.patch}
                    onChange={(e) =>
                      setEvolutionFilters({
                        ...evolutionFilters,
                        patch: e.target.value,
                      })
                    }
                  >
                    <option value="">All patches</option>
                    {(evolution?.patches || []).map((patch) => (
                      <option key={patch}>{patch}</option>
                    ))}
                  </select>
                </label>
                <label>
                  From
                  <input
                    type="date"
                    value={evolutionFilters.from}
                    onChange={(e) =>
                      setEvolutionFilters({
                        ...evolutionFilters,
                        from: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    value={evolutionFilters.to}
                    onChange={(e) =>
                      setEvolutionFilters({
                        ...evolutionFilters,
                        to: e.target.value,
                      })
                    }
                  />
                </label>
              </div>
              <div className="build-actions">
                <button type="button" onClick={filterEvolution}>
                  Apply filters
                </button>
                <a className="secondary-button" href={api.evolutionCsvUrl(selectedId, evolutionFilters)}>
                  Export CSV
                </a>
              </div>
              {evolution?.bestPurchase && (
                <p>
                  <small>
                    Best purchase: {String(evolution.bestPurchase.slot)} · {String(evolution.bestPurchase.price)} Ex.
                    Worst purchase: {String(evolution.worstPurchase?.slot || 'N/A')}.
                  </small>
                </p>
              )}
            </section>
          )}

          {evolution && evolution.snapshots.length > 0 && (
            <section className="card build-card" data-tab-group="evolution">
              <div className="build-section-title">
                <History />
                <div>
                  <h2>Evolution dashboard</h2>
                  <p>Snapshot timeline across patches {evolution.patches.join(', ')}.</p>
                </div>
              </div>
              <div className="review-list">
                {evolution.snapshots.map((snapshot) => (
                  <article key={snapshot.id}>
                    <div style={{ width: '100%' }}>
                      <strong>
                        {new Date(snapshot.createdAt).toLocaleDateString()} · score {snapshot.score}
                      </strong>
                      <div
                        style={{
                          height: 8,
                          marginTop: 8,
                          background: 'rgba(255,255,255,.08)',
                          borderRadius: 4,
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.max(2, Math.min(100, snapshot.score))}%`,
                            background: 'var(--accent, #c89b3c)',
                            borderRadius: 4,
                          }}
                        />
                      </div>
                      <small>
                        Patch {snapshot.patch} · Spirit {snapshot.spirit} · Resistances{' '}
                        {Object.values(snapshot.resistances).join(' / ') || 'unknown'}
                      </small>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {netCosts && netCosts.rows.length > 0 && (
            <section className="card build-card" data-tab-group="evolution">
              <div className="build-section-title">
                <History />
                <div>
                  <h2>Net upgrade cost</h2>
                  <p>Only completed sales reduce the acquisition cost.</p>
                </div>
              </div>
              <div className="review-list">
                {netCosts.rows.map((row) => (
                  <article key={row.id}>
                    <div>
                      <strong>
                        {row.slot} · net {row.netCost} Exalted
                      </strong>
                      <small>
                        Purchase {row.price} Ex · recovered {row.confirmedReturn} Ex · sale {row.saleStatus} ·{' '}
                        {row.costPerScore ?? 'N/A'} Ex/score
                      </small>
                    </div>
                  </article>
                ))}
              </div>
              <p>
                <small>{netCosts.warning}</small>
              </p>
            </section>
          )}

          {saleDrafts.some((draft) => draft.status === 'needs-price') && (
            <section className="card build-card" data-tab-group="evolution">
              <div className="build-section-title">
                <History />
                <div>
                  <h2>Replaced items to sell</h2>
                  <p>Set your own price before sending an old item to the sales journal.</p>
                </div>
              </div>
              <div className="review-list">
                {saleDrafts
                  .filter((draft) => draft.status === 'needs-price')
                  .map((draft) => (
                    <article key={draft.id}>
                      <div>
                        <strong>{draft.slot} replacement</strong>
                        <small>Waiting for a confirmed listing price.</small>
                      </div>
                      <button type="button" onClick={() => listSaleDraft(draft)}>
                        Set price and list
                      </button>
                    </article>
                  ))}
              </div>
            </section>
          )}

          {alerts.length > 0 && (
            <section className="card build-card" data-tab-group="evolution">
              <div className="build-section-title">
                <History />
                <div>
                  <h2>Market alerts</h2>
                  <p>Informational only; no purchase or price change was executed.</p>
                </div>
              </div>
              <div className="review-list">
                {alerts
                  .filter((alert) => !alert.readAt)
                  .map((alert) => (
                    <article key={alert.id}>
                      <div>
                        <strong>{alert.type}</strong>
                        <small>{alert.message}</small>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await api.readAlert(alert.id);
                          if (selectedId) setAlerts((await api.characterAlerts(selectedId)).alerts);
                        }}
                      >
                        Mark read
                      </button>
                    </article>
                  ))}
              </div>
            </section>
          )}

          {calibration && (
            <section className="card build-card" data-tab-group="evolution">
              <div className="build-section-title">
                <History />
                <div>
                  <h2>Recommendation accuracy</h2>
                  <p>
                    {calibration.sampleSize} confirmed local samples · average score error {calibration.averageError}.
                  </p>
                </div>
              </div>
              <div className="review-list">
                {calibration.bySlot.map((row) => (
                  <article key={row.slot}>
                    <div>
                      <strong>
                        {row.slot} · {row.confidence} confidence
                      </strong>
                      <small>
                        {row.count} sample(s) · average error {row.averageError}
                      </small>
                    </div>
                  </article>
                ))}
              </div>
              <p>
                <small>{calibration.limitation}</small>
              </p>
            </section>
          )}

          {selectedId && (poe?.connections || []).length > 0 && (
            <section className="card build-card" data-tab-group="assistant">
              <div className="build-section-title">
                <Cloud />
                <div>
                  <h2>Official account reconciliation</h2>
                  <p>Preview differences first; applying always requires a second confirmation.</p>
                </div>
              </div>
              <button type="button" onClick={() => previewReconciliation(poe!.connections[0].id)}>
                Compare with PoE account
              </button>
              {reconciliation && (
                <>
                  <div className="review-list">
                    {reconciliation.differences.map((diff) => (
                      <article key={diff.slot}>
                        <div>
                          <strong>
                            {diff.slot} · {diff.status}
                          </strong>
                          <small>Local and official equipment differ.</small>
                        </div>
                      </article>
                    ))}
                  </div>
                  {reconciliation.requiresConfirmation && (
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => applyReconciliation(poe!.connections[0].id)}
                    >
                      Confirm official reconciliation
                    </button>
                  )}
                </>
              )}
            </section>
          )}

          {selectedId && (
            <div data-tab-group="assistant">
              <BuildScenarioLab
                plan={actionPlan}
                diagnostics={profileDiagnostics}
                onAskGemini={(prompt) => {
                  setMessage(`Build Lab prompt ready: ${prompt}`);
                  document.querySelector<HTMLTextAreaElement>('[aria-label="Ask Gemini about this build"]')?.focus();
                }}
              />
            </div>
          )}

          {selectedId && (
            <div data-tab-group="assistant">
              <GeminiCoach
                mode="build"
                characterId={selectedId}
                context={{
                  screen: 'character',
                  requestedBudget: form.budget,
                  loadoutDraft: {
                    ...loadout,
                    skills: textToSkills(skillsText),
                    keyPassives: passivesText.split('\n').filter(Boolean),
                  },
                  actionPlan,
                  shopping,
                  publicProfile,
                  profileDiagnostics,
                  profileCatalogs,
                }}
                onAction={(action) => {
                  if (action.action === 'search_upgrade' && action.slot)
                    setMessage(
                      `Gemini suggested a live search for ${action.slot}. Confirm it with “Find and simulate” in the shopping plan.`,
                    );
                  else if ((action.action === 'inspect_slot' || action.action === 'view_shopping_plan') && selectedId)
                    void api
                      .executeGeminiTool({
                        characterId: selectedId,
                        action: action.action,
                        slot: action.slot,
                      })
                      .then((result) => setMessage(`Gemini tool completed read-only: ${result.action}.`))
                      .catch((e) => setError(e instanceof Error ? e.message : 'Tool failed.'));
                }}
              />
            </div>
          )}

          {detail?.diagnosis && (
            <section className="card build-card" data-tab-group="overview">
              <div className="build-section-title">
                <UserCircle2 />
                <div>
                  <h2>Current totals</h2>
                  <p>Computed live from the saved equipment above.</p>
                </div>
              </div>
              <div className="market-search-meta">
                {Object.entries(detail.diagnosis.resistances.current).map(([key, value]) => (
                  <span key={key}>
                    <small>{key.toUpperCase()}</small>
                    <b>{value}%</b>
                  </span>
                ))}
              </div>
              <div className="build-actions">
                <button type="button" className="secondary-button" onClick={createSnapshot}>
                  <Camera />
                  Save progression snapshot
                </button>
              </div>
              {snapshots.length > 0 && (
                <div className="review-list">
                  {snapshots.slice(0, 10).map((snapshot) => (
                    <article key={String(snapshot.id)}>
                      <div>
                        <strong>Score {String(snapshot.score)}</strong>
                        <small>
                          {new Date(String(snapshot.createdAt)).toLocaleString()} · patch {String(snapshot.patch)}
                        </small>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {detail && detail.history.length > 0 && (
            <section className="card build-card" data-tab-group="overview">
              <div className="build-section-title">
                <History />
                <div>
                  <h2>Analysis history</h2>
                  <p>Every analysis run against this character.</p>
                </div>
              </div>
              <div className="review-list">
                {detail.history.map((entry) => (
                  <article key={entry.id}>
                    <div>
                      <strong>{entry.summary}</strong>
                      <small>{new Date(entry.createdAt).toLocaleString()}</small>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
