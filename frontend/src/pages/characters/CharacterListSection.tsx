import { Trash2, UserCircle2, Users } from 'lucide-react';
import type { CharacterSummary } from '../../types';

export function CharacterListSection({
  characters,
  selectCharacter,
  removeCharacter,
  text,
}: {
  characters: CharacterSummary[];
  selectCharacter: (id: number) => void;
  removeCharacter: (id: number) => void;
  text: (english: string, portuguese: string) => string;
}) {
  return (
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
  );
}
