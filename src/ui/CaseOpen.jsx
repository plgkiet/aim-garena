import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { CASE, drawItem, rollPattern, tierBySlug, variantOf } from "../skins/catalog";
import { inventory } from "../skins/inventory";
import { thumbnail, cachedThumb } from "../skins/thumbs";
import { W } from "../game/weapons";
import { playOpen, playReveal, playTick, unlock } from "../lib/caseSound";

/* Case opening — the plgk gift wheel, carried over whole: the same reel, the
   same braking curve, the same stop-anywhere-but-dead-centre, the same rules
   for what may show on the strip, and the same reveal. The prizes are now the
   skins from skins/catalog.js, and the draw happens here (CS:GO odds) since
   there is no shop server behind it. */

// Tile width is measured off the DOM, not hard-coded: CSS shrinks tiles on
// narrow screens, and a hard-coded width stops the reel off-tile on a phone.
const FALLBACK_TILE = 240;
const FALLBACK_GAP = 14;

function measureTile(track) {
  const tile = track?.querySelector(".spin-tile");
  if (!tile) return { tile: FALLBACK_TILE, gap: FALLBACK_GAP };
  const gap = parseFloat(getComputedStyle(track).columnGap);
  return {
    tile: tile.getBoundingClientRect().width,
    gap: Number.isFinite(gap) ? gap : FALLBACK_GAP,
  };
}

// The idle strip only shows the everyday grades — the rare stuff is kept back
// so it means something when it flashes past during a spin.
const IDLE_TIERS = ["milspec", "restricted"];
// The spinning strip is filled at the case's own odds for the lower grades,
// so it is mostly blue with the odd purple. Pink and red are
// teases on top of that: at most one of each per spin, and not every spin.
// Never a knife — a gold tile on the reel means you won it.
const FILLER_TIERS = ["milspec", "restricted"];
/* How the filler is mixed on the strip. This is only what the reel shows —
   the real draw still uses the case odds (skins/catalog.js). At the true
   80/16 split the reel reads as a wall of blue, so purple gets a bigger share. */
const STRIP_MIX = { milspec: 0.65, restricted: 0.35 };
const TEASES = [
  { tier: "classified", chance: 0.3 },
  { tier: "covert", chance: 0.12 },
];

const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

function spinProfile(reduced, fast = false) {
  // the x10: a short spin each, so ten of them take ~20 s rather than ~90
  if (fast)
    return {
      durationMs: (reduced ? 1100 : 1700) + Math.floor(Math.random() * 400),
      tiles: 16 + Math.floor(Math.random() * 6),
      friction: 2.4 + Math.random() * 0.4,
    };
  if (reduced)
    return {
      durationMs: 3600 + Math.floor(Math.random() * 900),
      tiles: 10 + Math.floor(Math.random() * 4),
      friction: 2.7 + Math.random() * 0.6,
    };
  return {
    durationMs: 7400 + Math.floor(Math.random() * 2000),
    tiles: 30 + Math.floor(Math.random() * 11),
    friction: 2.7 + Math.random() * 0.6,
  };
}

/** Brakes evenly to zero at the end — the higher the power, the lazier the finish. */
const ease = (p, friction) =>
  1 - Math.pow(1 - Math.min(1, Math.max(0, p)), friction);
/** Stop somewhere in 10–90% of the tile, never dead centre. */
const stopFraction = () => (Math.floor(Math.random() * 81) + 10) / 100;

export const itemTitle = (it) =>
  it.kind === "knife" || it.kind === "glove" ? it.weaponName : W[it.weapon]?.name || it.weapon;
export const itemLabel = (it) => `${itemTitle(it)} | ${it.name}`;

