import { useEffect, useState } from "react";
import { game } from "../game/state";
import { startMatch } from "../game/rules";
import { DEFAULT_KNIFE, KNIVES } from "../lib/knives";
import { knife } from "../lib/knifeController";
import { isMuted, setMuted, unlockAudio } from "../lib/audio";
import { Scoreboard } from "./Scoreboard";
import { applyTheme, readStoredTheme, STORAGE_KEY, THEMES } from "../lib/theme";
import { inventory } from "../skins/inventory";
import { NAV } from "../game/nav";
import { loadLevel } from "../world/level";
import { W } from "../game/weapons";
import { LobbyAgent } from "./LobbyAgent";

// the gun the lobby agent holds by default: the solo pick, or the side's rifle
const TEAM_RIFLE = { T: "ak47", CT: "m4a4" };
const lobbyWeapon = (mode, team, aimWeapon) => (mode === "aim" ? aimWeapon : TEAM_RIFLE[team]);

const DIFFS = [
  { key: "easy", label: "Dễ" },
  { key: "normal", label: "Thường" },
  { key: "hard", label: "Khó" },
  { key: "expert", label: "Chuyên gia" },
];

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem("csgo-bots-prefs") || "{}");
  } catch {
    return {};
  }
}
function savePrefs(p) {
  try {
    localStorage.setItem("csgo-bots-prefs", JSON.stringify(p));
  } catch {
    /* private mode */
  }
}
/** Merge a few fields into the saved prefs right away (name, sensitivity). */
function patchPrefs(p) {
  savePrefs({ ...loadPrefs(), ...p });
}

/* Q / E: lean-and-aim when that is switched on; switched off (the default),
   Q is CS:GO's quick switch (the weapon you held before) and E does nothing. */
const LEAN_KEYS = [["Q", "E"], "nghiêng trái / phải"];
const SNAP_KEYS = [["Q"], "đổi nhanh về súng trước (snap)"];
const KEYS = [
  [["WASD"], "di chuyển"],
  [["Shift", "Ctrl"], "ngồi (không kêu)"],
  [["Space"], "nhảy"],
  LEAN_KEYS,
  [["LMB"], "bắn"],
  [["RMB"], "ngắm / scope / đâm"],
  [["R"], "nạp đạn"],
  [["1–5"], "đổi súng"],
  [["X"], "súng trước"],
  [["G"], "vứt súng"],
  [["F"], "nhặt / gỡ bom"],
  [["V"], "inspect"],
  [["R"], "múa dao (khi cầm dao)"],
  [["B"], "mua đồ"],
  [["Tab"], "bảng điểm"],
  [["M"], "tắt tiếng"],
  [["Esc"], "tạm dừng"],
];

function Controls({ lean = false }) {
  return (
    <div className="controls">
      {KEYS.map((row) => (row === LEAN_KEYS && !lean ? SNAP_KEYS : row)).map(([keys, what]) => (
        <div key={what} className={`ctl${keys.length > 3 ? " ctl--wide" : ""}`}>
          <span className="ctl-keys">
            {keys.map((k) => (
              <kbd key={k}>{k}</kbd>
            ))}
          </span>
          <span>{what}</span>
        </div>
      ))}
    </div>
  );
}

/* Light / dark, the plgk way: a data-theme attribute on <html>, tokens do the rest. */
function ThemeToggle() {
  const [theme, setTheme] = useState(readStoredTheme());
  const flip = () => {
    const next = theme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode */
    }
    setTheme(next);
  };
  return (
    <button
      type="button"
      className="icon-btn theme-toggle"
      onClick={flip}
      title={theme === THEMES.DARK ? "Giao diện sáng" : "Giao diện tối"}
    >
      {theme === THEMES.DARK ? (
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
        </svg>
      )}
    </button>
  );
}

