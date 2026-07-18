import { LoaderCircle, Save, UserCircle2 } from 'lucide-react';
import { ascendanciesForRoster, rosterOptions, type RosterResponse } from '../../poeClasses';
import type { CharacterInput } from '../../types';

export function CharacterFormSection({
  selectedId,
  form,
  setForm,
  roster,
  loading,
  saveCharacter,
  createCharacter,
  text,
}: {
  selectedId: number | null;
  form: CharacterInput;
  setForm: (form: CharacterInput) => void;
  roster: RosterResponse | null;
  loading: boolean;
  saveCharacter: () => void;
  createCharacter: () => void;
  text: (english: string, portuguese: string) => string;
}) {
  return (
    <section className="card build-card" data-tab-group="overview">
      <div className="build-section-title">
        <UserCircle2 />
        <div>
          <h2>{selectedId ? text('Edit character', 'Editar personagem') : text('New character', 'Novo personagem')}</h2>
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
            onChange={(e) => setForm({ ...form, level: e.target.value ? Number(e.target.value) : undefined })}
          />
        </label>
        <label>
          {text('Class', 'Classe')}
          <select
            aria-label={text('Character class', 'Classe do personagem')}
            value={form.className || ''}
            onChange={(e) => setForm({ ...form, className: e.target.value, ascendancy: '' })}
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
            onChange={(e) => setForm({ ...form, stage: e.target.value as CharacterInput['stage'] })}
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
            onChange={(e) => setForm({ ...form, budget: e.target.value ? Number(e.target.value) : undefined })}
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
          <button className="primary-button" type="button" onClick={createCharacter} disabled={loading || !form.name}>
            {loading ? <LoaderCircle className="spin" /> : <Save />}
            {text('Create character', 'Criar personagem')}
          </button>
        )}
      </div>
    </section>
  );
}
