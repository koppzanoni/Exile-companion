import { Minus, Plus, ScanSearch } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

type TreeNode = {
  id: number;
  name: string | null;
  x: number;
  y: number;
  links: number[];
  stats: string[];
  type: 'normal' | 'notable' | 'keystone' | 'jewel' | 'ascendancy';
};
type TreeCatalog = { manifest: { version: string; source: string; confidence: string }; nodes: TreeNode[] };

export function PassiveAllocationMap({ nodeIds, treeVersion }: { nodeIds: number[]; treeVersion: string }) {
  const [zoom, setZoom] = useState(1),
    [query, setQuery] = useState(''),
    [catalog, setCatalog] = useState<TreeCatalog | null>(null),
    [error, setError] = useState('');
  const viewport = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  useEffect(() => {
    let active = true;
    setCatalog(null);
    setError('');
    if (treeVersion !== 'PassiveTree-0.5') {
      setError(`No exact graphical catalog is installed for ${treeVersion}.`);
      return () => {
        active = false;
      };
    }
    fetch('/data/passive-tree-0.5.json')
      .then((response) => {
        if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
        return response.json() as Promise<TreeCatalog>;
      })
      .then((data) => {
        if (active && data.manifest.version === treeVersion) setCatalog(data);
        else if (active) setError('The downloaded catalog version does not match this character.');
      })
      .catch(
        (reason) =>
          active && setError(reason instanceof Error ? reason.message : 'Could not load passive tree catalog.'),
      );
    return () => {
      active = false;
    };
  }, [treeVersion]);
  const allocated = useMemo(() => new Set(nodeIds), [nodeIds]);
  const nodes = useMemo(() => catalog?.nodes.filter((node) => allocated.has(node.id)) ?? [], [allocated, catalog]);
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const bounds = useMemo(() => {
    if (!nodes.length) return null;
    return {
      minX: Math.min(...nodes.map((n) => n.x)) - 120,
      minY: Math.min(...nodes.map((n) => n.y)) - 120,
      maxX: Math.max(...nodes.map((n) => n.x)) + 120,
      maxY: Math.max(...nodes.map((n) => n.y)) + 120,
    };
  }, [nodes]);
  const match = Number(query),
    viewBox = bounds
      ? `${bounds.minX} ${bounds.minY} ${Math.max(1, bounds.maxX - bounds.minX)} ${Math.max(1, bounds.maxY - bounds.minY)}`
      : '0 0 600 440';
  const synthetic = useMemo(
    () =>
      nodeIds.map((id, index) => {
        const ring = Math.floor(index / 18) + 1,
          position = index % 18,
          angle = (position / 18) * Math.PI * 2 + ring * 0.25;
        return { id, x: 300 + Math.cos(angle) * ring * 55, y: 220 + Math.sin(angle) * ring * 55 };
      }),
    [nodeIds],
  );
  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    viewport.current?.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
  };
  return (
    <div className="passive-map">
      <div className="passive-map-toolbar">
        <label>
          <ScanSearch />
          <span className="sr-only">Find passive node</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find node id or name" />
        </label>
        <button type="button" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.45, value - 0.15))}>
          <Minus />
        </button>
        <output aria-label="Passive tree zoom">{Math.round(zoom * 100)}%</output>
        <button type="button" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(2.5, value + 0.15))}>
          <Plus />
        </button>
        <button type="button" onClick={reset}>
          Center
        </button>
      </div>
      <div
        ref={viewport}
        className="passive-map-viewport"
        tabIndex={0}
        aria-label={`Allocated passive tree for ${treeVersion}`}
        onPointerDown={(event) => {
          drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (drag.current)
            setPan({
              x: drag.current.panX + event.clientX - drag.current.x,
              y: drag.current.panY + event.clientY - drag.current.y,
            });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <svg
          viewBox={viewBox}
          role="img"
          aria-labelledby="passive-map-title"
          style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})` }}
        >
          <title id="passive-map-title">
            {catalog ? 'Exact allocated passive tree' : 'Safe allocation fallback'} with {nodeIds.length} node ids
          </title>
          {catalog ? (
            <>
              <g className="passive-map-links">
                {nodes.flatMap((node) =>
                  node.links
                    .filter((id) => id > node.id && byId.has(id))
                    .map((id) => (
                      <line
                        key={`${node.id}-${id}`}
                        x1={node.x}
                        y1={node.y}
                        x2={byId.get(id)!.x}
                        y2={byId.get(id)!.y}
                      />
                    )),
                )}
              </g>
              <g>
                {nodes.map((node) => {
                  const found = query && `${node.id} ${node.name ?? ''}`.toLowerCase().includes(query.toLowerCase());
                  return (
                    <g key={node.id} className={`${node.type} ${found ? 'is-match' : ''}`}>
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={
                          node.type === 'keystone'
                            ? 55
                            : node.type === 'notable'
                              ? 38
                              : node.type === 'ascendancy'
                                ? 34
                                : node.type === 'jewel'
                                  ? 30
                                  : 22
                        }
                      />
                      <title>
                        {node.name ?? `Node ${node.id}`} — {node.stats.join('; ') || 'No description in source export'}
                      </title>
                    </g>
                  );
                })}
              </g>
            </>
          ) : (
            <>
              <g className="passive-map-links">
                {synthetic.slice(1).map((node, index) => (
                  <line key={node.id} x1={synthetic[index].x} y1={synthetic[index].y} x2={node.x} y2={node.y} />
                ))}
              </g>
              <g>
                {synthetic.map((node) => (
                  <g key={node.id} className={match === node.id ? 'is-match' : ''}>
                    <circle cx={node.x} cy={node.y} r={match === node.id ? 10 : 6} />
                    <title>Allocated node {node.id}; name unavailable without an exact catalog</title>
                  </g>
                ))}
              </g>
            </>
          )}
        </svg>
      </div>
      <p className="profile-coverage-note">
        {catalog ? (
          <>
            Exact {treeVersion} topology from the version-pinned{' '}
            <a href={catalog.manifest.source} target="_blank" rel="noreferrer">
              GGG public export
            </a>
            . Drag to pan; zoom, search and hover nodes for details.
          </>
        ) : (
          <>Safe allocation map — positions show preserved ids, not official topology. {error}</>
        )}
      </p>
    </div>
  );
}
