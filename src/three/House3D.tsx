// The design as 3D meshes. Plan (x, y) maps to world (x, z); y is up. Feet.
import { useMemo } from 'react';
import * as THREE from 'three';
import { FURNITURE, ROOM_TYPES } from '../model/catalog';
import { outlinePolygon, storyBounds, wallLength } from '../model/geometry';
import type { Design, Opening, Story, Wall } from '../model/types';
import { pitchedRoof, type V3 } from './roof-geometry';

export const SLAB_FT = 0.67; // floor system depth between stories
export const RAISED_FT = 7; // a raised Guyana house sits about this high

export const storyElevation = (design: Design, i: number) =>
  (design.foundation === 'raised' ? RAISED_FT : 0.5) + i * (design.wallHeightFt + SLAB_FT);

interface Props {
  design: Design;
  /** Stories above this index are hidden (to look inside). null = show all. */
  cutaway: number | null;
  showRoof: boolean;
}

export function House3D({ design, cutaway, showRoof }: Props) {
  const visible = cutaway == null ? design.stories.length : cutaway + 1;
  const top = design.stories[design.stories.length - 1];
  // Lift the roof a little so its surface does not cut through the wall tops.
  const topY = storyElevation(design, design.stories.length - 1) + design.wallHeightFt + 0.2;
  return (
    <group>
      {design.foundation === 'raised' && <Piers design={design} />}
      {design.stories.slice(0, visible).map((s, i) => (
        <StoryMeshes key={s.id} design={design} story={s} index={i} />
      ))}
      {showRoof && cutaway == null && top && <Roof design={design} story={top} topY={topY} />}
    </group>
  );
}

function StoryMeshes({ design, story, index }: { design: Design; story: Story; index: number }) {
  const y0 = storyElevation(design, index);
  return (
    <group>
      <Floor story={story} y={y0} />
      {story.rooms.map((r) => (
        <mesh key={r.id} position={[r.x + r.w / 2, y0 + 0.02, r.y + r.h / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[r.w, r.h]} />
          <meshStandardMaterial color={ROOM_TYPES[r.type].color} roughness={0.9} />
        </mesh>
      ))}
      {story.walls.map((w) => (
        <WallMesh key={w.id} design={design} wall={w} openings={story.openings.filter((o) => o.wallId === w.id)} y0={y0} />
      ))}
      {story.furniture.map((f) => {
        const c = FURNITURE[f.kind];
        return (
          <mesh key={f.id} position={[f.x, y0 + c.h / 2, f.y]} rotation={[0, (f.rotation * Math.PI) / 180, 0]} castShadow receiveShadow>
            <boxGeometry args={[c.w, c.h, c.d]} />
            <meshStandardMaterial color={c.color} roughness={0.7} />
          </mesh>
        );
      })}
    </group>
  );
}

function Floor({ story, y }: { story: Story; y: number }) {
  const geom = useMemo(() => {
    const poly = outlinePolygon(story);
    const b = storyBounds(story);
    if (!b) return null;
    const pts = poly ?? [
      { x: b.minX, y: b.minY },
      { x: b.maxX, y: b.minY },
      { x: b.maxX, y: b.maxY },
      { x: b.minX, y: b.maxY },
    ];
    // Shape in the XY plane, then rotate so plan y → world z.
    const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, -p.y)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: SLAB_FT, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    return g;
  }, [story]);
  if (!geom) return null;
  return (
    <mesh geometry={geom} position={[0, y - SLAB_FT, 0]} receiveShadow castShadow>
      <meshStandardMaterial color="#cfc8bc" roughness={0.95} />
    </mesh>
  );
}

