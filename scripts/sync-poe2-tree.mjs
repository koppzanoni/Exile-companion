import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SOURCE = 'https://raw.githubusercontent.com/grindinggear/poe2-skilltree-export/main/data.json';
const VERSION = 'PassiveTree-0.5';
const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`Could not download ${SOURCE}: ${response.status}`);
const sourceText = await response.text();
const source = JSON.parse(sourceText);
if (!source?.nodes || !source?.groups) throw new Error('The GGG export does not contain nodes and groups.');

const nodes = Object.entries(source.nodes).flatMap(([key, node]) => {
  if (!node || typeof node !== 'object' || typeof node.x !== 'number' || typeof node.y !== 'number') return [];
  return [
    {
      id: Number(node.skill ?? key),
      name: node.name ?? null,
      x: node.x,
      y: node.y,
      links: [...(node.out ?? []), ...(node.in ?? [])].map(Number).filter(Number.isFinite),
      stats: Array.isArray(node.stats) ? node.stats : [],
      type: node.isKeystone
        ? 'keystone'
        : node.isJewelSocket
          ? 'jewel'
          : node.ascendancyId
            ? 'ascendancy'
            : node.isNotable
              ? 'notable'
              : 'normal',
    },
  ];
});
if (nodes.length < 1000) throw new Error(`Refusing incomplete tree export with ${nodes.length} positioned nodes.`);
const payload = {
  manifest: {
    kind: 'passive-tree',
    patch: '0.5',
    version: VERSION,
    source: SOURCE,
    updatedAt: new Date().toISOString(),
    confidence: 'High',
    sourceSha256: createHash('sha256').update(sourceText).digest('hex'),
  },
  bounds: { minX: source.min_x, maxX: source.max_x, minY: source.min_y, maxY: source.max_y },
  nodes,
};
const output = path.resolve('frontend/public/data/passive-tree-0.5.json');
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(payload));
console.log(`Wrote ${nodes.length} validated nodes to ${output}`);
