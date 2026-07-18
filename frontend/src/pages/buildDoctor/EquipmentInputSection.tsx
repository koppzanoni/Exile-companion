import {
  AlertTriangle,
  Check,
  Cloud,
  Eraser,
  HeartPulse,
  Import,
  LoaderCircle,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import type { EquipmentImportPreview } from '../../equipmentImport';
import type { TranslationKey } from '../../i18n';
import type {
  BuildFitProfile,
  CharacterSummary,
  EquipmentSlotInput,
  PoeOAuthStatus,
  ReconciliationResult,
} from '../../types';

export function EquipmentInputSection({
  selectedCharacterId,
  setSelectedCharacterId,
  characters,
  importLoading,
  loadCharacter,
  loadedCharacter,
  poe,
  previewOfficialSync,
  clearEquipment,
  reconciliation,
  applyOfficialSync,
  syncApplied,
  bulkText,
  setBulkText,
  setBulkPreview,
  bulkPreview,
  previewBulkImport,
  applyBulkImport,
  buildProfiles,
  selectedBuildProfileId,
  setSelectedBuildProfileId,
  equipment,
  setSlotText,
  error,
  diagnose,
  loading,
  t,
  text,
}: {
  selectedCharacterId: string;
  setSelectedCharacterId: (id: string) => void;
  characters: CharacterSummary[];
  importLoading: boolean;
  loadCharacter: () => void;
  loadedCharacter: CharacterSummary | null;
  poe: PoeOAuthStatus | null;
  previewOfficialSync: () => void;
  clearEquipment: () => void;
  reconciliation: ReconciliationResult | null;
  applyOfficialSync: () => void;
  syncApplied: ReconciliationResult['differences'];
  bulkText: string;
  setBulkText: (value: string) => void;
  setBulkPreview: (preview: EquipmentImportPreview | null) => void;
  bulkPreview: EquipmentImportPreview | null;
  previewBulkImport: () => void;
  applyBulkImport: () => void;
  buildProfiles: BuildFitProfile[];
  selectedBuildProfileId: string;
  setSelectedBuildProfileId: (id: string) => void;
  equipment: EquipmentSlotInput[];
  setSlotText: (slot: string, itemText: string) => void;
  error: string;
  diagnose: () => void;
  loading: boolean;
  t: (key: TranslationKey) => string;
  text: (english: string, portuguese: string) => string;
}) {
  return (
    <section className="card build-card">
      <div className="build-section-title">
        <Stethoscope />
        <div>
          <h2>{t('doctor.equipment')}</h2>
          <p>{t('doctor.equipmentHelp')}</p>
        </div>
      </div>
      <div className="build-doctor-character-import">
        <div>
          <UserRound />
          <div>
            <strong>{t('doctor.saved')}</strong>
            <span>{t('doctor.savedHelp')}</span>
          </div>
        </div>
        <label>
          {t('doctor.character')}
          <select
            aria-label="Saved character"
            value={selectedCharacterId}
            onChange={(e) => setSelectedCharacterId(e.target.value)}
          >
            <option value="">{t('doctor.select')}</option>
            {characters.map((character) => (
              <option key={character.id} value={character.id}>
                {character.name} · {character.league}
                {character.level ? ` · Lv ${character.level}` : ''}
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
          {importLoading ? <LoaderCircle className="spin" /> : <HeartPulse />}
          {t('doctor.load')}
        </button>
      </div>
      {loadedCharacter && (
        <div className="build-doctor-loaded" role="status">
          <span>
            <UserRound />
            <b>{loadedCharacter.name}</b> · {loadedCharacter.league}
            {loadedCharacter.level ? ` · Level ${loadedCharacter.level}` : ''}
          </span>
          <div>
            {poe?.connections.length ? (
              <button type="button" disabled={importLoading} onClick={previewOfficialSync}>
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
                : 'Your saved equipment already matches the official character.'}
            </span>
          </div>
          {reconciliation.differences.length > 0 && (
            <div className="build-doctor-sync-list">
              {reconciliation.differences.map((diff) => (
                <span key={diff.slot}>
                  <b>{diff.slot}</b>
                  {diff.status.replace('-', ' ')}
                </span>
              ))}
            </div>
          )}
          {reconciliation.requiresConfirmation && (
            <button className="primary-button" type="button" disabled={importLoading} onClick={applyOfficialSync}>
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
            <span>{syncApplied.map((change) => `${change.slot}: ${change.status.replace('-', ' ')}`).join(' · ')}</span>
            <small>A snapshot of the previous equipment was preserved for comparison.</small>
          </div>
        </div>
      )}
      <details className="build-doctor-bulk">
        <summary>
          <Import />
          {text('Paste a complete equipment export', 'Colar uma exportação completa dos equipamentos')}
        </summary>
        <div>
          <label>
            {text('Equipment bundle', 'Conjunto de equipamentos')}
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
          <button className="secondary-button" type="button" disabled={!bulkText.trim()} onClick={previewBulkImport}>
            {text('Review import', 'Revisar importação')}
          </button>
          {bulkPreview && (
            <div className="build-doctor-import-review" role="status">
              <strong>
                {bulkPreview.equipment.length} {text('items recognized', 'itens reconhecidos')}
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
                {text('Apply recognized items', 'Aplicar itens reconhecidos')}
              </button>
            </div>
          )}
        </div>
      </details>
      <label className="build-doctor-profile">
        {t('doctor.profile')}
        <select
          aria-label="Build profile"
          value={selectedBuildProfileId}
          onChange={(e) => setSelectedBuildProfileId(e.target.value)}
        >
          {buildProfiles.length ? (
            buildProfiles.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
                {entry.source === 'custom' ? ' · Custom' : ''}
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
              placeholder={t('doctor.paste')}
            />
          </article>
        ))}
      </div>
      {error && <div className="error-box">{error}</div>}
      <div className="build-actions">
        <button className="primary-button" type="button" onClick={diagnose} disabled={loading}>
          {loading ? <LoaderCircle className="spin" /> : <HeartPulse />}
          {t('doctor.diagnose')}
        </button>
        {equipment.some((entry) => entry.itemText.trim()) && (
          <button className="secondary-button" type="button" onClick={clearEquipment}>
            <Eraser />
            {t('doctor.clear')}
          </button>
        )}
      </div>
    </section>
  );
}
