// The 3D view: orbit with a finger or mouse, look inside, and record a
// fly-around video for TikTok / Facebook.
import { ContactShadows, OrbitControls, Sky } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { storyBounds } from '../model/geometry';
import type { Design } from '../model/types';
import { House3D, storyElevation } from './House3D';
import { pickVideoFormat, recordCanvas } from './record';

interface Props {
  design: Design;
}

const centerOf = (design: Design) => {
  const b = design.stories.map(storyBounds).find(Boolean);
  const top = storyElevation(design, design.stories.length - 1) + design.wallHeightFt;
  if (!b) return { c: new THREE.Vector3(15, 4, 12), r: 40, h: top };
  return {
    c: new THREE.Vector3(b.minX + b.width / 2, top / 2, b.minY + b.depth / 2),
    r: Math.max(b.width, b.depth, top) * 1.35 + 12,
    h: top,
  };
};

export function View3D({ design }: Props) {
  const [cutaway, setCutaway] = useState<number | null>(null);
  const [showRoof, setShowRoof] = useState(true);
  const [recording, setRecording] = useState<null | { progress: number }>(null);
  const [videoUrl, setVideoUrl] = useState<{ url: string; ext: string } | null>(null);
  const [vertical, setVertical] = useState(true);
  const canvasEl = useRef<HTMLCanvasElement | null>(null);
  const flyT = useRef<number | null>(null);
  const { c, r, h } = useMemo(() => centerOf(design), [design]);
  const duration = 10;

  const startRecording = async () => {
    const canvas = canvasEl.current;
    if (!canvas) return;
    const fmt = pickVideoFormat();
    if (!fmt) {
      alert('This browser cannot record video. Try Chrome or Safari.');
      return;
    }
    setVideoUrl(null);
    setCutaway(null);
    setShowRoof(true);
    setRecording({ progress: 0 });
    // Let the frame resize to the video shape before recording.
    await new Promise((res) => setTimeout(res, 400));
    flyT.current = 0;
    try {
      const blob = await recordCanvas(canvas, fmt.mime, duration * 1000, (p) => setRecording({ progress: p }));
      setVideoUrl({ url: URL.createObjectURL(blob), ext: fmt.ext });
    } finally {
      flyT.current = null;
      setRecording(null);
    }
  };

  return (
    <div className={`view3d ${recording && vertical ? 'recording-vertical' : ''}`}>
      <div className="view3d-stage">
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [c.x + r * 0.8, h + r * 0.45, c.z + r * 0.9], fov: 42, near: 0.5, far: 2000 }}
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          onCreated={({ gl }) => {
            canvasEl.current = gl.domElement;
            gl.toneMapping = THREE.ACESFilmicToneMapping;
          }}
        >
          <Sky sunPosition={[80, 60, 40]} turbidity={6} rayleigh={1.2} />
          <hemisphereLight args={['#dfefff', '#6f8f4e', 0.75]} />
          <directionalLight
            position={[c.x + 60, 90, c.z + 40]}
            intensity={2.2}
            castShadow
            shadow-bias={-0.0004}
            shadow-normalBias={0.04}
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-80}
            shadow-camera-right={80}
            shadow-camera-top={80}
            shadow-camera-bottom={-80}
          />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[c.x, -0.01, c.z]} receiveShadow>
            <circleGeometry args={[400, 64]} />
            <meshStandardMaterial color="#7fa65a" roughness={1} />
          </mesh>
          <ContactShadows position={[c.x, 0.01, c.z]} scale={r * 2} blur={2.4} opacity={0.45} far={30} />
          <House3D design={design} cutaway={cutaway} showRoof={showRoof} />
          <Controls target={c} flyT={flyT} radius={r} height={h} duration={duration} />
        </Canvas>
      </div>

      <div className="view3d-bar">
        {!recording && (
          <>
            <button className={`chip ${cutaway == null && showRoof ? 'on' : ''}`} onClick={() => { setCutaway(null); setShowRoof(true); }}>Outside</button>
            <button className={`chip ${!showRoof && cutaway == null ? 'on' : ''}`} onClick={() => { setCutaway(null); setShowRoof(false); }}>No roof</button>
            {design.stories.map((s, i) => (
              <button key={s.id} className={`chip ${cutaway === i ? 'on' : ''}`} onClick={() => setCutaway(i)}>Inside floor {i + 1}</button>
            ))}
            <span className="spacer" />
            <label className="chip ghost small"><input type="checkbox" checked={vertical} onChange={(e) => setVertical(e.target.checked)} /> 9:16</label>
            <button className="chip primary" onClick={startRecording}>🎬 Fly-around video</button>
          </>
        )}
        {recording && <div className="rec">● Recording {Math.round(recording.progress * 100)}%</div>}
      </div>

      {videoUrl && (
        <div className="video-ready" role="dialog" aria-label="Your video">
          <video src={videoUrl.url} controls autoPlay loop muted playsInline />
          <div className="row">
            <a className="btn primary" href={videoUrl.url} download={`${design.name || 'house'}-flyaround.${videoUrl.ext}`}>Download video</a>
            <ShareVideo url={videoUrl.url} ext={videoUrl.ext} name={design.name} />
            <button className="btn ghost" onClick={() => setVideoUrl(null)}>Close</button>
          </div>
          <p className="muted small">
            Post it on TikTok or Facebook: download, then upload from your phone's gallery.
            {videoUrl.ext === 'webm' && ' This browser recorded WebM; TikTok prefers MP4 (Chrome and Safari record MP4).'}
          </p>
        </div>
      )}
    </div>
  );
}

function ShareVideo({ url, ext, name }: { url: string; ext: string; name: string }) {
  const [can, setCan] = useState(false);
  const fileRef = useRef<File | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(url)
      .then((r) => r.blob())
      .then((b) => {
        const f = new File([b], `${name || 'house'}.${ext}`, { type: b.type });
        fileRef.current = f;
        if (alive) setCan(!!navigator.canShare?.({ files: [f] }));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [url, ext, name]);
  if (!can) return null;
  return (
    <button
      className="btn"
      onClick={() => fileRef.current && navigator.share({ files: [fileRef.current], title: name, text: 'I designed this house with the Guyana Frame house designer' }).catch(() => {})}
    >
      Share…
    </button>
  );
}

function Controls({ target, flyT, radius, height, duration }: { target: THREE.Vector3; flyT: React.RefObject<number | null>; radius: number; height: number; duration: number }) {
  const ref = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  useEffect(() => {
    ref.current?.target.copy(target);
    ref.current?.update();
  }, [target]);
  useFrame((_, dt) => {
    if (flyT.current == null) return;
    flyT.current += dt;
    const t = Math.min(1, flyT.current / duration);
    // One full turn, easing in and out, rising slightly.
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const a = Math.PI * 0.25 + ease * Math.PI * 2;
    const rr = radius * (1.05 - 0.15 * Math.sin(t * Math.PI));
    camera.position.set(target.x + Math.cos(a) * rr, height * 0.6 + radius * (0.25 + 0.2 * Math.sin(t * Math.PI)), target.z + Math.sin(a) * rr);
    camera.lookAt(target);
    if (ref.current) ref.current.target.copy(target);
  });
  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enableDamping
      maxPolarAngle={Math.PI / 2 - 0.05}
      minDistance={8}
      maxDistance={300}
    />
  );
}
