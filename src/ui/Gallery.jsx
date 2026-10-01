import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { TIERS, tierBySlug } from "../skins/catalog";
import { inventory } from "../skins/inventory";
import { buildItemModel } from "../skins/thumbs";
import { itemTitle } from "./CaseOpen";

/* The gallery (phòng trưng bày), after Delta Force's collection room: a dark
   hall walked in first person, every Covert-and-up gun and knife you own on
   its own lit plinth down both sides, turning slowly, a name plate in its
   grade's colour on the front. WASD to walk, the mouse to look; the name of
   whatever you are looking at shows under the crosshair. */

const SHOWN = new Set(["covert", "gold", "contraband"]);
const ORDER = Object.fromEntries(TIERS.map((t, i) => [t.slug, i]));
const GAP = 2.6;           // metres between plinths along a wall
const SIDE = 2.7;          // plinths stand this far either side of the aisle
const EYE = 1.62;

/** The drops to show in one wing (guns or knives), rarest first. */
function showcase(kind) {
  return inventory.get().items
    .map((d) => ({ uid: d.uid, item: inventory.itemOf(d) }))
    .filter((x) => x.item && SHOWN.has(x.item.tier) && (kind === "knife" ? x.item.kind === "knife" : x.item.kind !== "knife"))
    .sort((a, b) => ORDER[b.item.tier] - ORDER[a.item.tier]);
}

/** A name plate: the item's name over a bar in its grade's colour. */
function plate(item) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 128;
  const g = c.getContext("2d");
  const tier = tierBySlug(item.tier);
  g.fillStyle = "#0d1014"; g.fillRect(0, 0, 512, 128);
  g.fillStyle = tier.color; g.fillRect(0, 118, 512, 10);
  g.fillStyle = "#9aa4ae"; g.font = "500 30px Barlow, Arial, sans-serif";
  g.fillText(itemTitle(item), 22, 46);
  g.fillStyle = "#ffffff"; g.font = "700 42px Barlow, Arial, sans-serif";
  g.fillText(item.name, 22, 98);
  g.fillStyle = tier.color; g.font = "700 24px 'Barlow Condensed', Arial, sans-serif";
  const lbl = tier.label.toUpperCase();
  g.fillText(lbl, 490 - g.measureText(lbl).width, 46);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Big lettering on the back wall. */
