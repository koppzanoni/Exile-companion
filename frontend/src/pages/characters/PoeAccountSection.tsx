import { Cloud, LoaderCircle, RefreshCw } from 'lucide-react';
import type { PoeOAuthStatus, PoeRemoteCharacter } from '../../types';

export function PoeAccountSection({
  poe,
  remoteCharacters,
  syncing,
  loadRemote,
  importRemote,
  connectPoe,
  text,
}: {
  poe: PoeOAuthStatus | null;
  remoteCharacters: PoeRemoteCharacter[];
  syncing: boolean;
  loadRemote: (connectionId: number) => void;
  importRemote: (connectionId: number, name: string) => void;
  connectPoe: () => void;
  text: (english: string, portuguese: string) => string;
}) {
  return (
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
  );
}
