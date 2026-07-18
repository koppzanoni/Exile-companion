import {
  AlertTriangle,
  ExternalLink,
  HeartPulse,
  LoaderCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Target,
  TestTube2,
  UserRound,
} from 'lucide-react';
import type { BuildDoctorResult, BuildSwapSimulation, CharacterSummary, EquipmentSlotInput } from '../../types';

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

export function DiagnosisResultSection({
  result,
  text,
  diagnosticText,
  activeSlot,
  setActiveSlot,
  candidateItemText,
  setCandidateItemText,
  simulation,
  setSimulation,
  tolerance,
  setTolerance,
  findUpgrade,
  simulateSwap,
  toolLoading,
  equipment,
  loadedCharacter,
}: {
  result: BuildDoctorResult;
  text: (english: string, portuguese: string) => string;
  diagnosticText: (entry: {
    code?: string;
    params?: Record<string, string | number>;
    original?: string;
    message?: string;
  }) => string;
  activeSlot: string;
  setActiveSlot: (slot: string) => void;
  candidateItemText: string;
  setCandidateItemText: (value: string) => void;
  simulation: BuildSwapSimulation | null;
  setSimulation: (simulation: BuildSwapSimulation | null) => void;
  tolerance: number;
  setTolerance: (value: number) => void;
  findUpgrade: () => void;
  simulateSwap: () => void;
  toolLoading: boolean;
  equipment: EquipmentSlotInput[];
  loadedCharacter: CharacterSummary | null;
}) {
  return (
    <section className="card build-card" data-testid="build-doctor-result">
      <div className="build-doctor-executive">
        <div className="build-doctor-executive-head">
          <div>
            <span className="eyebrow">{text('EXECUTIVE DIAGNOSIS', 'DIAGNÓSTICO EXECUTIVO')}</span>
            <h2>{text('Your next decisions', 'Suas próximas decisões')}</h2>
          </div>
          <span
            className={`build-doctor-confidence ${result.profile.equipmentCoverage.percent >= 80 ? 'high' : result.profile.equipmentCoverage.percent >= 40 ? 'medium' : 'low'}`}
          >
            {result.profile.equipmentCoverage.percent}% {text('equipment coverage', 'de cobertura dos equipamentos')}
          </span>
        </div>
        <div className="build-doctor-critical-grid">
          <article>
            <AlertTriangle />
            <small>{text('TOP PROBLEM', 'PROBLEMA PRINCIPAL')}</small>
            <strong>
              {result.profile.gaps[0] || text('No critical tracked gap found.', 'Nenhuma falha crítica identificada.')}
            </strong>
          </article>
          <article>
            <Target />
            <small>{text('NEXT UPGRADE', 'PRÓXIMO UPGRADE')}</small>
            <strong>
              {result.recommendedUpgradeOrder[0]?.slot ||
                text('No priority available', 'Nenhuma prioridade disponível')}
            </strong>
            <span>{result.profile.nextMove}</span>
          </article>
          <article>
            <ShieldCheck />
            <small>{text('SWAP RISK', 'RISCO DA TROCA')}</small>
            <strong>
              {result.alerts.length
                ? `${result.alerts.length} ${text('dependency warnings', 'alertas de dependência')}`
                : text('No tracked dependency warning', 'Nenhum alerta de dependência')}
            </strong>
          </article>
        </div>
      </div>
      {result.offenceResult && (
        <div className="doctor-offence-summary" data-testid="build-doctor-offence">
          <div>
            <small>{text('VERSIONED OFFENCE', 'OFENSIVA VERSIONADA')}</small>
            <strong>
              {result.offenceResult.skillName} · {result.offenceResult.patch}
            </strong>
            <span>{result.offenceResult.mechanicCoverage.reason}</span>
          </div>
          <div>
            <small>{text('SUSTAINED DPS', 'DPS SUSTENTADO')}</small>
            <strong>{result.offenceResult.sustainedDps ?? text('Withheld', 'NÃ£o exibido')}</strong>
            <span>
              {result.offenceResult.confidence} · {result.offenceResult.mechanicCoverage.status}
            </span>
          </div>
          <div>
            <small>{text('MISSING INPUTS', 'DADOS AUSENTES')}</small>
            <strong>{result.offenceResult.missingInputs.length}</strong>
            <span>{result.offenceResult.missingInputs.slice(0, 2).join(' · ') || text('None', 'Nenhum')}</span>
          </div>
        </div>
      )}
      {result.rosterCompatibility && result.spiritFeasibility && (
        <section className="card deterministic-offence" data-testid="doctor-foundations">
          <div className="doctor-summary-grid">
            <div>
              <small>{text('ROSTER CATALOG', 'CATÁLOGO DO ROSTER')}</small>
              <strong>
                {result.rosterCompatibility.catalogPatch} · {result.rosterCompatibility.status}
              </strong>
              <span>
                {result.rosterCompatibility.recognized
                  ? text('Class and ascendancy recognized', 'Classe e ascendência reconhecidas')
                  : result.rosterCompatibility.issues.join(' ')}
              </span>
            </div>
            <div>
              <small>SPIRIT · SET {result.spiritFeasibility.weaponSet ?? '?'}</small>
              <strong>
                {result.spiritFeasibility.valid === null
                  ? text('Unknown', 'Desconhecido')
                  : result.spiritFeasibility.valid
                    ? text('Valid', 'Válido')
                    : text('Broken', 'Inválido')}
              </strong>
              <span>
                {result.spiritFeasibility.availableSpirit ?? '?'} / {result.spiritFeasibility.reservedSpirit ?? '?'}
              </span>
            </div>
            <div>
              <small>{text('ASCENDANCY COVERAGE', 'COBERTURA DA ASCENDÊNCIA')}</small>
              <strong>
                {result.ascendancyMechanicModeled === false
                  ? text('Not modeled', 'Não modelado')
                  : (result.ascendancyMechanicCoverage?.length ?? 0)}
              </strong>
              <span>
                {result.ascendancyMechanicModeled === false
                  ? text(
                      'no dedicated package for this ascendancy yet',
                      'ainda sem pacote dedicado para esta ascendência',
                    )
                  : `${result.ascendancyMechanicCoverage?.filter((entry) => entry.status === 'unknown').length ?? 0} ${text('unknown components', 'componentes desconhecidos')}`}
              </span>
            </div>
          </div>
          {result.criticalRegressions && result.criticalRegressions.length > 0 && (
            <div className="category-warnings">
              {result.criticalRegressions.map((line) => (
                <span key={line}>
                  <AlertTriangle />
                  {line}
                </span>
              ))}
            </div>
          )}
          {result.transitionBundle && !result.transitionBundle.complete && (
            <p>
              <strong>{text('Transition blocked:', 'Transição bloqueada:')}</strong> {result.transitionBundle.reason}
            </p>
          )}
        </section>
      )}
      <div className={`profile-analysis-hero ${result.profile.status.toLowerCase().replace(' ', '-')}`}>
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
            {result.profile.build.ascendancy ? ` · ${result.profile.build.ascendancy}` : ''} ·{' '}
            {result.profile.build.mainSkill || 'No main skill'} · {result.profile.build.stage}
          </p>
          <div className="profile-tags">
            {[...result.profile.build.damageTypes, ...result.profile.build.defensiveLayers].map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </div>
        <div className="profile-coverage">
          <small>EQUIPMENT READ</small>
          <strong>
            {result.profile.equipmentCoverage.filled}/{result.profile.equipmentCoverage.total}
          </strong>
          <span>{result.profile.equipmentCoverage.percent}% coverage</span>
        </div>
      </div>
      <div className="profile-insights">
        <article>
          <h3>
            <ShieldCheck />
            What is working
          </h3>
          {result.profile.strengths.length ? (
            result.profile.strengths.map((line) => <span key={line}>+ {line}</span>)
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
            result.profile.gaps.map((line) => <span key={line}>− {line}</span>)
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
          <h2>{text('Character totals', 'Totais do personagem')}</h2>
          <p>{text('Computed from every pasted slot combined.', 'Calculados combinando todos os slots informados.')}</p>
        </div>
      </div>
      <div className="market-search-meta">
        {Object.entries(result.resistances.current).map(([key, value]) => (
          <span key={key}>
            <small>{key.replace(/Resistance/i, ' RES').toUpperCase()}</small>
            <b>
              {value}% ({result.resistances.missing[key]}% to cap)
            </b>
          </span>
        ))}
      </div>
      <div className="market-search-meta">
        {Object.entries(result.attributes.total).map(([key, value]) => (
          <span key={key}>
            <small>{key.toUpperCase()}</small>
            <b>
              {value}
              {result.attributes.required[key] ? ` / ${result.attributes.required[key]} needed` : ''}{' '}
              {result.attributes.met[key] ? '' : '⚠'}
            </b>
          </span>
        ))}
        <span>
          <small>SPIRIT</small>
          <b>
            {result.spirit.current}
            {result.spirit.required ? ` / ${result.spirit.required} target` : ''}
            {result.spirit.missing ? ` · ${result.spirit.missing} missing` : ''}
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
          <strong style={{ padding: '0 22px' }}>{text('Swap safety alerts', 'Alertas de segurança da troca')}</strong>
          {result.alerts.map((a) => (
            <span key={a.slot + a.message}>
              <AlertTriangle />
              {diagnosticText(a)}
            </span>
          ))}
        </div>
      )}

      <div className="build-doctor-paperdoll" aria-label="Visual equipment overview">
        <div className="paperdoll-avatar">
          <UserRound />
          <strong>{loadedCharacter?.name || 'Current build'}</strong>
          <span>Click a slot to inspect it</span>
        </div>
        {slotNames.map((slot) => {
          const data = result.slots.find((entry) => entry.slot === slot);
          const score = data?.overallScore ?? null;
          const strength = score === null ? 'empty' : score < 45 ? 'weak' : score < 70 ? 'possible' : 'strong';
          return (
            <button
              type="button"
              key={slot}
              className={`paperdoll-slot slot-${slot.toLowerCase().replace(/\s+/g, '-')} ${strength} ${activeSlot === slot ? 'active' : ''}`}
              onClick={() => {
                setActiveSlot(slot);
                setCandidateItemText('');
                setSimulation(null);
              }}
              aria-label={`${slot}: ${data?.baseType || 'Empty'}, ${score === null ? 'not scored' : `${score} score`}`}
            >
              <small>{slot}</small>
              <strong>{data?.baseType || 'Empty'}</strong>
              <span>{score === null ? '—' : score}</span>
            </button>
          );
        })}
      </div>

      <div className="build-fit-section">
        <div className="build-fit-title">
          <Target />
          <div>
            <h3>{text('Equipment heatmap', 'Mapa de qualidade dos equipamentos')}</h3>
            <p>
              {text(
                'Select a slot to search for upgrades or simulate a replacement.',
                'Selecione um slot para buscar upgrades ou simular uma substituição.',
              )}
            </p>
          </div>
        </div>
        <div className="equipment-heatmap">
          {slotNames.map((slot) => {
            const data = result.slots.find((entry) => entry.slot === slot);
            const score = data?.overallScore ?? null;
            const level = score === null ? 'empty' : score < 45 ? 'weak' : score < 70 ? 'possible' : 'strong';
            return (
              <button
                type="button"
                key={slot}
                className={`${level} ${activeSlot === slot ? 'active' : ''}`}
                onClick={() => {
                  setActiveSlot(slot);
                  setCandidateItemText('');
                  setSimulation(null);
                }}
              >
                <span>{slot}</span>
                <strong>{score === null ? '—' : score}</strong>
                <small>{data?.baseType || 'Empty slot'}</small>
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
                {text('Search quality', 'Qualidade da busca')} <strong>{tolerance}%</strong>
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
              70–90% finds cheaper alternatives, 100% keeps similar values, and 105–120% asks for a stricter upgrade.
            </p>
            <div className="upgrade-actions">
              <button
                type="button"
                onClick={findUpgrade}
                disabled={toolLoading || !equipment.find((entry) => entry.slot === activeSlot)?.itemText}
              >
                <Search />
                {text('Find upgrade on Trade2', 'Buscar upgrade no Trade2')} <ExternalLink />
              </button>
            </div>
            <label>
              {text('Candidate item to simulate', 'Item candidato para simular')}
              <textarea
                aria-label={text('Candidate item to simulate', 'Item candidato para simular')}
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
              {toolLoading ? <LoaderCircle className="spin" /> : <TestTube2 />}
              {text('Simulate swap', 'Simular troca')}
            </button>
            {simulation && (
              <div className={`swap-simulation ${simulation.verdict.toLowerCase().replace(/ /g, '-')}`}>
                <div>
                  <small>{text('SIMULATION RESULT', 'RESULTADO DA SIMULAÇÃO')}</small>
                  <h3>{simulation.verdict}</h3>
                  <strong>
                    {simulation.beforeScore} → {simulation.afterScore}{' '}
                    <em>
                      {simulation.scoreDelta >= 0 ? '+' : ''}
                      {simulation.scoreDelta}
                    </em>
                  </strong>
                </div>
                {simulation.resolvedGaps.length > 0 && (
                  <p>
                    <b>Resolved:</b> {simulation.resolvedGaps.join(' · ')}
                  </p>
                )}
                {simulation.newGaps.length > 0 && (
                  <p className="danger">
                    <b>New risks:</b> {simulation.newGaps.join(' · ')}
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
            <h3>{text('Slot diagnosis', 'Diagnóstico por slot')}</h3>
            <p>
              {text(
                'Stat-valuation score per slot, weakest first.',
                'Pontuação dos atributos por slot, começando pelo mais fraco.',
              )}
            </p>
          </div>
        </div>
        <div className="build-fit-grid">
          {[...result.slots]
            .filter((s) => s.baseType)
            .sort((a, b) => (a.overallScore ?? 0) - (b.overallScore ?? 0))
            .map((s) => (
              <article
                key={s.slot}
                className={`build-fit ${result.weakestSlots.includes(s.slot) ? 'weak' : (s.overallScore ?? 0) >= 68 ? 'strong' : 'possible'}`}
              >
                <div>
                  <strong>{s.slot}</strong>
                  <span>{s.baseType}</span>
                </div>
                <div className="fit-meter">
                  <i style={{ width: `${s.overallScore ?? 0}%` }} />
                </div>
                <b>{s.overallScore ?? 0}%</b>
                {s.wastedStats.length > 0 && <small>Wasted: {s.wastedStats.join(', ')}</small>}
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
                        <p key={`${entry.stat}-${entry.value}`} className={entry.wasted ? 'wasted' : ''}>
                          <b>
                            {entry.stat} {entry.value > 0 ? `+${entry.value}` : entry.value}
                          </b>
                          <em>
                            {entry.category} · {entry.score} pts
                          </em>
                          <span>
                            {entry.reason}
                            {entry.conditional ? ' Conditional on the current build state.' : ''}
                          </span>
                        </p>
                      ))
                    ) : (
                      <p>
                        <span>No recognized stat contributions for this slot.</span>
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
              → {entry.slot} ({entry.budgetPriority} priority): {entry.reason}
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
  );
}
