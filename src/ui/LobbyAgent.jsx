import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, useGLTF } from "@react-three/drei";
import { buildCharacter, prepareTemplate, pose } from "../view/characterPose";
import { inventory } from "../skins/inventory";
import { TIER_COLOR } from "../skins/catalog";
import { W } from "../game/weapons";
import { MiniItem, useThumb } from "./CaseOpen";

const MODEL = { T: "/models/t_phoenix.glb", CT: "/models/ct_sas.glb" };

/* How the lobby agent carries the gun, in its chest frame (facing -Z, its
   right is +X). A long gun lies across the body: the grip at the right hip,
   the barrel turned to the agent's left and dipped toward the floor, so the
   gun runs diagonally from the right shoulder down to the left and shows its
   painted side to the camera. A pistol hangs at low ready, muzzle down. */
const qAcross = new THREE.Quaternion()
  .setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.62)
  .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2));
const HOLD = {
  // out in front of the vest, so the gun crosses the body instead of sinking in
  long: { pos: new THREE.Vector3(0.14, -0.18, -0.4), quat: qAcross },
  pistol: { pos: new THREE.Vector3(0.1, -0.3, -0.36), quat: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -1.05) },
};

/* The agent in the lobby, as in the CS:GO main menu: the side's player model
   standing at low ready with the gun you are about to play with, wearing the
   skin you have equipped for it. It is posed by the same IK as the players in
   a match (characterPose), on a fake agent that never moves. */
function Agent({ team, weapon, skin, turn }) {
  const t = useGLTF(MODEL.T, false, true);
  const ct = useGLTF(MODEL.CT, false, true);
  const models = useMemo(() => ({
    T: { gltf: t, tpl: prepareTemplate(t) },
    CT: { gltf: ct, tpl: prepareTemplate(ct) },
  }), [t, ct]);
  const ch = useMemo(() => buildCharacter(models[team].gltf, models[team].tpl, team), [models, team]);
  const agent = useMemo(() => ({
    pos: new THREE.Vector3(), vel: { x: 0, z: 0 }, yaw: 0, pitch: 0, duck: 0, lean: 0,
    alive: true, active: 1, inv: {}, headPos: new THREE.Vector3(),
  }), []);
  agent.inv[1] = { id: weapon };
  agent.gunSkin = skin;
  agent.gunHold = W[weapon].type === "pistol" ? HOLD.pistol : HOLD.long;

  const clock = useRef(0);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    clock.current += dt;
    const s = clock.current;
    // square to the camera, the gun across the chest; a slow
    // breath and a drift of the aim keep it alive
    agent.yaw = -3.0 + turn.current + Math.sin(s * 0.35) * 0.04;
    agent.pitch = Math.sin(s * 1.3) * 0.01;
    pose(ch, agent, dt);
  });
  return <primitive object={ch.root} />;
}

const PICK_KEY = "aim-garena-lobby-pick";
const readPick = () => { try { return localStorage.getItem(PICK_KEY) || "auto"; } catch { return "auto"; } };

/** The guns in the inventory, one entry per drop, for the "hold this" picker. */
function ownedGuns() {
  return inventory.get().items
    .map((d) => ({ uid: d.uid, item: inventory.itemOf(d) }))
    .filter((x) => x.item?.kind === "gun")
    .sort((a, b) => W[a.item.weapon].name.localeCompare(W[b.item.weapon].name) || a.item.name.localeCompare(b.item.name));
}


/* The "hold this gun" picker: a button showing the gun in hand, opening a
   panel of the inventory's guns as cards (thumbnail, rarity colour), with a
   row of chips to narrow it to one weapon. */
