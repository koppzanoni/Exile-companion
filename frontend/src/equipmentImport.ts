import type { EquipmentSlotInput } from './types';

export interface EquipmentImportPreview {
  equipment: EquipmentSlotInput[];
  rejected: Array<{ itemClass: string; reason: string; itemText: string }>;
}

const directSlots: Record<string, string> = {
  boots: 'Boots',
  gloves: 'Gloves',
  helmets: 'Helmet',
  helmet: 'Helmet',
  'body armours': 'Body Armour',
  'body armour': 'Body Armour',
  belts: 'Belt',
  belt: 'Belt',
  amulets: 'Amulet',
  amulet: 'Amulet',
  shields: 'Offhand',
  shield: 'Offhand',
  quivers: 'Offhand',
  quiver: 'Offhand',
  foci: 'Offhand',
  focus: 'Offhand',
  bucklers: 'Offhand',
};
const weaponClasses =
  /^(bows|crossbows|wands|staves|quarterstaves|sceptres|maces|axes|swords|flails|spears|daggers|claws)$/i;

export function parseEquipmentBundle(raw: string): EquipmentImportPreview {
  const chunks = raw
    .replace(/\r/g, '')
    .split(/(?=^Item Class:\s*)/gim)
    .map((value) => value.trim())
    .filter(Boolean);
  const equipment: EquipmentSlotInput[] = [];
  const rejected: EquipmentImportPreview['rejected'] = [];
  let ring = 0,
    weapon = 0;
  for (const itemText of chunks) {
    const itemClass = itemText.match(/^Item Class:\s*(.+)$/im)?.[1]?.trim() || '';
    const normalized = itemClass.toLowerCase();
    let slot = directSlots[normalized];
    if (/^rings?$/i.test(itemClass)) slot = ring++ === 0 ? 'Ring 1' : ring === 2 ? 'Ring 2' : '';
    else if (weaponClasses.test(itemClass)) slot = weapon++ === 0 ? 'Weapon' : weapon === 2 ? 'Offhand' : '';
    if (!itemClass) rejected.push({ itemClass: 'Unknown', reason: 'Missing Item Class line.', itemText });
    else if (!slot)
      rejected.push({
        itemClass,
        reason: /^rings?$/i.test(itemClass)
          ? 'Only two ring slots are supported.'
          : weaponClasses.test(itemClass)
            ? 'Only two weapon slots are supported.'
            : 'This Item Class has no safe equipment-slot mapping.',
        itemText,
      });
    else if (equipment.some((entry) => entry.slot === slot))
      rejected.push({ itemClass, reason: `Slot ${slot} was already filled by another item.`, itemText });
    else equipment.push({ slot, itemText });
  }
  return { equipment, rejected };
}
