import { Award, Cloud, GitBranch, LoaderCircle, RefreshCw, ScrollText, UserCircle2, Zap } from 'lucide-react';
import { PassiveAllocationMap } from '../../components/PassiveAllocationMap';
import { PublicProfileTimeline } from '../../components/PublicProfileTimeline';
import type { ProfileCatalogStatus, ProfileDiagnostic, PublicCharacterProfile } from '../../types';

export function ProfileTab({
  selectedId,
  poeNinjaUrl,
  setPoeNinjaUrl,
  profileLoading,
  importPublicProfile,
  publicProfile,
  profileCatalogs,
  profileDiagnostics,
  text,
  formatDateTime,
}: {
  selectedId: number;
  poeNinjaUrl: string;
  setPoeNinjaUrl: (value: string) => void;
  profileLoading: boolean;
  importPublicProfile: () => void;
  publicProfile: PublicCharacterProfile | null;
  profileCatalogs: ProfileCatalogStatus | null;
  profileDiagnostics: ProfileDiagnostic[];
  text: (english: string, portuguese: string) => string;
  formatDateTime: (value: string) => string;
}) {
  return (
    <section className="card build-card public-profile-panel" data-tab-group="profile">
      <div className="build-section-title">
        <Cloud />
        <div>
          <h2>{text('poe.ninja character profile', 'Perfil de personagem do poe.ninja')}</h2>
          <p>
            Import the public character dossier without requiring your PoE credentials. Existing local equipment is not
            overwritten.
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
                {publicProfile.updatedAt ? formatDateTime(publicProfile.updatedAt) : text('Unknown', 'Desconhecida')}
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
                {publicProfile.passives.treeVersion} · {publicProfile.passives.nodeIds.length} node ids preserved
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
                <p>{text('No named keystones were returned.', 'Nenhuma keystone identificada foi retornada.')}</p>
              )}
            </article>
            <article>
              <h3>
                <ScrollText />
                {text('Quest rewards', 'Recompensas de quests')}
              </h3>
              <small>
                {publicProfile.questRewards.claimed.length} {text('confirmed rewards', 'recompensas confirmadas')}
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
                      <span>{item.modifiers.slice(0, 4).join(' · ') || 'No normalized modifiers returned'}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p>
                  {publicProfile.equipmentCount} public item records were reported, but this saved snapshot predates
                  rich item normalization. Re-import to refresh it.
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
                  <article className={`profile-finding ${finding.severity}`} key={`${finding.category}-${index}`}>
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
  );
}
