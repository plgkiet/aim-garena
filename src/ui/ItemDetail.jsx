import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CASE, tierBySlug } from "../skins/catalog";
import { inventory } from "../skins/inventory";
import { buildItemModel } from "../skins/thumbs";
import { KNIVES } from "../lib/knives";
import { itemTitle } from "./CaseOpen";

/* Inspecting one drop, after CS:GO's item screen: the weapon large in the
   middle over a blurred map, its name and collection top-left over a bar in
   its grade's colour. Drag to turn it, scroll to bring it closer; left alone
   it sways gently. Equipping happens here. */

const MIN_DIST = 0.9, MAX_DIST = 2.6;

function Viewer({ item }) {
  const host = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const el = host.current;
    let alive = true;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.add(new THREE.HemisphereLight("#ffffff", "#3a3f48", 1.1));
    const key = new THREE.DirectionalLight("#ffffff", 2.2);
    key.position.set(3, 4, 2);
    scene.add(key);
    const rim = new THREE.DirectionalLight("#9fc4ff", 1.2);
    rim.position.set(-3, 1, -2);
    scene.add(rim);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
    const pivot = new THREE.Group();
    scene.add(pivot);

    // turntable state: yaw spins it about the vertical, pitch tips it toward you
    const view = { yaw: 0, pitch: 0, dist: 1.5, drag: null, idle: 0 };

    buildItemModel(item).then((model) => {
      if (!alive) return;
      // centre it and make its longest side one unit; a gun shorter than
      // 0.55 m (the pistols) is scaled as if it were that long, so it stays
      // pistol-sized next to the rifles instead of filling the screen
      const holder = new THREE.Group();
      holder.add(model);
      holder.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(holder);
      const size = box.getSize(new THREE.Vector3());
      const long = Math.max(size.x, size.y, size.z);
      // a figure stood upright (the Bearbrick) is tall: show it smaller so
      // all of it fits with room around it
      const upright = item.model && KNIVES[item.knife]?.upright;
      // gloves are nearly as tall as they are wide, where a gun or a knife
      // is a long thin thing: at full size the pair runs off the top and
      // bottom of the frame, so they are shown smaller too
      const fill = upright ? 0.62 : item.kind === "glove" ? 0.58 : 1;
      const s = fill / (item.kind === "gun" ? Math.max(long, 0.55) : long);
      model.position.sub(box.getCenter(new THREE.Vector3()));
      holder.scale.setScalar(s);
      pivot.add(holder);
      setLoading(false);
    });

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      // keep the whole weapon in view on narrow screens
      view.fit = Math.max(1, 1.9 / camera.aspect);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const canvas = renderer.domElement;
    const down = (e) => {
      view.drag = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e) => {
      if (!view.drag) return;
      view.yaw += (e.clientX - view.drag.x) * 0.01;
      view.pitch = Math.max(-1.2, Math.min(1.2, view.pitch + (e.clientY - view.drag.y) * 0.008));
      view.drag = { x: e.clientX, y: e.clientY };
      view.idle = 0;
    };
    const up = () => (view.drag = null);
    const wheel = (e) => {
      e.preventDefault();
      view.dist = Math.max(MIN_DIST, Math.min(MAX_DIST, view.dist * (1 + e.deltaY * 0.001)));
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", wheel, { passive: false });

    let frame = 0, last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!view.drag) {
        // left alone for a moment, it drifts back to a gentle sway
        view.idle += dt;
        if (view.idle > 1.5) {
          const k = 1 - Math.exp(-dt * 1.5);
          view.yaw += (Math.sin(now / 2400) * 0.35 - view.yaw) * k;
          view.pitch += (Math.sin(now / 3100) * 0.08 - view.pitch) * k;
        }
      }
      pivot.rotation.set(view.pitch, view.yaw, 0, "YXZ");
      const d = view.dist * (view.fit || 1);
      camera.position.set(d, 0.08, 0);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      ro.disconnect();
      canvas.removeEventListener("wheel", wheel);
      env.dispose();
      pmrem.dispose();
      // the models share their materials with the game; only the renderer goes.
      // dispose() alone keeps the WebGL context alive until GC: open enough
      // item pages and Chrome kills the oldest context — the game's own canvas
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, [item]);

  return (
    <div className="inspect-view" ref={host}>
      {loading && <span className="inspect-loading">Đang tải…</span>}
    </div>
  );
}

function useInventory() {
  const [s, set] = useState(inventory.get());
  useEffect(() => inventory.subscribe(set), []);
  return s;
}

export function ItemDetail({ uid, onBack }) {
  const inv = useInventory();
  const drop = inv.items.find((d) => d.uid === uid);
  const item = drop ? inventory.itemOf(drop) : null;
  // one model per drop, kept stable while the inventory changes around it
  const [shown, setShown] = useState(item);
  useEffect(() => {
    if (item?.id !== shown?.id) setShown(item);
  }, [item, shown]);

  if (!drop || !item) {
    return (
      <div className="plgk case-screen">
        <div className="wrap page spin-page">
          <div className="card inv-empty">
            <p>Không tìm thấy món này trong kho.</p>
            <button type="button" className="btn btn--primary" onClick={onBack}>
              Về kho đồ
            </button>
          </div>
        </div>
      </div>
    );
  }

  const tier = tierBySlug(item.tier);
  const on = inventory.isEquipped(drop.uid);
  const slot = inventory.slotOf(item);
  const worn = inventory.equippedItem(slot);
  const got = new Date(drop.at).toLocaleDateString("vi-VN");

  return (
    <div className={`plgk case-screen inspect spin-tile--${item.tier}`}>
      <div className="inspect-bg" aria-hidden="true" />
      <div className="inspect-head">
        <span className="inspect-badge" aria-hidden="true">
          {item.kind === "gun" ? "✦" : "★"}
        </span>
        <div className="inspect-title">
          <h1>
            {itemTitle(item)} <i>|</i> {item.name}
          </h1>
          <p>{CASE.name}</p>
        </div>
      </div>

      {shown && <Viewer item={shown} />}

      <div className="inspect-foot">
        <div className="inspect-facts">
          <span>
            <small>Độ hiếm</small>
            <b style={{ color: "var(--tier)" }}>
              {tier.label}
            </b>
          </span>
          {item.patternNo && (
            <span>
              <small>{item.phase ? "Phase" : "Pattern"}</small>
              <b>
                {item.phase ? `${item.gem ? "💎 " : ""}${item.phase}` : `#${item.patternNo}${item.gem ? " · 💎 Blue Gem" : ""}`}
              </b>
            </span>
          )}
          <span>
            <small>Nhận được</small>
            <b>
              {got}
              {drop.via === "tradeup" ? " · Trade up" : ""}
            </b>
          </span>
          {!on && worn && (
            <span>
              <small>Đang dùng</small>
              <b>{worn.name}</b>
            </span>
          )}
        </div>
        <div className="row gap-8">
          <button type="button" className="btn btn--ghost" onClick={onBack}>
            ← Kho đồ
          </button>
          <button
            type="button"
            className={`btn ${on ? "btn--ghost" : "btn--primary"}`}
            onClick={() => (on ? inventory.unequip(slot) : inventory.equip(drop.uid))}
          >
            {on ? "Gỡ trang bị" : "Trang bị"}
          </button>
        </div>
      </div>
      <p className="inspect-hint">Kéo để xoay · cuộn để phóng to</p>
    </div>
  );
}
