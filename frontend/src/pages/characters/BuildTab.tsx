import { Check, Save, UserCircle2 } from 'lucide-react';
import type { CharacterBuildKnowledge, CharacterBuildLoadout, LoadoutSimulation } from '../../types';

export function BuildTab({
  loadout,
  setLoadout,
  skillsText,
  setSkillsText,
  passivesText,
  setPassivesText,
  simulateLoadout,
  saveLoadout,
  simulation,
  knowledge,
  text,
}: {
  loadout: CharacterBuildLoadout;
  setLoadout: (loadout: CharacterBuildLoadout) => void;
  skillsText: string;
  setSkillsText: (value: string) => void;
  passivesText: string;
  setPassivesText: (value: string) => void;
  simulateLoadout: () => void;
  saveLoadout: () => void;
  simulation: LoadoutSimulation | null;
  knowledge: CharacterBuildKnowledge | null;
  text: (english: string, portuguese: string) => string;
}) {
  return (
    <section className="card build-card" data-tab-group="build">
      <div className="build-section-title">
        <UserCircle2 />
        <div>
          <h2>{text('Build loadout and mechanics', 'Configuração e mecânicas da build')}</h2>
          <p>
            {text(
              'Record skills, supports, weapon and key passives with explicit patch and source.',
              'Registre skills, supports, arma e passivas principais com patch e fonte explícitos.',
            )}
          </p>
        </div>
      </div>
      <div className="build-fields">
        <label>
          Patch
          <input
            aria-label="Loadout patch"
            value={loadout.patch}
            onChange={(e) => setLoadout({ ...loadout, patch: e.target.value })}
            placeholder="0.3.0"
          />
        </label>
        <label>
          Source
          <select
            aria-label="Loadout source"
            value={loadout.source}
            onChange={(e) =>
              setLoadout({
                ...loadout,
                source: e.target.value as CharacterBuildLoadout['source'],
              })
            }
          >
            <option value="manual">Manual</option>
            <option value="poe-api">PoE API</option>
            <option value="imported">Imported guide</option>
          </select>
        </label>
        <label>
          Confidence
          <select
            aria-label="Loadout confidence"
            value={loadout.confidence}
            onChange={(e) =>
              setLoadout({
                ...loadout,
                confidence: e.target.value as CharacterBuildLoadout['confidence'],
              })
            }
          >
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </label>
        <label>
          Main skill
          <input
            aria-label="Main skill"
            value={loadout.mainSkill}
            onChange={(e) => setLoadout({ ...loadout, mainSkill: e.target.value })}
          />
        </label>
        <label>
          Weapon set
          <input
            aria-label="Weapon set"
            value={loadout.weaponSet}
            onChange={(e) => setLoadout({ ...loadout, weaponSet: e.target.value })}
            placeholder="Bow, Quarterstaff..."
          />
        </label>
        <label>
          Available Spirit
          <input
            aria-label="Available Spirit"
            type="number"
            min="0"
            value={loadout.availableSpirit ?? ''}
            onChange={(e) =>
              setLoadout({
                ...loadout,
                availableSpirit: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </label>
        <label className="wide">
          Skills and supports
          <textarea
            aria-label="Skills and supports"
            rows={5}
            value={skillsText}
            onChange={(e) => setSkillsText(e.target.value)}
            placeholder="Ice Shot | Cold Infusion, Martial Tempo | 30"
          />
          <small>One per line: Skill | supports separated by comma | Spirit reservation</small>
        </label>
        <label className="wide">
          Key passives
          <textarea
            aria-label="Key passives"
            rows={3}
            value={passivesText}
            onChange={(e) => setPassivesText(e.target.value)}
            placeholder="Acrobatics&#10;Point Blank"
          />
        </label>
      </div>
      <div className="build-actions">
        <button className="secondary-button" type="button" onClick={simulateLoadout}>
          Simulate without saving
        </button>
        <button className="primary-button" type="button" onClick={saveLoadout}>
          <Save />
          Save and analyze loadout
        </button>
      </div>
      {simulation && (
        <div className={simulation.safe ? 'success-box' : 'error-box'}>
          <Check />
          <div>
            <strong>{simulation.verdict}</strong>
            <p>
              Spirit change: {simulation.spiritDelta > 0 ? '+' : ''}
              {simulation.spiritDelta}. {simulation.newWarnings.join(' ')}
            </p>
          </div>
        </div>
      )}
      {knowledge && (
        <>
          <div className="market-search-meta">
            <span>
              <small>Reserved Spirit</small>
              <b>{knowledge.analysis.reservedSpirit}</b>
            </span>
            <span>
              <small>Remaining</small>
              <b>{knowledge.analysis.remainingSpirit ?? 'Unknown'}</b>
            </span>
            <span>
              <small>Local sample</small>
              <b>{knowledge.similar.sampleSize}</b>
            </span>
            <span>
              <small>Similarity confidence</small>
              <b>{knowledge.similar.confidence}</b>
            </span>
          </div>
          {knowledge.analysis.warnings.length > 0 && (
            <div className="category-warnings">
              {knowledge.analysis.warnings.map((warning) => (
                <span key={warning}>{warning}</span>
              ))}
            </div>
          )}
          <div className="review-list">
            {knowledge.similar.matches.map((match) => (
              <article key={match.profileId}>
                <div>
                  <strong>
                    {match.name} · {match.score}%
                  </strong>
                  <small>{match.reasons.join(', ')}</small>
                </div>
              </article>
            ))}
          </div>
          <p>
            <small>
              Patch {knowledge.provenance.patch} · source {knowledge.provenance.source} · confidence{' '}
              {knowledge.provenance.confidence}. {knowledge.similar.limitation}
            </small>
          </p>
        </>
      )}
    </section>
  );
}
