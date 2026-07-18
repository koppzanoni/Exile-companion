import { UserCircle2 } from 'lucide-react';
import type { EquipmentSlotInput } from '../../types';

export function EquipmentTab({
  equipment,
  setSlotText,
  text,
}: {
  equipment: EquipmentSlotInput[];
  setSlotText: (slot: string, itemText: string) => void;
  text: (english: string, portuguese: string) => string;
}) {
  return (
    <section className="card build-card" data-tab-group="equipment">
      <div className="build-section-title">
        <UserCircle2 />
        <div>
          <h2>{text('Equipment', 'Equipamentos')}</h2>
          <p>Saved once here, reused everywhere — Build Doctor, leveling, and item analysis.</p>
        </div>
      </div>
      <div className="priority-grid">
        {equipment.map((entry) => (
          <article key={entry.slot}>
            <div>
              <strong>{entry.slot}</strong>
            </div>
            <textarea
              aria-label={`${entry.slot} ${text('item text', 'texto do item')}`}
              rows={3}
              value={entry.itemText}
              onChange={(e) => setSlotText(entry.slot, e.target.value)}
              placeholder="Paste exported item text…"
            />
          </article>
        ))}
      </div>
    </section>
  );
}
