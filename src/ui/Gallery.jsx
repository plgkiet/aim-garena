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
    .filter((x) => x.item && SHOWN.has(x.item.tier) && (kind === "knife" ? x.item.kind !== "gun" : x.item.kind === "gun"))
    .sort((a, b) => ORDER[b.item.tier] - ORDER[a.item.tier]);
}

/** A name plate: a dark brushed panel with a stripe and glow in the item's
    grade colour down its left edge, the weapon in small caps, the skin name
    large, and the grade in a pill on the right. */
function plate(item) {
  const W = 768, H = 192;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const tier = tierBySlug(item.tier);
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1b2027"); bg.addColorStop(1, "#0c0f13");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // the grade's glow bleeding in from the left
  const glow = g.createLinearGradient(0, 0, W * 0.6, 0);
  glow.addColorStop(0, tier.color + "55"); glow.addColorStop(1, tier.color + "00");
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  g.fillStyle = tier.color; g.fillRect(0, 0, 14, H);
  // a hairline frame and a top highlight
  g.strokeStyle = "rgba(255,255,255,0.12)"; g.lineWidth = 2; g.strokeRect(1, 1, W - 2, H - 2);
  g.fillStyle = "rgba(255,255,255,0.08)"; g.fillRect(14, 0, W - 14, 3);
  const knife = item.kind !== "gun";
  g.fillStyle = "rgba(255,255,255,0.62)"; g.font = "600 30px 'Barlow Condensed', Arial, sans-serif";
  g.fillText((knife ? "★ " : "") + itemTitle(item).replace(/^★\s*/, "").toUpperCase(), 44, 62);
  g.fillStyle = "#ffffff"; g.font = "700 60px Barlow, Arial, sans-serif";
  let name = item.name;
  while (g.measureText(name).width > W - 90 && name.length > 4) name = name.slice(0, -2) + "…";
  g.fillText(name, 44, 140);
  // the grade in a pill, top right
  g.font = "700 22px 'Barlow Condensed', Arial, sans-serif";
  const lbl = tier.label.replace("★ ", "").toUpperCase();
  const pw = g.measureText(lbl).width + 34, px = W - pw - 26, py = 30;
  g.fillStyle = tier.color + "33"; g.strokeStyle = tier.color; g.lineWidth = 2;
  g.beginPath(); g.roundRect(px, py, pw, 38, 19); g.fill(); g.stroke();
  g.fillStyle = tier.color; g.fillText(lbl, px + 17, py + 27);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
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

const WHITE = new THREE.Color("#ffffff");

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
    renderer.toneMappingExposure = 1.15;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#07090c");
    scene.fog = new THREE.Fog("#07090c", 9, 24);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    // no point light per piece (they were the lag): a dim sky, a soft key,
    // the room's reflections, and a small fixed pool of spotlights that
    // follows the pieces nearest you (see the loop); the "lamps" are emissive
    scene.add(new THREE.HemisphereLight("#9fb0c4", "#0b0d10", 0.45));
    const key = new THREE.DirectionalLight("#ffffff", 0.6);
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
    const titleTex = sign(wing === "knife" ? "KHU DAO & GĂNG" : "KHU SÚNG");
    const titleM = new THREE.MeshBasicMaterial({ map: titleTex, transparent: true });
    disposables.push(titleTex, titleM);
    add(new THREE.PlaneGeometry(5, 0.78), titleM, 0, 3.1, -LEN + 0.02);

    // ---- the plinths (shared geometry, one material per grade) ----
    const plinthM = mat({ color: "#121519", roughness: 0.55, metalness: 0.35 });
    const glow = new Map();
    const glowM = (c) => { if (!glow.has(c)) glow.set(c, mat({ color: c, emissive: c, emissiveIntensity: 2.4 })); return glow.get(c); };
    // soft additive light: a beam fading down from the lamp, a round pool
    const fade = (draw) => {
      const c = document.createElement("canvas"); c.width = c.height = 128;
      draw(c.getContext("2d")); const t = new THREE.CanvasTexture(c); disposables.push(t); return t;
    };
    const beamTex = fade((g) => {
      const gr = g.createLinearGradient(0, 0, 0, 128);
      gr.addColorStop(0, "rgba(255,255,255,0.0)"); gr.addColorStop(0.06, "rgba(255,255,255,1)");
      gr.addColorStop(0.55, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    });
    const poolTex = fade((g) => {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.45, "rgba(255,255,255,0.4)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    });
    const additive = (map, color, opacity) => {
      const m = new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
      disposables.push(m); return m;
    };
    const beams = new Map(), pools = new Map();
    const beamM = (c) => { if (!beams.has(c)) beams.set(c, additive(beamTex, c, 0.12)); return beams.get(c); };
    const poolM = (c) => { if (!pools.has(c)) pools.set(c, additive(poolTex, c, 0.55)); return pools.get(c); };
    const beamGeo = new THREE.CylinderGeometry(0.1, 0.62, H - 0.96, 28, 1, true);
    const poolGeo = new THREE.PlaneGeometry(1.2, 1.0).rotateX(-Math.PI / 2);
    const lampGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.02, 24);
    disposables.push(beamGeo, poolGeo, lampGeo);
    const stands = [];
    items.forEach((x, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const r = Math.floor(i / 2);
      const pos = new THREE.Vector3(side * SIDE, 0, -2.6 - r * GAP);
      const color = tierBySlug(x.item.tier).color;
      add(box(1.25, 0.95, 1.0), plinthM, pos.x, 0.475, pos.z);
      add(box(0.02, 0.025, 1.0), glowM(color), pos.x - side * 0.635, 0.955, pos.z);
      add(box(0.02, 0.012, 1.0), glowM(color), pos.x - side * 0.635, 0.3, pos.z);
      // a beam of the grade's colour from a lamp in the ceiling, and its pool
      // on the plinth top
      add(beamGeo, beamM(color), pos.x, (H + 0.96) / 2, pos.z);
      add(poolGeo, poolM(color), pos.x, 0.957, pos.z);
      add(lampGeo, glowM(color), pos.x, H - 0.012, pos.z);
      const turn = new THREE.Group();
      turn.position.set(pos.x, 1.42, pos.z);
      scene.add(turn);
      stands.push({ ...x, pos, turn, side, state: "none" });
    });
    const plateGeo = new THREE.PlaneGeometry(1.12, 0.28);
    disposables.push(plateGeo);
    // the spotlight pool: always the same few lights (so no shader rebuilds),
    // moved each frame onto the pieces nearest you, tinted a touch by grade
    const SPOTS = 3;
    const spots = [];
    for (let i = 0; i < SPOTS; i++) {
      const l = new THREE.SpotLight("#ffffff", 0, 6, 0.42, 0.65, 1.2);
      scene.add(l, l.target);
      spots.push(l);
    }
    const tint = new THREE.Color();

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
        // guns to one length, except that the pistols (under 0.55 m) keep
        // to scale, smaller than the rifles beside them
        const long = Math.max(size.x, size.y, size.z);
        holder.scale.setScalar(s.item.kind === "gun" ? 0.95 / Math.max(long, 0.55) : 0.55 / long);
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
      // the spotlights onto the nearest pieces, overhead and a little in front
      const near = stands.slice().sort((a, b) =>
        Math.hypot(a.pos.x - me.x, a.pos.z - me.z) - Math.hypot(b.pos.x - me.x, b.pos.z - me.z));
      spots.forEach((l, i) => {
        const s = near[i];
        if (!s) { l.intensity = 0; return; }
        l.position.set(s.pos.x - s.side * 0.5, H - 0.1, s.pos.z + 0.3);
        l.target.position.set(s.pos.x, 1.3, s.pos.z);
        l.target.updateMatrixWorld();
        l.color.copy(tint.set(tierBySlug(s.item.tier).color)).lerp(WHITE, 0.6);
        l.intensity = 14;
      });
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
      renderer.forceContextLoss();   // give the context back now (see ItemDetail)
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
          <i className="gallery__look-bar" />
          <div className="gallery__look-text">
            <small>{itemTitle(looking)}</small>
            <b>{looking.name}</b>
          </div>
          <em>{tier.label.replace("★ ", "")}</em>
        </div>
      )}
      <header className="gallery__head">
        <span className="plgk gallery__back">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onBack}>← Kho đồ</button>
        </span>
        <div>
          <h2>Phòng trưng bày</h2>
          <p>{count} món từ bậc Covert trở lên</p>
        </div>
        <div className="gallery__wings">
          {[["gun", "Khu súng"], ["knife", "Khu dao & găng"]].map(([k, label]) => (
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