function GunPicker({ guns, pick, matchWeapon, skin, weapon, onPick }) {
  const [open, setOpen] = useState(false);
  const [only, setOnly] = useState("all");
  const box = useRef(null);
  const thumb = useThumb(skin, 3);
  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("pointerdown", away); window.removeEventListener("keydown", esc); };
  }, [open]);
  const weapons = [...new Set(guns.map((g) => g.item.weapon))];
  const shown = only === "all" ? guns : guns.filter((g) => g.item.weapon === only);
  const take = (v) => { onPick(v); setOpen(false); };

  return (
    <div className="gunpick" ref={box} onPointerDown={(e) => e.stopPropagation()}>
      <button type="button" className={`gunpick__btn${open ? " is-open" : ""}`} onClick={() => setOpen((o) => !o)}>
        <span className="gunpick__thumb">{thumb ? <img src={thumb} alt="" /> : <i>{W[weapon].name}</i>}</span>
        <span className="gunpick__text">
          <small>Cầm súng</small>
          <b>{pick === "auto" ? `Theo trận · ${W[matchWeapon].name}` : `${W[weapon].name}${skin ? ` | ${skin.name}` : ""}`}</b>
        </span>
        <span className="gunpick__caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="gunpick__panel" role="dialog" aria-label="Chọn súng để cầm">
          <header>
            <h4>Chọn súng để cầm</h4>
            <span>{guns.length} khẩu trong kho</span>
          </header>
          <div className="gunpick__chips">
            <button type="button" className={only === "all" ? "on" : ""} onClick={() => setOnly("all")}>Tất cả</button>
            {weapons.map((w) => (
              <button type="button" key={w} className={only === w ? "on" : ""} onClick={() => setOnly(w)}>{W[w].name}</button>
            ))}
          </div>
          <div className="gunpick__grid">
            {only === "all" && (
              <button type="button" className={`gunpick__auto${pick === "auto" ? " is-on" : ""}`} onClick={() => take("auto")}>
                <b>Theo trận</b>
                <span>{W[matchWeapon].name} · skin đang trang bị</span>
              </button>
            )}
            {shown.map((g) => (
              <MiniItem key={g.uid} item={g.item} active={pick === g.uid} onClick={() => take(g.uid)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function LobbyAgent({ team, weapon: matchWeapon }) {
  // what to hold: "auto" is the match's gun in its equipped skin, otherwise one
  // gun from the inventory, picked below the agent and remembered
  const [pick, setPick] = useState(readPick);
  const [guns, setGuns] = useState(ownedGuns);
  const [equipped, setEquipped] = useState(() => inventory.equippedItem(matchWeapon));
  useEffect(() => {
    const sync = () => { setGuns(ownedGuns()); setEquipped(inventory.equippedItem(matchWeapon)); };
    sync();
    return inventory.subscribe(sync);
  }, [matchWeapon]);
  const chosen = pick !== "auto" ? guns.find((g) => g.uid === pick) : null;
  const weapon = chosen ? chosen.item.weapon : matchWeapon;
  const skin = chosen ? chosen.item : equipped;
  const choose = (v) => { setPick(v); try { localStorage.setItem(PICK_KEY, v); } catch { /* fine */ } };

  // drag sideways to turn the agent; it eases back to its pose on release
  const turn = useRef(0);
  const drag = useRef(null);
  useEffect(() => {
    let raf;
    const settle = () => {
      if (!drag.current) turn.current *= 0.92;
      raf = requestAnimationFrame(settle);
    };
    raf = requestAnimationFrame(settle);
    return () => cancelAnimationFrame(raf);
  }, []);
  const onDown = (e) => { drag.current = { x: e.clientX, t: turn.current }; e.currentTarget.setPointerCapture(e.pointerId); };
  const onMove = (e) => { if (drag.current) turn.current = drag.current.t + (e.clientX - drag.current.x) * 0.012; };
  const onUp = () => { drag.current = null; };

  return (
    <div className="lobby-stage" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <Canvas
        className="lobby-canvas"
        dpr={[1, 1.75]}
        gl={{ alpha: true, antialias: true }}
        camera={{ fov: 26, position: [0, 1.0, 5.9], near: 0.1, far: 30 }}
        onCreated={({ gl, camera }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          camera.lookAt(0, 0.95, 0);
        }}
      >
        <hemisphereLight args={["#dfe8ff", "#2a2218", 1.1]} />
        <directionalLight position={[2.5, 4, 3]} intensity={2.2} />
        <directionalLight position={[-3, 2.5, -2.5]} intensity={1.4} color="#ffd7a0" />
        <Suspense fallback={null}>
          <Agent team={team} weapon={weapon} skin={skin} turn={turn} />
        </Suspense>
        <ContactShadows position={[0, 0.001, 0]} opacity={0.55} scale={3.2} blur={2.4} far={1.2} />
      </Canvas>
      <div className="lobby-tag">
        <span className="lobby-tag__team">{team === "T" ? "Terrorist" : "Counter-Terrorist"}</span>
        <strong>{W[weapon].name}</strong>
        {skin && (
          <em style={{ color: TIER_COLOR[skin.tier] }}>{skin.name}</em>
        )}
        <GunPicker guns={guns} pick={chosen ? pick : "auto"} matchWeapon={matchWeapon} skin={skin} weapon={weapon} onPick={choose} />
      </div>
    </div>
  );
}