export function MainMenu({ onStart, onCase, onInventory, onTradeUp }) {
  // the lobby always turns slowly over de_dust2, whatever map the last match was on
  useEffect(() => { loadLevel("dust2"); }, []);
  const prefs = loadPrefs();
  const [team, setTeam] = useState(prefs.team || "CT");
  const [diff, setDiff] = useState(prefs.difficulty || "normal");
  const [rounds, setRounds] = useState(prefs.maxRounds || 16);
  const [size, setSize] = useState(prefs.teamSize || 5);
  const [sens, setSens] = useState(prefs.sensitivity || 2);
  const [name, setName] = useState(prefs.name || "Bạn");
  const [lean, setLean] = useState(prefs.lean === true);
  const [mode, setMode] = useState(prefs.mode || "comp");
  // weapons since taken off the list map to what replaced them
  const [aimWeapon, setAimWeapon] = useState({ ssg08: "p90", deagle: "ak47", usp: "ak47", glock: "ak47", p250: "ak47" }[prefs.aimWeapon] || prefs.aimWeapon || "ak47");
  // the sidearm carried next to it
  const [aimPistol, setAimPistol] = useState(["usp", "glock", "deagle", "p250", "fiveseven"].includes(prefs.aimPistol) ? prefs.aimPistol : "usp");
  const [aimBots, setAimBots] = useState(prefs.aimBots || 1);
  const [aimRounds, setAimRounds] = useState(prefs.aimRounds || 10);
  const [aimMap, setAimMap] = useState(prefs.aimMap === "aim" ? "aim" : "arena");
  const [loading, setLoading] = useState(false);
  // every choice is remembered as it is made, not only when a match starts
  useEffect(() => {
    patchPrefs({ team, difficulty: diff, maxRounds: rounds, teamSize: size, mode, aimWeapon, aimPistol, aimBots, aimRounds, aimMap, lean });
  }, [team, diff, rounds, size, mode, aimWeapon, aimPistol, aimBots, aimRounds, aimMap, lean]);

  const start = async () => {
    const aim = mode === "aim";
    const settings = {
      mode,
      team: aim ? "CT" : team,
      difficulty: diff,
      teamSize: size,
      sensitivity: sens,
      playerName: name.trim() || "Bạn",
      maxRounds: aim ? aimRounds * 2 - 1 : rounds,
      aimWeapon,
      aimPistol,
      aimBots,
      aimMap,
      lean,
    };
    savePrefs({
      team,
      difficulty: diff,
      maxRounds: rounds,
      teamSize: size,
      sensitivity: sens,
      name,
      mode,
      aimWeapon,
      aimBots,
      aimRounds,
      aimMap,
      aimPistol,
      lean,
    });
    // everyone starts on the stock knife; a ★ knife only comes from a case
    const eq = inventory.equippedItem("knife");
    // a model knife carries its finish on the blade (or none: the file's own);
    // a Case Hardened knife is its catalog knife painted at its own pattern
    if (eq?.model) KNIVES[eq.knife].finish = eq.finish ? eq : null;
    else if (eq?.baseId) KNIVES[eq.baseId].finish = eq;
    knife.setKnife(eq ? (eq.model ? eq.knife : eq.baseId || eq.id) : DEFAULT_KNIFE);
    knife.refresh();
    unlockAudio();
    setLoading(true);
    await loadLevel(aim ? aimMap : "dust2");
    setLoading(false);
    startMatch(settings);
    onStart();
  };

  const aim = mode === "aim";
  const summary = aim
    ? `${aimMap === "arena" ? "Warehouse" : "Aim Garena"} · 1 vs ${aimBots} · ${W[aimWeapon].name} · thắng ${aimRounds} round`
    : `Dust · ${team === "CT" ? "Counter-Terrorist" : "Terrorist"} · ${size}v${size} · ${rounds === 16 ? "MR8" : "MR15"}`;

  return (
    <div className="menu plgk lobby">
      {(loading || !NAV.ready) && (
        <div className="loading-screen">
          <div className="loading-screen__grid" aria-hidden="true" />
          <div className="loading-screen__mark" aria-hidden="true"><i /><i /><i /><i /><b /></div>
          <div className="loading-screen__title">
            <div className="logo">
              AIM<span>·</span>GARENA
            </div>
            <em>shot match</em>
          </div>
          <div className="loading-screen__bar"><i /></div>
          <p className="loading-screen__msg">Đang tải map</p>
          <ul className="loading-screen__tags">
            <li>FANMADE GAME</li>
            <li>FOR FUN</li>
            <li>NON COMMERCIAL</li>
          </ul>
        </div>
      )}
      <div className="menu-card menu-main">
        <header className="mm-head">
          <div>
            <div className="logo">
              AIM<span>·</span>GARENA <em>shot match</em>
            </div>
            <p className="mm-tag">Rèn luyện kĩ năng FPS</p>
          </div>
          <ThemeToggle />
        </header>

        <div className="mm-body">
          {/* left: how the match is set up */}
          <section className="mm-col">
            <h3 className="mm-title">Chế độ chơi</h3>
            <div className="mm-modes">
              <button
                type="button"
                className={`mm-mode ${aim ? "on" : ""}`}
                onClick={() => setMode("aim")}
              >
                <b>Solo aim</b>
                <span>Warehouse / Aim Garena · 1 vs bot · round nhanh</span>
              </button>
              <button
                type="button"
                className={`mm-mode ${!aim ? "on" : ""}`}
                onClick={() => setMode("comp")}
              >
                <b>Competitive</b>
                <span>Dust · đặt / gỡ bom · 5v5</span>
              </button>
            </div>

            <h3 className="mm-title">Thiết lập trận</h3>
            <div className="mm-grid">
              {aim ? (
                <>
                  <Field label="Map" wide>
                    {[["arena", "Warehouse", "/textures/map_warehouse.jpg", "center 55%"], ["aim", "Aim Garena", "/textures/map_aim.jpg", "center 80%"]].map(([id, label, pic, at]) => (
                      <button key={id} className={`mapcard ${aimMap === id ? "on" : ""}`} onClick={() => setAimMap(id)}
                        style={{ backgroundImage: `url(${pic})`, backgroundPosition: at }}>
                        <span>{label}</span>
                      </button>
                    ))}
                  </Field>
                  <Field label="Súng" wide>
                    {["ak47", "m4a4", "m4a1s", "awp", "p90"].map(
                      (id) => (
                        <button
                          key={id}
                          className={aimWeapon === id ? "on" : ""}
                          onClick={() => setAimWeapon(id)}
                        >
                          {W[id].name}
                        </button>
                      ),
                    )}
                  </Field>
                  <Field label="Súng lục (vũ khí phụ)" wide>
                    {["usp", "glock", "deagle", "p250", "fiveseven"].map((id) => (
                      <button key={id} className={aimPistol === id ? "on" : ""} onClick={() => setAimPistol(id)}>
                        {W[id].name}
                      </button>
                    ))}
                  </Field>
                  <Field label="Số bot">
                    {[1, 2, 3, 5].map((n) => (
                      <button
                        key={n}
                        className={aimBots === n ? "on" : ""}
                        onClick={() => setAimBots(n)}
                      >
                        1v{n}
                      </button>
                    ))}
                  </Field>
                  <Field label="Thắng khi chạm">
                    {[5, 10, 15].map((n) => (
                      <button
                        key={n}
                        className={aimRounds === n ? "on" : ""}
                        onClick={() => setAimRounds(n)}
                      >
                        {n} round
                      </button>
                    ))}
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Phe">
                    <button
                      className={`ct ${team === "CT" ? "on" : ""}`}
                      onClick={() => setTeam("CT")}
                    >
                      Counter-Terrorist
                    </button>
                    <button
                      className={`t ${team === "T" ? "on" : ""}`}
                      onClick={() => setTeam("T")}
                    >
                      Terrorist
                    </button>
                  </Field>
                  <Field label="Số round">
                    <button
                      className={rounds === 16 ? "on" : ""}
                      onClick={() => setRounds(16)}
                    >
                      MR8 · ngắn
                    </button>
                    <button
                      className={rounds === 30 ? "on" : ""}
                      onClick={() => setRounds(30)}
                    >
                      MR15 · đủ
                    </button>
                  </Field>
                  <Field label="Số người mỗi đội">
                    {[2, 3, 5].map((n) => (
                      <button
                        key={n}
                        className={size === n ? "on" : ""}
                        onClick={() => setSize(n)}
                      >
                        {n}v{n}
                      </button>
                    ))}
                  </Field>
                </>
              )}
              <Field label="Độ khó bot" wide={!aim}>
                {DIFFS.map((d) => (
                  <button
                    key={d.key}
                    className={diff === d.key ? "on" : ""}
                    onClick={() => setDiff(d.key)}
                  >
                    {d.label}
                  </button>
                ))}
              </Field>
              {/* Q / E: lean and aim, or (off) Q as the quick switch */}
              {/* half width beside the difficulty in Solo aim; a row of its own in Competitive */}
              <Field label={lean ? "Nghiêng người nhắm · Q / E" : "Nghiêng người · tắt (Q = snap)"} wide={!aim}>
                <button className={lean ? "on" : ""} onClick={() => setLean(true)}>
                  Bật
                </button>
                <button className={!lean ? "on" : ""} onClick={() => setLean(false)}>
                  Tắt
                </button>
              </Field>
            </div>
          </section>

          {/* right: you, your loadout, and the button */}
          <aside className="mm-side">
            <div className="mm-panel">
              <h3 className="mm-title">Người chơi</h3>
              <label className="mm-label">
                Tên
                <input
                  className="name"
                  value={name}
                  maxLength={16}
                  onChange={(e) => {
                    setName(e.target.value);
                    patchPrefs({ name: e.target.value });
                  }}
                />
              </label>
              <label className="mm-label">
                Độ nhạy chuột <b>{sens.toFixed(2)}</b>
                <input
                  type="range"
                  min="0.3"
                  max="15"
                  step="0.05"
                  value={sens}
                  onChange={(e) => {
                    setSens(+e.target.value);
                    patchPrefs({ sensitivity: +e.target.value });
                  }}
                />
              </label>
            </div>

            <div className="mm-panel">
              <h3 className="mm-title">Kho vũ khí</h3>
              <div className="mm-knife">
                <span>Lượt quay</span>
                <b>
                  {inventory.get().spins}{" "}
                  <span className="faint">· (1 kill = 1 lượt)</span>
                </b>
              </div>
              <div className="menu-shop">
                <button
                  type="button"
                  className="btn btn--primary btn--led"
                  onClick={onCase}
                >
                  ★ Mở hòm · {inventory.get().spins}
                </button>
                <button type="button" className="btn" onClick={onInventory}>
                  Kho đồ · {inventory.get().items.length}
                </button>
                <button type="button" className="btn" onClick={onTradeUp}>
                  Trade up
                </button>
              </div>
            </div>

            <div className="mm-go">
              <p className="mm-summary">{summary}</p>
              <button
                className="play"
                onClick={start}
                disabled={!NAV.ready || loading}
              >
                {NAV.ready && !loading ? "VÀO TRẬN" : "ĐANG TẢI MAP…"}
              </button>
            </div>
          </aside>
        </div>

        <Controls lean={lean} />

        <footer className="made-by">
          <span>Made by</span>
          <img src="/plgk-logo.png" alt="plgk" />
        </footer>
      </div>
      {/* the agent beside the menu, holding the gun this match will start with */}
      <LobbyAgent team={aim ? "CT" : team} weapon={lobbyWeapon(mode, team, aimWeapon)} />
    </div>
  );
}