function WallMesh({ design, wall, openings, y0 }: { design: Design; wall: Wall; openings: Opening[]; y0: number }) {
  const L = wallLength(wall);
  const H = design.wallHeightFt;
  const t = wall.exterior ? 0.5 : 0.35;
  const angle = Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x);
  const color = wall.exterior ? design.finishes.sidingColor : '#f5f3ee';
  const trim = design.finishes.trimColor;

  // Wall pieces: [start, end, bottom, top] in wall-local feet.
  const pieces: [number, number, number, number][] = [];
  const sorted = [...openings].sort((a, b) => a.offsetFt - b.offsetFt);
  let cursor = 0;
  for (const o of sorted) {
    const s = Math.max(cursor, o.offsetFt - o.widthFt / 2);
    const e = Math.min(L, o.offsetFt + o.widthFt / 2);
    if (s > cursor) pieces.push([cursor, s, 0, H]);
    if (o.sillFt > 0) pieces.push([s, e, 0, o.sillFt]);
    const head = o.sillFt + o.heightFt;
    if (head < H) pieces.push([s, e, head, H]);
    cursor = Math.max(cursor, e);
  }
  if (cursor < L) pieces.push([cursor, L, 0, H]);

  return (
    <group position={[wall.a.x, y0, wall.a.y]} rotation={[0, -angle, 0]}>
      {pieces.map(([s, e, b, tp], i) => (
        <mesh key={i} position={[(s + e) / 2, (b + tp) / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[e - s, tp - b, t]} />
          <meshStandardMaterial color={color} roughness={0.85} />
        </mesh>
      ))}
      {sorted.map((o) => (
        <group key={o.id} position={[o.offsetFt, o.sillFt + o.heightFt / 2, 0]}>
          {o.kind === 'window' ? (
            <mesh>
              <boxGeometry args={[o.widthFt, o.heightFt, 0.06]} />
              <meshPhysicalMaterial color="#9cc3dc" transparent opacity={0.45} roughness={0.05} metalness={0.1} />
            </mesh>
          ) : (
            <mesh position={[0, 0, wall.exterior ? 0 : 0]} castShadow>
              <boxGeometry args={[o.widthFt - 0.1, o.heightFt, 0.15]} />
              <meshStandardMaterial color={wall.exterior ? '#6b4a2e' : '#d9cbb5'} roughness={0.6} />
            </mesh>
          )}
          {/* trim frame */}
          {wall.exterior &&
            [
              [0, o.heightFt / 2 + 0.12, o.widthFt + 0.5, 0.25],
              ...(o.kind === 'window' ? [[0, -o.heightFt / 2 - 0.12, o.widthFt + 0.5, 0.25]] : []),
              [-o.widthFt / 2 - 0.12, 0, 0.25, o.heightFt],
              [o.widthFt / 2 + 0.12, 0, 0.25, o.heightFt],
            ].map(([x, y, w, h], i) => (
              <mesh key={i} position={[x!, y!, 0]}>
                <boxGeometry args={[w!, h!, t + 0.12]} />
                <meshStandardMaterial color={trim} roughness={0.6} />
              </mesh>
            ))}
        </group>
      ))}
    </group>
  );
}

const trisToGeometry = (tris: V3[][]) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(2), 3));
  g.computeVertexNormals();
  return g;
};

function Roof({ design, story, topY }: { design: Design; story: Story; topY: number }) {
  const b = storyBounds(story);
  const meshes = useMemo(() => {
    if (!b || design.roof.type === 'flat') return null;
    const m = pitchedRoof(b, design.roof, topY);
    return { roof: trisToGeometry(m.roof), gables: m.gables.length ? trisToGeometry(m.gables) : null };
  }, [b?.minX, b?.minY, b?.maxX, b?.maxY, design.roof, topY]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!b) return null;

  if (design.roof.type === 'flat') {
    const p = design.roof.parapetFt;
    return (
      <group>
        <mesh position={[b.minX + b.width / 2, topY + 0.25, b.minY + b.depth / 2]} castShadow receiveShadow>
          <boxGeometry args={[b.width, 0.5, b.depth]} />
          <meshStandardMaterial color={design.finishes.roofColor} roughness={0.9} />
        </mesh>
        {p > 0 &&
          story.walls
            .filter((w) => w.exterior)
            .map((w) => {
              const L = wallLength(w);
              const a = Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x);
              return (
                <mesh key={w.id} position={[(w.a.x + w.b.x) / 2, topY + p / 2, (w.a.y + w.b.y) / 2]} rotation={[0, -a, 0]} castShadow>
                  <boxGeometry args={[L + 0.5, p, 0.5]} />
                  <meshStandardMaterial color={design.finishes.sidingColor} roughness={0.85} />
                </mesh>
              );
            })}
      </group>
    );
  }
  return (
    <group>
      {meshes && (
        <mesh geometry={meshes.roof} castShadow receiveShadow>
          <meshStandardMaterial color={design.finishes.roofColor} roughness={0.55} metalness={0.35} side={THREE.DoubleSide} />
        </mesh>
      )}
      {meshes?.gables && (
        <mesh geometry={meshes.gables} castShadow>
          <meshStandardMaterial color={design.finishes.sidingColor} roughness={0.85} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

function Piers({ design }: { design: Design }) {
  const s = design.stories[0];
  const b = s && storyBounds(s);
  if (!b) return null;
  const nx = Math.max(2, Math.round(b.width / 8) + 1);
  const nz = Math.max(2, Math.round(b.depth / 8) + 1);
  const h = RAISED_FT - SLAB_FT;
  const out = [];
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      if (i > 0 && i < nx - 1 && j > 0 && j < nz - 1 && (i + j) % 2) continue;
      const x = b.minX + (b.width * i) / (nx - 1);
      const z = b.minY + (b.depth * j) / (nz - 1);
      out.push(
        <mesh key={`${i}-${j}`} position={[x, h / 2, z]} castShadow>
          <boxGeometry args={[0.8, h, 0.8]} />
          <meshStandardMaterial color="#b9b4ab" roughness={0.95} />
        </mesh>,
      );
    }
  return <group>{out}</group>;
}
