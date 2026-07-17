import {
  BookOpen,
  Check,
  ExternalLink,
  History,
  Info,
  LoaderCircle,
  RotateCcw,
  Save,
  ScanSearch,
  Shield,
  Sparkles,
  Swords,
  Trash2,
  UserCog,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { ascendanciesForRoster, rosterOptions, type RosterResponse } from '../poeClasses';
import type {
  BuildFitProfile,
  BuildImportResult,
  BuildPriority,
  BuildProfile,
  BuildStat,
  CustomBuildProfileInput,
  ItemCategory,
  RaceReview,
} from '../types';

const blank: BuildProfile = {
  id: '',
  source: 'custom',
  name: '',
  className: '',
  ascendancy: '',
  mainSkill: '',
  guideUrl: '',
  stage: 'early-maps',
  evaluationStyle: 'balanced',
  defenceStyle: 'life-armour',
  priorities: [],
  requiredMods: [],
  desiredMods: [],
  preferredWeaponTypes: [],
  damageTypes: [],
  defensiveLayers: [],
  offensiveStats: [],
  defensiveStats: [],
  attributes: [],
  utilityStats: [],
  wastedStats: [],
  valuableSlots: [],
  categoryPriorities: {},
  explanationRules: [],
  notes: '',
};
const blankCustom: CustomBuildProfileInput = {
  name: '',
  mainSkill: '',
  className: '',
  ascendancy: '',
  mainDamageType: 'physical',
  defensiveLayer: 'life',
  importantStats: [],
  badStats: [],
  notes: '',
};
const stats: Array<[BuildStat, string, string]> = [
  ['life', 'Maximum Life', 'Core survival for life builds'],
  ['energyShield', 'Energy Shield', 'Core survival for ES and CI'],
  ['armour', 'Armour', 'Physical mitigation'],
  ['evasion', 'Evasion', 'Attack avoidance'],
  ['movementSpeed', 'Movement Speed', 'Only scored on boots'],
  ['fireResistance', 'Fire Resistance', 'Elemental resistance coverage'],
  ['coldResistance', 'Cold Resistance', 'Elemental resistance coverage'],
  ['lightningResistance', 'Lightning Resistance', 'Elemental resistance coverage'],
  ['chaosResistance', 'Chaos Resistance', 'Chaos damage protection'],
  ['mana', 'Maximum Mana', 'Resource and Archmage scaling'],
  ['spirit', 'Spirit', 'Persistent skills and minions'],
  ['strength', 'Strength', 'Requirements or stacking'],
  ['dexterity', 'Dexterity', 'Requirements or stacking'],
  ['intelligence', 'Intelligence', 'Requirements or stacking'],
  ['physicalDps', 'Physical DPS', 'Only scored on weapons'],
  ['elementalDps', 'Elemental DPS', 'Only scored on weapons'],
  ['attacksPerSecond', 'Attack Speed', 'Only scored on weapons'],
  ['criticalHitChance', 'Critical Chance', 'Only scored on weapons'],
  ['rarityFind', 'Item Rarity', 'Farming priority'],
];

const presets: Record<string, Pick<BuildProfile, 'defenceStyle' | 'priorities'>> = {
  'Life / Armour melee': {
    defenceStyle: 'life-armour',
    priorities: priorities([
      ['life', 'required'],
      ['armour', 'high'],
      ['movementSpeed', 'high'],
      ['fireResistance', 'high'],
      ['coldResistance', 'high'],
      ['lightningResistance', 'high'],
      ['chaosResistance', 'useful'],
      ['strength', 'useful'],
      ['physicalDps', 'high'],
      ['attacksPerSecond', 'useful'],
    ]),
  },
  'Life / Evasion projectile': {
    defenceStyle: 'life-evasion',
    priorities: priorities([
      ['life', 'required'],
      ['evasion', 'high'],
      ['movementSpeed', 'high'],
      ['fireResistance', 'high'],
      ['coldResistance', 'high'],
      ['lightningResistance', 'high'],
      ['dexterity', 'useful'],
      ['elementalDps', 'high'],
      ['attacksPerSecond', 'high'],
      ['criticalHitChance', 'useful'],
    ]),
  },
  'Energy Shield caster': {
    defenceStyle: 'energy-shield',
    priorities: priorities([
      ['energyShield', 'required'],
      ['mana', 'high'],
      ['movementSpeed', 'high'],
      ['fireResistance', 'high'],
      ['coldResistance', 'high'],
      ['lightningResistance', 'high'],
      ['intelligence', 'useful'],
      ['criticalHitChance', 'useful'],
    ]),
  },
  'Minion / Spirit': {
    defenceStyle: 'hybrid',
    priorities: priorities([
      ['spirit', 'required'],
      ['life', 'high'],
      ['energyShield', 'high'],
      ['mana', 'useful'],
      ['movementSpeed', 'high'],
      ['fireResistance', 'high'],
      ['coldResistance', 'high'],
      ['lightningResistance', 'high'],
      ['intelligence', 'useful'],
    ]),
  },
};

export function BuildPage() {
  const [profile, setProfile] = useState<BuildProfile>(blank);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<BuildImportResult | null>(null);
  const [reviews, setReviews] = useState<RaceReview[]>([]);
  const [review, setReview] = useState({ title: '', cause: '', lesson: '', itemCategory: '' });
  const [fitProfiles, setFitProfiles] = useState<BuildFitProfile[]>([]);
  const [custom, setCustom] = useState<CustomBuildProfileInput>(blankCustom);
  const [roster, setRoster] = useState<RosterResponse | null>(null);
  useEffect(() => {
    api
      .buildProfile()
      .then(({ profile: saved }) => {
        if (saved) setProfile(saved);
        setLoaded(true);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Could not load build');
        setLoaded(true);
      });
  }, []);
  useEffect(() => {
    api
      .raceReviews()
      .then((response) => setReviews(response?.reviews || []))
      .catch(() => {});
  }, []);
  useEffect(() => {
    api
      .buildProfiles()
      .then((response) => setFitProfiles(response?.profiles || []))
      .catch(() => {});
  }, []);
  useEffect(() => {
    (api.roster?.() ?? Promise.reject(new Error('Roster unavailable'))).then(setRoster).catch(() => setRoster(null));
  }, []);
  const set = <K extends keyof BuildProfile>(key: K, value: BuildProfile[K]) =>
    setProfile((old) => ({ ...old, [key]: value }));
  const priority = (stat: BuildStat) => profile.priorities.find((entry) => entry.stat === stat);
  function setPriority(stat: BuildStat, level: '' | BuildPriority['level']) {
    set(
      'priorities',
      level
        ? [...profile.priorities.filter((entry) => entry.stat !== stat), { ...priority(stat), stat, level }]
        : profile.priorities.filter((entry) => entry.stat !== stat),
    );
  }
  function setMinimum(stat: BuildStat, value: string) {
    const current = priority(stat);
    if (!current) return;
    set('priorities', [
      ...profile.priorities.filter((entry) => entry.stat !== stat),
      { ...current, minimum: value ? Number(value) : undefined },
    ]);
  }
  function applyPreset(name: string) {
    const preset = presets[name];
    setProfile((old) => ({ ...old, defenceStyle: preset.defenceStyle, priorities: preset.priorities }));
    setMessage(`${name} priorities loaded. Adjust anything before saving.`);
  }
  async function save() {
    setError('');
    setMessage('');
    try {
      const result = await api.saveBuildProfile(profile);
      setProfile(result.profile);
      setMessage('Build saved. New item analyses now use these priorities.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save build');
    }
  }
  async function analyzeGuide() {
    setError('');
    setMessage('');
    setImportResult(null);
    if (!profile.guideUrl) {
      setError('Paste a supported PoE 2 build URL first.');
      return;
    }
    setImporting(true);
    try {
      const result = await api.importBuildProfile(profile.guideUrl);
      setProfile(result.profile);
      setImportResult(result);
      setMessage('Build analyzed. Review the detected fields and priorities, then save it.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not analyze this build link');
    } finally {
      setImporting(false);
    }
  }
  async function remove() {
    await api.deleteBuildProfile();
    setProfile(blank);
    setMessage('Active build removed. Analysis is back to universal item quality.');
  }
  async function addReview() {
    setError('');
    try {
      const { review: created } = await api.addRaceReview(review);
      setReviews((old) => [created, ...old]);
      setReview({ title: '', cause: '', lesson: '', itemCategory: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save review');
    }
  }
  async function deleteReview(id: number) {
    await api.deleteRaceReview(id);
    setReviews((old) => old.filter((entry) => entry.id !== id));
  }
  async function addCustomProfile() {
    setError('');
    try {
      const { profile: created } = await api.createCustomBuildProfile(custom);
      setFitProfiles((old) => [...old, created]);
      setCustom(blankCustom);
      setMessage('Custom Build Fit profile saved and available in the Analyzer selector.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save custom profile');
    }
  }
  async function deleteCustomProfile(id: string) {
    await api.deleteCustomBuildProfile(id);
    setFitProfiles((old) => old.filter((entry) => entry.id !== id));
  }
  if (!loaded)
    return (
      <div className="page standard-page">
        <div className="loading">Loading build…</div>
      </div>
    );
  return (
    <div className="page standard-page build-page">
      <header className="page-header">
        <span className="eyebrow">BUILD-AWARE ITEM QUALITY</span>
        <h1>Teach the Companion your build.</h1>
        <p>
          Your class is only the beginning. Tell Exile Companion which skill, defence and gear stats matter; it will
          score every pasted item against this active profile.
        </p>
      </header>
      <div className="build-layout">
        <div className="build-main">
          <section className="card build-card">
            <div className="build-section-title">
              <Swords />
              <div>
                <h2>Build identity</h2>
                <p>
                  Import a PoE 2 build from Mobalytics, poe.ninja, Maxroll, PoE Vault or pobb.in, then review the
                  detected draft.
                </p>
              </div>
            </div>
            <div className="build-fields">
              <label>
                Build name
                <input
                  value={profile.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Ice Shot Deadeye"
                />
              </label>
              <label>
                Class
                <select
                  aria-label="Build class"
                  value={profile.className}
                  onChange={(e) => setProfile((old) => ({ ...old, className: e.target.value, ascendancy: '' }))}
                >
                  <option value="">Choose a class</option>
                  {rosterOptions(roster).map((entry) => (
                    <option key={entry.name} value={entry.name}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ascendancy
                <select
                  value={profile.ascendancy}
                  onChange={(e) => set('ascendancy', e.target.value)}
                  disabled={!profile.className}
                >
                  <option value="">{profile.className ? 'Choose an ascendancy' : 'Choose a class first'}</option>
                  {ascendanciesForRoster(profile.className, roster).map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <small className="field-note">
                  Roster {roster?.catalog?.patch ?? 'fallback'} · {roster?.status ?? 'local fallback'}
                </small>
              </label>
              <label>
                Main skill
                <input
                  value={profile.mainSkill}
                  onChange={(e) => set('mainSkill', e.target.value)}
                  placeholder="Ice Shot"
                />
              </label>
              <label>
                Progression stage
                <select value={profile.stage} onChange={(e) => set('stage', e.target.value as BuildProfile['stage'])}>
                  <option value="campaign">Campaign</option>
                  <option value="early-maps">Early maps</option>
                  <option value="endgame">Endgame</option>
                </select>
              </label>
              <label>
                Defence style
                <select
                  value={profile.defenceStyle}
                  onChange={(e) => set('defenceStyle', e.target.value as BuildProfile['defenceStyle'])}
                >
                  <option value="life-armour">Life / Armour</option>
                  <option value="life-evasion">Life / Evasion</option>
                  <option value="energy-shield">Energy Shield / CI</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              <label className="wide">
                Evaluation approach
                <select
                  value={profile.evaluationStyle || 'balanced'}
                  onChange={(e) => set('evaluationStyle', e.target.value as BuildProfile['evaluationStyle'])}
                >
                  <option value="balanced">Balanced — normal build fit</option>
                  <option value="campaign-race">Campaign race — mobility and usable damage</option>
                  <option value="hardcore-gauntlet">Hardcore / Gauntlet — required defences are safety gates</option>
                </select>
                <small className="field-note">
                  Race mode raises movement and offense weight. Gauntlet mode emphasizes defence and caps items that
                  fail a required stat.
                </small>
              </label>
              <label className="wide">
                Build URL
                <div className="guide-import-row">
                  <input
                    type="url"
                    value={profile.guideUrl}
                    onChange={(e) => set('guideUrl', e.target.value)}
                    placeholder="Mobalytics, poe.ninja, Maxroll, PoE Vault or pobb.in"
                  />
                  <button type="button" onClick={analyzeGuide} disabled={importing}>
                    {importing ? <LoaderCircle className="spin" /> : <ScanSearch />}
                    {importing ? 'Analyzing build…' : 'Analyze link'}
                  </button>
                </div>
              </label>
            </div>
          </section>
          {importResult && (
            <section className="card import-review">
              <div>
                <Check />
                <span>
                  <strong>
                    {importResult.partial
                      ? 'Build analysis incomplete — review before saving'
                      : 'Build analysis complete'}
                  </strong>
                  <small>
                    {importResult.source === 'direct'
                      ? `Read directly from ${importResult.provider}`
                      : `Read ${importResult.provider} through Jina AI Reader`}{' '}
                    · {new Date(importResult.importedAt).toLocaleString()}
                  </small>
                </span>
              </div>
              {importResult.partial && (
                <p className="warning-text">
                  This import is partial: at least one core field could not be reliably detected. It is not treated as a
                  fully successful import — confirm the flagged fields below before saving.
                </p>
              )}
              <div className="detected-tags">
                <span>{importResult.provider}</span>
                {importResult.detected.map((value) => (
                  <span key={value}>{value}</span>
                ))}
              </div>
              {importResult.warnings.map((warning) => (
                <p key={warning}>! {warning}</p>
              ))}
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Detected value</th>
                      <th>Source excerpt</th>
                      <th>Method</th>
                      <th>Confidence</th>
                      <th>Needs confirmation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(importResult.fields || []).map((f) => (
                      <tr key={f.field} className={f.needsConfirmation ? 'excluded' : ''}>
                        <td>
                          <strong>{f.field}</strong>
                        </td>
                        <td>{f.value}</td>
                        <td>{f.excerpt || '—'}</td>
                        <td>
                          <span className="tag">{importResult.method}</span>
                        </td>
                        <td>{f.confidence}</td>
                        <td>{f.needsConfirmation ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <details>
                <summary>Extracted equipment information</summary>
                <pre>{importResult.equipmentSummary}</pre>
              </details>
            </section>
          )}
          <section className="card build-card">
            <div className="build-section-title">
              <Shield />
              <div>
                <h2>Stat priorities</h2>
                <p>Requirements matter most. A custom minimum lets the result explain exactly what fell short.</p>
              </div>
            </div>
            <div className="preset-row">
              {Object.keys(presets).map((name) => (
                <button type="button" key={name} onClick={() => applyPreset(name)}>
                  {name}
                </button>
              ))}
            </div>
            <div className="priority-grid">
              {stats.map(([key, label, description]) => {
                const current = priority(key);
                return (
                  <article className={current ? `selected priority-${current.level}` : ''} key={key}>
                    <div>
                      <strong>{label}</strong>
                      <small>{description}</small>
                    </div>
                    <select
                      aria-label={`${label} priority`}
                      value={current?.level || ''}
                      onChange={(e) => setPriority(key, e.target.value as '' | BuildPriority['level'])}
                    >
                      <option value="">Ignore</option>
                      <option value="useful">Useful</option>
                      <option value="high">High</option>
                      <option value="required">Required</option>
                    </select>
                    <input
                      aria-label={`${label} minimum`}
                      type="number"
                      min="0"
                      disabled={!current}
                      value={current?.minimum ?? ''}
                      onChange={(e) => setMinimum(key, e.target.value)}
                      placeholder="Auto target"
                    />
                  </article>
                );
              })}
            </div>
          </section>
          <section className="card build-card">
            <div className="build-section-title">
              <Sparkles />
              <div>
                <h2>Build-specific modifiers</h2>
                <p>
                  Copy short phrases from the guide's Equipment Priority section. Use <b>[weapon]</b>, <b>[boots]</b>,{' '}
                  <b>[helmet]</b>, <b>[gloves]</b>, <b>[body]</b>, <b>[amulet]</b>, <b>[ring]</b>, <b>[belt]</b> or{' '}
                  <b>[jewellery]</b> to limit a line to the right slot.
                </p>
              </div>
            </div>
            <div className="mod-priority-fields">
              <label>
                Must-have modifiers
                <textarea
                  value={profile.requiredMods.join('\n')}
                  onChange={(e) => set('requiredMods', lines(e.target.value))}
                  placeholder={'[weapon] +# to level of all projectile skills\n[amulet] Spirit'}
                />
                <small>A missing must-have strongly lowers build fit for its slot.</small>
              </label>
              <label>
                Nice-to-have modifiers
                <textarea
                  value={profile.desiredMods.join('\n')}
                  onChange={(e) => set('desiredMods', lines(e.target.value))}
                  placeholder={'[weapon] increased attack speed\n[jewellery] critical damage'}
                />
                <small>These add fit without becoming a deal-breaker.</small>
              </label>
              <label className="wide">
                Notes
                <textarea
                  value={profile.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  placeholder="Spirit breakpoint, unique-item plan, resistance goal…"
                />
              </label>
            </div>
          </section>
          <section className="card build-card">
            <div className="build-section-title">
              <History />
              <div>
                <h2>Run review journal</h2>
                <p>Record what ended a run, the lesson, and the gear slot it should change.</p>
              </div>
            </div>
            <div className="review-form">
              <input
                aria-label="Review title"
                value={review.title}
                onChange={(e) => setReview({ ...review, title: e.target.value })}
                placeholder="Act 3 boss death"
              />
              <select
                aria-label="Related item category"
                value={review.itemCategory}
                onChange={(e) => setReview({ ...review, itemCategory: e.target.value })}
              >
                <option value="">Any category</option>
                {[
                  'Body Armour',
                  'Helmet',
                  'Gloves',
                  'Boots',
                  'Shield',
                  'Focus',
                  'Quiver',
                  'Ring',
                  'Amulet',
                  'Belt',
                  'Weapon',
                ].map((slot) => (
                  <option key={slot}>{slot}</option>
                ))}
              </select>
              <textarea
                aria-label="Review cause"
                value={review.cause}
                onChange={(e) => setReview({ ...review, cause: e.target.value })}
                placeholder="Cause: uncapped cold resistance…"
              />
              <textarea
                aria-label="Review lesson"
                value={review.lesson}
                onChange={(e) => setReview({ ...review, lesson: e.target.value })}
                placeholder="Lesson: require cold resistance before this fight…"
              />
              <button type="button" onClick={addReview} disabled={!review.title || !review.cause || !review.lesson}>
                Save review
              </button>
            </div>
            {reviews.length > 0 && (
              <div className="review-list">
                {reviews.map((entry) => (
                  <article key={entry.id}>
                    <div>
                      <strong>{entry.title}</strong>
                      <small>
                        {entry.itemCategory || 'General'} · {new Date(entry.createdAt).toLocaleDateString()}
                      </small>
                    </div>
                    <p>
                      <b>Cause:</b> {entry.cause}
                    </p>
                    <p>
                      <b>Lesson:</b> {entry.lesson}
                    </p>
                    <button type="button" onClick={() => deleteReview(entry.id)} aria-label={`Delete ${entry.title}`}>
                      <Trash2 />
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
          <section className="card build-card">
            <div className="build-section-title">
              <UserCog />
              <div>
                <h2>Custom Build Fit Profiles</h2>
                <p>Create selectable profiles for the Analyzer. Defaults remain available and cannot be overwritten.</p>
              </div>
            </div>
            <div className="custom-profile-form">
              <label>
                Profile name
                <input
                  aria-label="Custom profile name"
                  value={custom.name}
                  onChange={(e) => setCustom({ ...custom, name: e.target.value })}
                  placeholder="My Frost Monk"
                />
              </label>
              <label>
                Main skill
                <input
                  aria-label="Custom main skill"
                  value={custom.mainSkill}
                  onChange={(e) => setCustom({ ...custom, mainSkill: e.target.value })}
                  placeholder="Ice Strike"
                />
              </label>
              <label>
                Class
                <input
                  aria-label="Custom class"
                  value={custom.className}
                  onChange={(e) => setCustom({ ...custom, className: e.target.value })}
                  placeholder="Monk"
                />
              </label>
              <label>
                Ascendancy
                <input
                  aria-label="Custom ascendancy"
                  value={custom.ascendancy}
                  onChange={(e) => setCustom({ ...custom, ascendancy: e.target.value })}
                  placeholder="Invoker"
                />
              </label>
              <label>
                Weapon type
                <select
                  aria-label="Custom weapon type"
                  value={custom.weaponType || ''}
                  onChange={(e) =>
                    setCustom({ ...custom, weaponType: (e.target.value || undefined) as ItemCategory | undefined })
                  }
                >
                  <option value="">Any / none</option>
                  {[
                    'bow',
                    'crossbow',
                    'one-handed-melee',
                    'two-handed-melee',
                    'staff',
                    'quarterstaff',
                    'wand',
                    'sceptre',
                    'focus',
                  ].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Main damage type
                <input
                  aria-label="Custom damage type"
                  value={custom.mainDamageType}
                  onChange={(e) => setCustom({ ...custom, mainDamageType: e.target.value })}
                  placeholder="cold"
                />
              </label>
              <label className="wide">
                Defensive layer
                <input
                  aria-label="Custom defensive layer"
                  value={custom.defensiveLayer}
                  onChange={(e) => setCustom({ ...custom, defensiveLayer: e.target.value })}
                  placeholder="life, evasion"
                />
              </label>
              <label>
                Important stats
                <textarea
                  aria-label="Custom important stats"
                  value={custom.importantStats.join('\n')}
                  onChange={(e) => setCustom({ ...custom, importantStats: lines(e.target.value) })}
                  placeholder={'cold damage\nattack speed\nlife\nevasion'}
                />
              </label>
              <label>
                Bad / wasted stats
                <textarea
                  aria-label="Custom wasted stats"
                  value={custom.badStats.join('\n')}
                  onChange={(e) => setCustom({ ...custom, badStats: lines(e.target.value) })}
                  placeholder={'minion stats\nspell damage'}
                />
              </label>
              <label className="wide">
                Notes
                <textarea
                  aria-label="Custom profile notes"
                  value={custom.notes || ''}
                  onChange={(e) => setCustom({ ...custom, notes: e.target.value })}
                  placeholder="Breakpoints or special interactions…"
                />
              </label>
              <button type="button" onClick={addCustomProfile} disabled={!custom.name || !custom.className}>
                Save custom profile
              </button>
            </div>
            {fitProfiles.some((entry) => entry.source === 'custom') && (
              <div className="custom-profile-list">
                {fitProfiles
                  .filter((entry) => entry.source === 'custom')
                  .map((entry) => (
                    <article key={entry.id}>
                      <div>
                        <strong>{entry.name}</strong>
                        <small>
                          {entry.className}
                          {entry.ascendancy ? ` · ${entry.ascendancy}` : ''} · {entry.mainSkill || 'No main skill'}
                        </small>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteCustomProfile(entry.id)}
                        aria-label={`Delete custom profile ${entry.name}`}
                      >
                        <Trash2 />
                      </button>
                    </article>
                  ))}
              </div>
            )}
          </section>
          {error && <div className="error-box">{error}</div>}
          {message && (
            <div className="success-box">
              <Check />
              {message}
            </div>
          )}
          <div className="build-actions">
            <button className="primary-button" type="button" onClick={save}>
              <Save />
              Save as active build
            </button>
            <button className="secondary-button" type="button" onClick={() => setProfile(blank)}>
              <RotateCcw />
              Clear form
            </button>
            {profile.name && (
              <button className="danger-button" type="button" onClick={remove}>
                <Trash2 />
                Remove active build
              </button>
            )}
          </div>
        </div>
        <aside className="build-sidebar">
          <section className="card build-help">
            <Info />
            <h3>How the score works</h3>
            <p>
              The universal 0–100 quality grade stays independent. Your build gets a second score based only on
              priorities relevant to that item slot.
            </p>
            <ul>
              <li>Movement speed is evaluated on boots.</li>
              <li>Campaign race favors mobility and usable damage.</li>
              <li>Gauntlet favors defence and enforces required-stat gates.</li>
              <li>Must-have text must appear in the pasted item.</li>
            </ul>
          </section>
          <section className="card racer-reference">
            <Shield />
            <h3>Lessons from elite racers</h3>
            <p>
              These modes translate repeatable principles—practice, survival floors, movement efficiency and clean
              upgrade thresholds—not any player's private build or endorsement.
            </p>
            <a href="/docs#racers">
              Read the research notes <ExternalLink />
            </a>
          </section>
          <section className="card guide-reference">
            <BookOpen />
            <h3>Importing build links</h3>
            <p>
              Paste a supported link and choose Analyze link. Review uncertain fields before saving; poe.ninja snapshots
              are adapted from endgame to campaign priorities.
            </p>
            {profile.guideUrl && (
              <a href={profile.guideUrl} target="_blank" rel="noreferrer">
                Open saved build <ExternalLink />
              </a>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function priorities(values: Array<[BuildStat, BuildPriority['level']]>): BuildPriority[] {
  return values.map(([stat, level]) => ({ stat, level }));
}
function lines(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}