/** Thumbnail for an item, rendered on first use (queued; see skins/thumbs). */
export function useThumb(item, priority = 2) {
  const [url, setUrl] = useState(() => (item ? cachedThumb(item.id) : null));
  const id = item?.id;
  useEffect(() => {
    if (!item) return;
    let live = true;
    const hit = cachedThumb(item.id);
    if (hit) {
      setUrl(hit);
      return;
    }
    setUrl(null);
    thumbnail(item, { priority })
      .then((u) => {
        if (live) setUrl(u);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
    // keyed by id: a Case Hardened variant is a fresh object every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, priority]);
  return url;
}

/** Same, but only once its element is about to scroll into view. */
function useLazyThumb(item) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(() => !!(item && cachedThumb(item.id)));
  useEffect(() => {
    if (seen || !ref.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [seen]);
  return [useThumb(seen ? item : null, 2), ref];
}

function Tile({ item }) {
  const url = useThumb(item);
  return (
    <div className={`spin-tile spin-tile--${item.tier}`}>
      {url ? (
        <img className="spin-tile__img spin-tile__img--wide" src={url} alt="" />
      ) : (
        <div className="spin-tile__img spin-tile__img--wide" />
      )}
      <span className="spin-tile__name">
        <small>{itemTitle(item)}</small>
        {item.name}
      </span>
    </div>
  );
}

/* The case's contents for the list under the reel: guns by grade, commonest
   first; the rare specials get one tile of their own. */
const GRADE = { milspec: 0, restricted: 1, classified: 2, covert: 3 };
const TIER_RANK = { ...GRADE, gold: 4 };
const CONTENTS = {
  guns: CASE.items.filter((i) => i.kind === "gun").sort((p, q) => GRADE[p.tier] - GRADE[q.tier]),
};

export function CaseOpen({ onBack, onInventory }) {
  const items = CASE.items;
  const [idle, setIdle] = useState([]);
  const [strip, setStrip] = useState([]);
  const [offset, setOffset] = useState(0);
  const [phase, setPhase] = useState("idle"); // idle | spinning | done
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState(null);
  const [sound, setSound] = useState(true);

  const window_ = useRef(null);
  const track = useRef(null);
  const frame = useRef(0);
  const finishTimer = useRef(0);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  // the drawn item waits here until the reel stops; nothing reaches the
  // inventory (or its counter) while the reel is still running
  const pendingRef = useRef(null);
  // the x10: items drawn (and paid for) up front, waiting for their spin
  const queueRef = useRef([]);
  const batchRef = useRef(null); // { results: [{ item, drop }] } while a x10 runs
  const nextTimer = useRef(0);
  const [batch, setBatch] = useState(null); // { results, total, finished }
  const [spins, setSpins] = useState(inventory.get().spins);
  useEffect(() => inventory.subscribe((s) => setSpins(s.spins)), []);
  const store = (item) =>
    inventory.add(item.baseId || item.id, item.patternNo ? { pattern: item.patternNo } : {});
  const claim = () => {
    const item = pendingRef.current;
    if (!item) return null;
    pendingRef.current = null;
    return store(item);
  };
  // leaving mid-spin must not lose the drop (nor the rest of a x10)
  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      clearTimeout(finishTimer.current);
      clearTimeout(nextTimer.current);
      claim();
      for (const it of queueRef.current.splice(0)) store(it);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  // warm the thumbnails of everything that can show on the strip
  useEffect(() => {
    for (const it of items)
      if (it.tier !== "gold") thumbnail(it, { priority: 0 }).catch(() => {});
  }, [items]);

  /** The resting strip: enough tiles to overflow the window, not just one of each. */
  const buildIdle = useCallback(() => {
    const pool = items.filter((p) => IDLE_TIERS.includes(p.tier));
    const list = pool.length ? pool : items;
    const width = window_.current?.clientWidth || 900;
    const count = Math.ceil(width / (FALLBACK_TILE + FALLBACK_GAP)) + 3;
    const bag = [...list].sort(() => Math.random() - 0.5);
    setIdle(Array.from({ length: count }, (_, i) => bag[i % bag.length]));
  }, [items]);

  useLayoutEffect(() => {
    buildIdle();
    window.addEventListener("resize", buildIdle);
    return () => window.removeEventListener("resize", buildIdle);
  }, [buildIdle]);

  function run(winner, onLand) {
    const width = window_.current?.clientWidth || 900;
    const { tile: TILE, gap: GAP } = measureTile(track.current);
    const STEP = TILE + GAP;
    const profile = spinProfile(prefersReducedMotion(), !!onLand);

    const winnerAt = profile.tiles;
    const filler = () => {
      let p = Math.random();
      const tier =
        FILLER_TIERS.find((t) => (p -= STRIP_MIX[t]) < 0) || FILLER_TIERS[0];
      const pool = items.filter((i) => i.tier === tier);
      return pool[(Math.random() * pool.length) | 0];
    };
    const list = Array.from({ length: winnerAt + 10 }, (_, i) =>
      i === winnerAt ? winner : filler(),
    );

    // teases go before the winning tile, so they pass while the reel is still quick
    const taken = new Set([winnerAt]);
    for (const { tier, chance } of TEASES) {
      const pool = items.filter((p) => p.tier === tier);
      if (!pool.length || winner.tier === tier || Math.random() >= chance)
        continue;
      let at;
      do {
        at = 3 + Math.floor(Math.random() * Math.max(1, winnerAt - 4));
      } while (taken.has(at));
      taken.add(at);
      list[at] = pool[(Math.random() * pool.length) | 0];
    }
    setStrip(list);

    const from = width / 2 - TILE / 2;
    const to = width / 2 - (winnerAt * STEP + TILE * stopFraction());
    let lastIndex = -1;
    let done = false;
    const start = performance.now();

    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(frame.current);
      clearTimeout(finishTimer.current);
      setOffset(to);
      const drop = claim();
      if (onLand) {
        if (soundRef.current) playReveal(winner.tier);
        onLand(winner, drop);
        return;
      }
      setResult({ item: winner, drop });
      setPhase("done");
      setRevealed(true);
      if (soundRef.current) playReveal(winner.tier);
    };

    const step = (now) => {
      if (done) return;
      const t = Math.min(1, (now - start) / profile.durationMs);
      const x = from + (to - from) * ease(t, profile.friction);
      setOffset(x);
      // one tick per tile crossing the marker — it thins out by itself as the reel slows
      const index = Math.round((width / 2 - x - TILE / 2) / STEP);
      if (index !== lastIndex) {
        lastIndex = index;
        if (soundRef.current && t < 0.995 && !document.hidden) playTick();
      }
      if (t < 1) frame.current = requestAnimationFrame(step);
      else finish();
    };
    // a hidden tab gets no animation frames at all: this timer still fires
    // there, so the reel lands on time and the reveal plays while you are
    // on another tab, rather than the spin freezing until you come back
    finishTimer.current = setTimeout(finish, profile.durationMs + 30);
    frame.current = requestAnimationFrame(step);
  }

  function open(free = false) {
    // one kill = one key; no key, no case (the test button passes free)
    if (!free && !inventory.spendSpin()) return;
    // unlock audio right in the click, before anything async (Safari)
    if (soundRef.current) {
      unlock();
      playOpen();
    }
    setPhase("spinning");
    // a Case Hardened drop gets its pattern now, so the reel shows the real one
    const drawn = drawItem(items);
    const item = drawn.seeded ? variantOf(drawn, rollPattern()) : drawn;
    pendingRef.current = item;
    setResult(null);
    // the winning tile's picture must exist before it slides into view
    thumbnail(item, { priority: 10 })
      .catch(() => {})
      .finally(() => run(item));
  }

  const draw = () => {
    const drawn = drawItem(items);
    return drawn.seeded ? variantOf(drawn, rollPattern()) : drawn;
  };

  /* Open up to ten in a row: every key is spent and every item drawn now,
     then each gets a short spin of its own, back to back, and the lot is
     shown together at the end. "Bỏ qua" lands the rest at once. */
  function openMany(n = 10) {
    let k = 0;
    while (k < n && inventory.spendSpin()) k++;
    if (!k) return;
    if (soundRef.current) {
      unlock();
      playOpen();
    }
    queueRef.current = Array.from({ length: k }, draw);
    batchRef.current = { results: [], total: k };
    setBatch({ results: [], total: k, finished: false });
    setResult(null);
    setRevealed(false);
    setPhase("spinning");
    spinNext();
  }

  function spinNext() {
    const b = batchRef.current;
    const item = queueRef.current.shift();
    if (!b) return;
    if (!item) return endBatch();
    pendingRef.current = item;
    thumbnail(item, { priority: 10 })
      .catch(() => {})
      .finally(() => {
        if (batchRef.current !== b) return;
        run(item, (won, drop) => {
          b.results.push({ item: won, drop });
          setBatch({ results: [...b.results], total: b.total, finished: false });
          nextTimer.current = setTimeout(spinNext, 650);
        });
      });
  }

  function skipBatch() {
    const b = batchRef.current;
    if (!b) return;
    cancelAnimationFrame(frame.current);
    clearTimeout(finishTimer.current);
    clearTimeout(nextTimer.current);
    const cur = pendingRef.current;
    if (cur) b.results.push({ item: cur, drop: claim() });
    for (const it of queueRef.current.splice(0)) b.results.push({ item: it, drop: store(it) });
    endBatch();
  }

  function endBatch() {
    const b = batchRef.current;
    batchRef.current = null;
    if (!b) return;
    const best = [...b.results].sort((p, q) => TIER_RANK[q.item.tier] - TIER_RANK[p.item.tier])[0];
    setBatch({ results: b.results, total: b.total, finished: true });
    if (best) setResult(best);
    setPhase("done");
    if (soundRef.current && best) playReveal(best.item.tier);
  }

  function again() {
    setBatch(null);
    setResult(null);
    setStrip([]);
    setOffset(0);
    setPhase("idle");
    setRevealed(false);
  }

  const shown = strip.length ? strip : idle;
  const winUrl = useThumb(result?.item);

  return (
    <div className="plgk case-screen">
      <div className="spin-shell" aria-hidden="true" />
      <div className="wrap page spin-page">
        <div className="case-top">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onBack}
            disabled={phase === "spinning"}
          >
            ← Menu
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onInventory}
            disabled={phase === "spinning"}
          >
            Kho đồ ({inventory.get().items.length})
          </button>
        </div>
        <div className="page-head">
          <span className="eyebrow">{CASE.name}</span>
          <h1 style={{ marginTop: 10 }}>Mở hòm vũ khí</h1>
        </div>

        <div className="case-bar">
          <button
            type="button"
            className="case-sound"
            onClick={() => setSound((v) => !v)}
            aria-pressed={sound}
          >
            {sound ? "Âm thanh bật" : "Âm thanh tắt"}
          </button>
          <span className="case-credit">
            SFX: Valve /{" "}
            <a
              href="https://github.com/sourcesounds/csgo"
              target="_blank"
              rel="noreferrer noopener"
            >
              SourceSounds
            </a>
          </span>
          <span className="case-credit">
            Respect to{" "}
            <a
              href="https://github.com/truanayangi-com"
              target="_blank"
              rel="noreferrer noopener"
            >
              Truanayangi
            </a>
          </span>
        </div>

        <div className="case-panel">
          <div className="reel-window" ref={window_}>
            <span className="reel-marker" aria-hidden="true" />
            <div
              className="reel-track"
              ref={track}
              style={{ transform: `translate3d(${offset}px,0,0)` }}
            >
              {shown.map((p, i) => (
                <Tile key={i} item={p} />
              ))}
            </div>
            <span className="reel-fade reel-fade--l" aria-hidden="true" />
            <span className="reel-fade reel-fade--r" aria-hidden="true" />
          </div>
        </div>

        {phase === "done" && result ? (
          <div className={"result-card spin-tile--" + result.item.tier}>
            {winUrl && (
              <img
                className="result-card__img result-card__img--wide"
                src={winUrl}
                alt=""
              />
            )}
            <div style={{ minWidth: 0 }}>
              {batch && <span className="eyebrow">Tốt nhất trong {batch.results.length} hòm</span>}
              <h2>{itemLabel(result.item)}</h2>
              <p>{tierBySlug(result.item.tier).label} · đã vào kho đồ</p>
            </div>
            <button type="button" className="btn btn--ghost" onClick={again}>
              {spins > 0 ? `Mở tiếp · ${spins} lượt` : "Quay lại"}
            </button>
          </div>
        ) : (
          <div className="card spin-form">
            {batch && phase === "spinning" ? (
              <>
                <div className="batch-progress">
                  <span>Quay liền · hòm {Math.min(batch.results.length + 1, batch.total)}/{batch.total}</span>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={skipBatch}>
                    Bỏ qua ⏭
                  </button>
                </div>
                <BatchStrip results={batch.results} total={batch.total} />
              </>
            ) : (
              <div className="spin-actions">
                <button
                  type="button"
                  className="btn btn--primary btn--lg btn--block"
                  disabled={phase === "spinning" || spins <= 0}
                  onClick={() => open()}
                >
                  {phase === "spinning"
                    ? "Đang quay…"
                    : spins > 0
                      ? `Mở hòm · còn ${spins} lượt`
                      : "Hết lượt quay"}
                </button>
                <button
                  type="button"
                  className="btn btn--lg btn--block btn--x10"
                  disabled={phase === "spinning" || spins < 2}
                  onClick={() => openMany(10)}
                  title={spins < 10 && spins >= 2 ? `Chỉ còn ${spins} lượt: quay ${spins} lần` : undefined}
                >
                  Quay {spins >= 2 && spins < 10 ? spins : 10} lần liền
                </button>
              </div>
            )}
            {/* TEST ONLY: open without spending a spin. Comment out when done testing. */}
            {/* <button
              type="button"
              className="btn btn--ghost btn--block"
              disabled={phase === "spinning"}
              onClick={() => open(true)}
            >
              Quay test (không tốn lượt)
            </button> */}
            {/* END TEST ONLY */}
            <p className="faint" style={{ fontSize: 12, textAlign: "center" }}>
              Mỗi kill trong trận được 1 lượt quay (ở mọi chế độ).
            </p>
          </div>
        )}
        {/* what the case can drop, as CS:GO lists it under the case: every gun
            finish from the commonest grade up, then one gold tile standing in
            for all the rare specials (knives and gloves) */}
        <section className="case-contents">
          <h3>Vật phẩm trong hòm</h3>
          <div className="case-contents__grid">
            {CONTENTS.guns.map((it) => (
              <MiniItem key={it.id} item={it} />
            ))}
            <div className="mini-item mini-item--gold spin-tile--gold">
              <img src="/textures/rare_special.png" alt="" />
              <span>★ Rare Special Item ★</span>
            </div>
          </div>
        </section>
      </div>

      {batch?.finished && (
        <BatchModal results={batch.results} onClose={again} />
      )}
      {!batch && revealed && result && (
        <WinnerModal
          item={result.item}
          drop={result.drop}
          onClose={() => setRevealed(false)}
        />
      )}
    </div>
  );
}

/** The "you got" card, shared by the case and the trade up. */
export function WinnerModal({ item, drop, onClose, label = "Bạn nhận được" }) {
  const url = useThumb(item);
  const [equipped, setEquipped] = useState(false);
  return (
    <div
      className={"winner-modal spin-tile--" + item.tier}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="winner-modal__inner" onClick={(e) => e.stopPropagation()}>
        <span className="winner-modal__label">{label}</span>
        <h2 className="winner-modal__title">{itemLabel(item)}</h2>
        <p className="winner-modal__desc">
          {tierBySlug(item.tier).label}
          {item.detail ? ` · ${item.detail}` : ""}
        </p>
        <div className="winner-modal__art">
          {url && <img src={url} alt="" />}
        </div>
        <div className="winner-modal__actions">
          <span className="faint">
            Đồ đã nằm trong kho. Trang bị để mang vào trận.
          </span>
          <div className="row gap-8">
            <button
              type="button"
              className="btn btn--ghost"
              disabled={equipped || !drop}
              onClick={() => {
                inventory.equip(drop.uid);
                setEquipped(true);
              }}
            >
              {equipped ? "Đã trang bị" : "Trang bị ngay"}
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={onClose}
            >
              Tiếp tục
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The x10 so far: a slot per case, filled as each reel lands. */
function BatchStrip({ results, total }) {
  return (
    <div className="batch-strip">
      {Array.from({ length: total }, (_, i) =>
        results[i] ? (
          <BatchCell key={i} item={results[i].item} />
        ) : (
          <div key={i} className="batch-cell batch-cell--empty" />
        ),
      )}
    </div>
  );
}

function BatchCell({ item, big }) {
  const url = useThumb(item);
  return (
    <div className={`batch-cell spin-tile--${item.tier}${big ? " batch-cell--big" : ""}`} title={itemLabel(item)}>
      {url ? <img src={url} alt="" /> : <div className="mini-item__ph" />}
      {big && (
        <>
          <small>{itemTitle(item)}</small>
          <span>{item.name}</span>
        </>
      )}
    </div>
  );
}

/** Everything a x10 dropped, best first. */
function BatchModal({ results, onClose }) {
  const sorted = [...results].sort((p, q) => TIER_RANK[q.item.tier] - TIER_RANK[p.item.tier]);
  const top = sorted[0]?.item;
  return (
    <div className={"winner-modal spin-tile--" + (top?.tier || "milspec")} role="dialog" aria-modal="true" onClick={onClose}>
      <div className="winner-modal__inner batch-modal" onClick={(e) => e.stopPropagation()}>
        <span className="winner-modal__label">Bạn nhận được {results.length} món</span>
        <div className="batch-grid">
          {sorted.map((r, i) => (
            <BatchCell key={i} item={r.item} big />
          ))}
        </div>
        <div className="winner-modal__actions">
          <span className="faint">Tất cả đã nằm trong kho đồ.</span>
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Tiếp tục
          </button>
        </div>
      </div>
    </div>
  );
}

export function MiniItem({ item, children, onClick, active }) {
  const [url, ref] = useLazyThumb(item);
  return (
    <div
      ref={ref}
      className={`mini-item spin-tile--${item.tier}${active ? " is-on" : ""}${item.gem ? " is-gem" : ""}`}
      onClick={onClick}
      title={item.detail || undefined}
    >
      {url ? <img src={url} alt="" /> : <div className="mini-item__ph" />}
      <small>{itemTitle(item)}</small>
      <span>{item.name}</span>
      {children}
    </div>
  );
}
