import { Camera, Check, History, LoaderCircle, Save, Trash2, UserCircle2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AssistantTab } from './characters/AssistantTab';
import { BuildTab } from './characters/BuildTab';
import { EquipmentTab } from './characters/EquipmentTab';
import { EvolutionTab } from './characters/EvolutionTab';
import { PoeAccountSection } from './characters/PoeAccountSection';
import { ProfileTab } from './characters/ProfileTab';
import { UpgradesTab } from './characters/UpgradesTab';
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
            <ProfileTab
              selectedId={selectedId}
              poeNinjaUrl={poeNinjaUrl}
              setPoeNinjaUrl={setPoeNinjaUrl}
              profileLoading={profileLoading}
              importPublicProfile={importPublicProfile}
              publicProfile={publicProfile}
              profileCatalogs={profileCatalogs}
              profileDiagnostics={profileDiagnostics}
              text={text}
              formatDateTime={format.dateTime}
            />
          )}
          <PoeAccountSection
            poe={poe}
            remoteCharacters={remoteCharacters}
            syncing={syncing}
            loadRemote={loadRemote}
            importRemote={importRemote}
            connectPoe={connectPoe}
            text={text}
          />
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

          <UpgradesTab
            actionPlan={actionPlan}
            marketCandidates={marketCandidates}
            shopping={shopping}
            marketLoading={marketLoading}
            searchCandidates={searchCandidates}
            persistPlan={persistPlan}
            updateShopping={updateShopping}
            monitorItem={monitorItem}
            equipPurchase={equipPurchase}
          />

          {selectedId && (
            <EvolutionTab
              purchaseHistory={purchaseHistory}
              reversePurchase={reversePurchase}
              evolutionFilters={evolutionFilters}
              setEvolutionFilters={setEvolutionFilters}
              evolution={evolution}
              filterEvolution={filterEvolution}
              evolutionCsvUrl={api.evolutionCsvUrl(selectedId, evolutionFilters)}
              netCosts={netCosts}
              saleDrafts={saleDrafts}
              listSaleDraft={listSaleDraft}
              alerts={alerts}
              markAlertRead={async (alertId) => {
                await api.readAlert(alertId);
                setAlerts((await api.characterAlerts(selectedId)).alerts);
              }}
              calibration={calibration}
            />
          )}

          {selectedId && (
            <AssistantTab
              selectedId={selectedId}
              poeConnectionId={(poe?.connections || []).length > 0 ? poe!.connections[0].id : null}
              previewReconciliation={previewReconciliation}
              applyReconciliation={applyReconciliation}
              reconciliation={reconciliation}
              actionPlan={actionPlan}
              profileDiagnostics={profileDiagnostics}
              onAskGemini={(prompt) => {
                setMessage(`Build Lab prompt ready: ${prompt}`);
                document.querySelector<HTMLTextAreaElement>('[aria-label="Ask Gemini about this build"]')?.focus();
              }}
              characterId={selectedId}
              geminiContext={{
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
              onGeminiAction={(action) => {
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