/** A labelled row of choice buttons in the menu grid. */
function Field({ label, wide = false, children }) {
  return (
    <div className={`mm-field${wide ? " mm-field--wide" : ""}`}>
      <span className="mm-label">{label}</span>
      <div className="seg">{children}</div>
    </div>
  );
}

export function PauseMenu({ onResume }) {
  const [muted, setM] = useState(isMuted());
  const [sens, setSens] = useState(game.settings.sensitivity);
  const lean = game.settings.lean === true;
  return (
    <div className="menu pause" onClick={onResume}>
      <div className="menu-card small" onClick={(e) => e.stopPropagation()}>
        <div className="logo small">TẠM DỪNG</div>
        <div className="row">
          <label>
            Độ nhạy chuột <b>{sens.toFixed(2)}</b>
          </label>
          <input
            type="range"
            min="0.3"
            max="15"
            step="0.05"
            value={sens}
            onChange={(e) => {
              setSens(+e.target.value);
              game.settings.sensitivity = +e.target.value;
              patchPrefs({ sensitivity: +e.target.value });
            }}
          />
        </div>
        <div className="row">
          <label>Âm thanh</label>
          <div className="seg">
            <button
              className={!muted ? "on" : ""}
              onClick={() => {
                setMuted(false);
                setM(false);
              }}
            >
              Bật
            </button>
            <button
              className={muted ? "on" : ""}
              onClick={() => {
                setMuted(true);
                setM(true);
              }}
            >
              Tắt
            </button>
          </div>
        </div>
        <button className="play" onClick={onResume}>
          TIẾP TỤC
        </button>
        <button
          className="ghost"
          onClick={() => {
            game.phase = "menu";
            game.local = null;
            game.agents = [];
            game.paused = false;
            document.exitPointerLock?.();
          }}
        >
          Thoát ra menu
        </button>
        <Controls lean={lean} />
      </div>
    </div>
  );
}

export function MatchEnd({ onRestart }) {
  const me = game.local;
  const mine = game.score[me.team],
    theirs = game.score[me.team === "T" ? "CT" : "T"];
  const res = mine > theirs ? "THẮNG" : mine < theirs ? "THUA" : "HOÀ";
  return (
    <div className="menu">
      <div className="menu-card wide">
        <div
          className={`logo result ${mine > theirs ? "win" : mine < theirs ? "lose" : ""}`}
        >
          {res} {mine} : {theirs}
        </div>
        <Scoreboard />
        <button
          className="play"
          onClick={() => {
            startMatch({
              ...game.settings,
              maxRounds: game.maxRounds,
              teamSize: game.agents.filter((a) => a.team === "T").length,
              team: game.settings.team,
            });
            onRestart();
          }}
        >
          ĐÁNH LẠI
        </button>
        <button
          className="ghost"
          onClick={() => {
            game.phase = "menu";
            game.local = null;
            game.agents = [];
          }}
        >
          Về menu
        </button>
      </div>
    </div>
  );
}
