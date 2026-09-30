import { useEffect, useRef, useState } from "react";
import { TIERS, TRADE_COUNT, nextTier } from "../skins/catalog";
import { inventory } from "../skins/inventory";
import { playOpen, playReveal, unlock } from "../lib/caseSound";
import { MiniItem, WinnerModal } from "./CaseOpen";

/* Trade up contract, as in CS:GO: pick five drops of one grade, sign, and get
   one random item of the next grade up. Five Coverts make a knife. Equipped
   drops stay out of the contract so nothing you carry disappears by accident.
   The drops are only swapped once the short signing animation ends (or when
   the screen is left mid-way), the same way the case waits for its reel. */

const SIGN_MS = 1600;
const GRADES = TIERS.filter((t) => nextTier(t.slug));

function useInventory() {
  const [s, set] = useState(inventory.get());
  useEffect(() => inventory.subscribe(set), []);
  return s;
}

export function TradeUp({ onBack, onInventory, onCase }) {
  const inv = useInventory();
  const owned = inv.items
    .map((d) => ({ drop: d, item: inventory.itemOf(d) }))
    .filter((x) => x.item);
  const free = (x) => !inventory.isEquipped(x.drop.uid);
  const countFree = (slug) =>
    owned.filter((x) => x.item.tier === slug && free(x)).length;

  const [tier, setTier] = useState(
    () => (GRADES.find((t) => countFree(t.slug) >= TRADE_COUNT) || GRADES[0]).slug,
  );
  const [picked, setPicked] = useState([]); // uids, in the order they went in
  const [phase, setPhase] = useState("idle"); // idle | signing
  const [result, setResult] = useState(null);

  const up = nextTier(tier);
  const pool = owned
    .filter((x) => x.item.tier === tier)
    .sort((a, b) => free(b) - free(a) || b.drop.at - a.drop.at);
  const slots = Array.from({ length: TRADE_COUNT }, (_, i) =>
    owned.find((x) => x.drop.uid === picked[i]),
  );
  const full = picked.length === TRADE_COUNT;
  const signing = phase === "signing";

  // the contract is signed after the animation; leaving mid-way still signs it
  const pending = useRef(null);
  const timer = useRef(0);
  const commit = () => {
    const uids = pending.current;
    if (!uids) return null;
    pending.current = null;
    return inventory.tradeUp(uids);
  };
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      commit();
    },
    [],
  );

  function pickTier(slug) {
    if (signing) return;
    setTier(slug);
    setPicked([]);
  }
  function toggle(x) {
    if (signing || !free(x)) return;
    const uid = x.drop.uid;
    setPicked((p) =>
      p.includes(uid)
        ? p.filter((u) => u !== uid)
        : p.length < TRADE_COUNT
          ? [...p, uid]
          : p,
    );
  }
  function autofill() {
    if (signing) return;
    const rest = pool
      .filter((x) => free(x) && !picked.includes(x.drop.uid))
      .map((x) => x.drop.uid);
    setPicked((p) => [...p, ...rest].slice(0, TRADE_COUNT));
  }
  function sign() {
    if (!full || signing) return;
    unlock();
    playOpen();
    pending.current = picked;
    setPhase("signing");
    timer.current = setTimeout(() => {
      const drop = commit();
      setPhase("idle");
      setPicked([]);
      if (!drop) return;
      const item = inventory.itemOf(drop);
      setResult({ item, drop });
      playReveal(item.tier);
    }, SIGN_MS);
  }

  return (
    <div className="plgk case-screen">
      <div className="spin-shell" aria-hidden="true" />
      <div className="wrap page spin-page">
        <div className="case-top">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onBack} disabled={signing}>
            ← Menu
          </button>
          <div className="row gap-8">
            <button type="button" className="btn btn--ghost btn--sm" onClick={onInventory} disabled={signing}>
              Kho đồ ({inv.items.length})
            </button>
            <button type="button" className="btn btn--primary btn--sm" onClick={onCase} disabled={signing}>
              Mở hòm
            </button>
          </div>
        </div>
        <div className="page-head">
          <span className="eyebrow">Trade up</span>
          <h1 style={{ marginTop: 10 }}>Đổi {TRADE_COUNT} lấy 1</h1>
          <p>
            Bỏ vào {TRADE_COUNT} món cùng độ hiếm, nhận 1 món ngẫu nhiên ở bậc cao hơn.
            {" "}{TRADE_COUNT} món Covert đổi được 1 con dao ★.
          </p>
        </div>

        {/* which grade goes in, and what it turns into */}
        <div className="inv-filters inv-tiers">
          {GRADES.map((t) => {
            const n = countFree(t.slug);
            return (
              <button
                key={t.slug}
                type="button"
                className={`tier-chip spin-tile--${t.slug}${tier === t.slug ? " is-on" : ""}`}
                onClick={() => pickTier(t.slug)}
                disabled={signing}
              >
                <i />
                {t.label} → {nextTier(t.slug).label} <b>{n}</b>
              </button>
            );
          })}
        </div>

        <div className={`tu-contract${signing ? " is-signing" : ""}`}>
          <div className="tu-slots">
            {slots.map((x, i) =>
              x ? (
                <div key={x.drop.uid} className="tu-slot" onClick={() => toggle(x)}>
                  <MiniItem item={x.item} />
                </div>
              ) : (
                <div key={"empty" + i} className="tu-slot tu-slot--empty">
                  <span>{i + 1}</span>
                </div>
              ),
            )}
          </div>
          <div className="tu-arrow" aria-hidden="true">→</div>
          <div className={`tu-target spin-tile--${up.slug}`}>
            <span className="tu-target__q">{up.slug === "gold" ? "★" : "?"}</span>
            <b>{up.label}</b>
            <small>{up.slug === "gold" ? "Dao ngẫu nhiên" : "Món ngẫu nhiên"}</small>
          </div>
          <div className="tu-actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={autofill} disabled={signing || full}>
              Tự chọn
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPicked([])} disabled={signing || !picked.length}>
              Bỏ hết
            </button>
            <button type="button" className="btn btn--primary btn--led" onClick={sign} disabled={!full || signing}>
              {signing
                ? "Đang đổi…"
                : full
                  ? "Trade up"
                  : `Chọn thêm ${TRADE_COUNT - picked.length} món`}
            </button>
          </div>
        </div>

        {pool.length === 0 ? (
          <div className="card inv-empty">
            <p>Bạn chưa có món {TIERS.find((t) => t.slug === tier).label} nào.</p>
          </div>
        ) : (
          <div className="case-grid inv-grid">
            {pool.map((x) => {
              const k = picked.indexOf(x.drop.uid);
              const locked = !free(x);
              return (
                <div key={x.drop.uid} className={locked ? "tu-locked" : ""} title={locked ? "Đang trang bị, gỡ ra trong kho đồ để đổi" : ""}>
                  <MiniItem item={x.item} active={k >= 0} onClick={() => toggle(x)}>
                    {locked ? (
                      <em className="mini-item__tag">Đang dùng</em>
                    ) : k >= 0 ? (
                      <em className="mini-item__tag tu-num">{k + 1}</em>
                    ) : null}
                  </MiniItem>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {result && (
        <WinnerModal
          item={result.item}
          drop={result.drop}
          label="Trade up thành công"
          onClose={() => setResult(null)}
        />
      )}
    </div>
  );
}