function sign(text) {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 160;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(0,0,0,0)"; g.fillRect(0, 0, 1024, 160);
  g.fillStyle = "#e9a43a"; g.font = "700 96px 'Barlow Condensed', Arial, sans-serif";
  g.textAlign = "center"; g.fillText(text, 512, 112);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// models are built only for the plinths you walk near, and hidden again
// once you are far off, so a big collection costs no more than a few pieces
const LOAD_NEAR = 11, SHOW_NEAR = 16;

export function Gallery({ onBack }) {
  const host = useRef(null);
  const [locked, setLocked] = useState(false);
  const [looking, setLooking] = useState(null);
  const [wing, setWing] = useState("gun");
  const counts = { gun: showcase("gun").length, knife: showcase("knife").length };
  const count = counts[wing];

  useEffect(() => {
    const el = host.current;
    let alive = true;
    const items = showcase(wing);
    const rows = Math.max(3, Math.ceil(items.length / 2));
    const LEN = rows * GAP + 5;              // hall length (along -Z from the door)
    const W = SIDE * 2 + 2.6;                // hall width
    const H = 4.2;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#07090c");
    scene.fog = new THREE.Fog("#07090c", 9, 24);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    // no point lights at all (they were the lag): sky, one key light and the
    // room's reflections; the "lamps" are emissive strips
    scene.add(new THREE.HemisphereLight("#cfd8e4", "#14171c", 0.9));
    const key = new THREE.DirectionalLight("#ffffff", 1.4);
    key.position.set(2, 6, 3);
    scene.add(key);

    // ---- the hall ----
    const disposables = [];
    const mat = (o) => { const m = new THREE.MeshStandardMaterial(o); disposables.push(m); return m; };
    const geos = new Map();
    const box = (w, h, d) => { const k = `${w}|${h}|${d}`; if (!geos.has(k)) { const g = new THREE.BoxGeometry(w, h, d); geos.set(k, g); disposables.push(g); } return geos.get(k); };
    const add = (geo, m, x, y, z, ry = 0) => {
      if (!disposables.includes(geo)) disposables.push(geo);
      const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.rotation.y = ry;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix(); scene.add(mesh); return mesh;
    };
    const floorM = mat({ color: "#1a1e24", roughness: 0.45, metalness: 0.5 });
    const wallM = mat({ color: "#20252c", roughness: 0.85, metalness: 0.15 });
    const panelM = mat({ color: "#2a3038", roughness: 0.6, metalness: 0.4 });
    const stripM = mat({ color: "#ffffff", emissive: "#dfe8ff", emissiveIntensity: 2.2 });
    const amberM = mat({ color: "#e9a43a", emissive: "#e9a43a", emissiveIntensity: 1.4 });
    const zMid = -LEN / 2;
    add(new THREE.PlaneGeometry(W, LEN).rotateX(-Math.PI / 2), floorM, 0, 0, zMid);
    add(new THREE.PlaneGeometry(W, LEN).rotateX(Math.PI / 2), wallM, 0, H, zMid);
    add(new THREE.PlaneGeometry(LEN, H), wallM, -W / 2, H / 2, zMid, Math.PI / 2);
    add(new THREE.PlaneGeometry(LEN, H), wallM, W / 2, H / 2, zMid, -Math.PI / 2);
    add(new THREE.PlaneGeometry(W, H), wallM, 0, H / 2, -LEN);
    add(new THREE.PlaneGeometry(W, H).rotateY(Math.PI), wallM, 0, H / 2, 0);
    add(new THREE.BoxGeometry(0.06, 0.01, LEN - 1.5), amberM, 0, 0.006, zMid);
    for (const x of [-1.3, 1.3]) add(new THREE.BoxGeometry(0.12, 0.04, LEN - 1), stripM, x, H - 0.03, zMid);
    for (let r = 0; r < rows; r++) {
      const z = -2.6 - r * GAP;
      for (const sd of [-1, 1]) {
        add(box(0.06, 2.6, GAP * 0.86), panelM, sd * (W / 2 - 0.03), 1.6, z);
        add(box(0.03, 0.05, GAP * 0.86), stripM, sd * (W / 2 - 0.07), 2.95, z);
      }
    }
    const titleTex = sign(wing === "knife" ? "KHU DAO" : "KHU SÚNG");
    const titleM = new THREE.MeshBasicMaterial({ map: titleTex, transparent: true });
    disposables.push(titleTex, titleM);
    add(new THREE.PlaneGeometry(5, 0.78), titleM, 0, 3.1, -LEN + 0.02);

    // ---- the plinths (shared geometry, one material per grade) ----
    const plinthM = mat({ color: "#121519", roughness: 0.55, metalness: 0.35 });
    const glow = new Map();
    const glowM = (c) => { if (!glow.has(c)) glow.set(c, mat({ color: c, emissive: c, emissiveIntensity: 2.4 })); return glow.get(c); };
    const stands = [];
    items.forEach((x, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const r = Math.floor(i / 2);
      const pos = new THREE.Vector3(side * SIDE, 0, -2.6 - r * GAP);
      const color = tierBySlug(x.item.tier).color;
      add(box(1.25, 0.95, 1.0), plinthM, pos.x, 0.475, pos.z);
      add(box(0.02, 0.025, 1.0), glowM(color), pos.x - side * 0.635, 0.955, pos.z);
      add(box(0.02, 0.012, 1.0), glowM(color), pos.x - side * 0.635, 0.3, pos.z);
      const turn = new THREE.Group();
      turn.position.set(pos.x, 1.42, pos.z);
      scene.add(turn);
      stands.push({ ...x, pos, turn, side, state: "none" });
    });
    const plateGeo = new THREE.PlaneGeometry(1.1, 0.275);
    disposables.push(plateGeo);

    // build one stand's model and name plate (one at a time)
    let busy = false;
    const load = async (s) => {
      busy = true; s.state = "loading";
      const tex = plate(s.item);
      const pm = new THREE.MeshBasicMaterial({ map: tex });
      disposables.push(tex, pm);
      add(plateGeo, pm, s.pos.x - s.side * 0.64, 0.62, s.pos.z, -s.side * Math.PI / 2);
      try {
        const model = await buildItemModel(s.item);
        if (!alive) return;
        const holder = new THREE.Group();
        holder.add(model);
        holder.updateMatrixWorld(true);
        const b = new THREE.Box3().setFromObject(holder);
        const size = b.getSize(new THREE.Vector3());
        holder.scale.setScalar((s.item.kind === "knife" ? 0.55 : 0.95) / Math.max(size.x, size.y, size.z));
        model.position.sub(b.getCenter(new THREE.Vector3()));
        s.turn.add(holder);
      } catch { /* a model that fails just leaves its plinth empty */ }
      s.state = "ready"; busy = false;
    };
    // ---- first person ----
    const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 100);
    const me = { x: 0, z: -0.8, yaw: 0, pitch: 0 };
    const keys = {};
    const onKey = (e) => { keys[e.code] = e.type === "keydown"; };
    const onMouse = (e) => {
      if (document.pointerLockElement !== renderer.domElement) return;
      me.yaw -= e.movementX * 0.0022;
      me.pitch = THREE.MathUtils.clamp(me.pitch - e.movementY * 0.0022, -1.3, 1.3);
    };
    const onLock = () => setLocked(document.pointerLockElement === renderer.domElement);
    const onClick = () => renderer.domElement.requestPointerLock?.()?.catch?.(() => {});
    renderer.domElement.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    document.addEventListener("mousemove", onMouse);
    document.addEventListener("pointerlockchange", onLock);

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    const fwd = new THREE.Vector3();
    let last = performance.now(), raf, lastLook = null;
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // walk
      const speed = (keys.ShiftLeft || keys.ShiftRight ? 1.4 : 3.2) * dt;
      const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), sd = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
      if (f || sd) {
        const l = Math.hypot(f, sd);
        me.x += ((-Math.sin(me.yaw) * f + Math.cos(me.yaw) * sd) / l) * speed;
        me.z += ((-Math.cos(me.yaw) * f - Math.sin(me.yaw) * sd) / l) * speed;
      }
      // keep inside the hall and out of the plinths
      me.x = THREE.MathUtils.clamp(me.x, -W / 2 + 0.35, W / 2 - 0.35);
      me.z = THREE.MathUtils.clamp(me.z, -LEN + 0.35, -0.35);
      for (const s of stands) {
        const dx = me.x - s.pos.x, dz = me.z - s.pos.z;
        const ox = 0.95 - Math.abs(dx), oz = 0.8 - Math.abs(dz);
        if (ox > 0 && oz > 0) { if (ox < oz) me.x += Math.sign(dx || 1) * ox; else me.z += Math.sign(dz || 1) * oz; }
      }
      camera.position.set(me.x, EYE + Math.sin(now / 900) * 0.004, me.z);
      camera.rotation.set(me.pitch, me.yaw, 0, "YXZ");
      // build what is near, hide what is far; the near pieces turn slowly
      let next = null, nextD = LOAD_NEAR;
      for (const s of stands) {
        const d = Math.hypot(s.pos.x - me.x, s.pos.z - me.z);
        s.turn.visible = d < SHOW_NEAR;
        if (s.turn.visible) s.turn.rotation.y += dt * 0.35;
        if (s.state === "none" && d < nextD) { next = s; nextD = d; }
      }
      if (next && !busy) load(next);
      // what is under the crosshair (nearest plinth in front, within reach)
      camera.getWorldDirection(fwd);
      let best = null, bestD = 4.5;
      for (const s of stands) {
        const tx = s.pos.x - me.x, ty = 1.42 - EYE, tz = s.pos.z - me.z;
        const d = Math.hypot(tx, ty, tz);
        if (d > bestD) continue;
        if ((tx * fwd.x + ty * fwd.y + tz * fwd.z) / d > 0.93) { best = s; bestD = d; }
      }
      if (best?.uid !== lastLook) { lastLook = best?.uid ?? null; setLooking(best ? best.item : null); }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      document.removeEventListener("mousemove", onMouse);
      document.removeEventListener("pointerlockchange", onLock);
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
      for (const d of disposables) d.dispose?.();
      pmrem.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [wing]);

  const tier = looking ? tierBySlug(looking.tier) : null;
  return (
    <div className="gallery">
      <div className="gallery__view" ref={host} />
      <span className="gallery__cross" aria-hidden="true" />
      {looking && (
        <div className="gallery__look" style={{ "--tier": tier.color }}>
          <small>{itemTitle(looking)}</small>
          <b>{looking.name}</b>
          <em>{tier.label}</em>
        </div>
      )}
      <header className="gallery__head">
        <button type="button" className="btn btn--ghost" onClick={onBack}>← Kho đồ</button>
        <div>
          <h2>Phòng trưng bày</h2>
          <p>{count} món từ bậc Covert trở lên</p>
        </div>
        <div className="gallery__wings">
          {[["gun", "Khu súng"], ["knife", "Khu dao"]].map(([k, label]) => (
            <button key={k} type="button" className={wing === k ? "on" : ""} onClick={() => { setWing(k); setLooking(null); }}>
              {label} <b>{counts[k]}</b>
            </button>
          ))}
        </div>
      </header>
      {!locked && (
        <div className="gallery__hint">
          {count ? (
            <>
              <b>Bấm vào màn hình để đi vào</b>
              <span>WASD đi · chuột nhìn · Shift đi chậm · Esc để thả chuột</span>
            </>
          ) : (
            <b>Chưa có món nào từ bậc Covert trở lên — mở hòm thêm nhé</b>
          )}
        </div>
      )}
    </div>
  );
}
