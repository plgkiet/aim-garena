import { useEffect, useState } from "react";
import { ITEMS, TIERS } from "../skins/catalog"; // tierBySlug: only needed if the rarity tag comes back
import { inventory } from "../skins/inventory";
import { MiniItem, itemLabel } from "./CaseOpen";

const ORDER = Object.fromEntries(TIERS.map((t, i) => [t.slug, i]));

function useInventory() {
  const [s, set] = useState(inventory.get());
  useEffect(() => inventory.subscribe(set), []);
  return s;
}

export function Inventory({ onBack, onCase, onTradeUp, onOpen }) {
  const inv = useInventory();
  const [filter, setFilter] = useState("all");
  const [tier, setTier] = useState("all");
  const owned = inv.items
    .map((d) => ({ drop: d, item: inventory.itemOf(d) }))
    .filter((x) => x.item);
  const byKind = owned.filter(
    (x) =>
      filter === "all" ||
      (filter === "equipped"
        ? inventory.isEquipped(x.drop.uid)
        : filter === "knife"
          ? x.item.kind === "knife"
          : x.item.kind === "gun"),
  );
  const drops = byKind
    .filter((x) => tier === "all" || x.item.tier === tier)
    .sort(
      (a, b) =>
        ORDER[b.item.tier] - ORDER[a.item.tier] || b.drop.at - a.drop.at,
    );

  return (
    <div className="plgk case-screen">
      <div className="spin-shell" aria-hidden="true" />
      <div className="wrap page spin-page">
        <div className="case-top">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onBack}
          >
            ← Menu
          </button>
          <div className="row gap-8">
            {/* TEST ONLY: one of every skin and knife in the case. Comment out when done testing. */}
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => ITEMS.forEach((it) => inventory.add(it.id))}
            >
              Nhận full skin
            </button>
            {/* END TEST ONLY */}
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={onTradeUp}
            >
              Trade up
            </button>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={onCase}
            >
              Mở hòm
            </button>
          </div>
        </div>
        <div className="page-head">
          <span className="eyebrow">Kho đồ</span>
          <h1 style={{ marginTop: 10 }}>{inv.items.length} vật phẩm</h1>
          <p>
            Bấm vào một món để xem chi tiết và trang bị. Mỗi súng mang được một
            skin, dao mang được một con.
          </p>
        </div>

        <div className="inv-filters">
          {[
            ["all", "Tất cả"],
            ["gun", "Súng"],
            ["knife", "★ Dao"],
            ["equipped", `Đang dùng · ${Object.keys(inv.equipped).length}`],
          ].map(([k, l]) => (
            <button
              key={k}
              type="button"
              className={`btn btn--sm ${filter === k ? "btn--primary" : "btn--ghost"}`}
              onClick={() => setFilter(k)}
            >
              {l}
            </button>
          ))}
        </div>
        {/* rarity chips, in the grade's own colour, with how many you hold of each */}
        <div className="inv-filters inv-tiers">
          <button
            type="button"
            className={`tier-chip${tier === "all" ? " is-on" : ""}`}
            onClick={() => setTier("all")}
          >
            Mọi độ hiếm <b>{byKind.length}</b>
          </button>
          {[...TIERS].reverse().map((t) => {
            const n = byKind.filter((x) => x.item.tier === t.slug).length;
            return (
              <button
                key={t.slug}
                type="button"
                disabled={!n}
                className={`tier-chip spin-tile--${t.slug}${tier === t.slug ? " is-on" : ""}`}
                onClick={() => setTier(t.slug)}
              >
                <i />
                {t.label} <b>{n}</b>
              </button>
            );
          })}
        </div>

        {drops.length === 0 ? (
          <div className="card inv-empty">
            <p>
              {owned.length
                ? "Không có món nào khớp bộ lọc."
                : "Kho đang trống."}
            </p>
            {!owned.length && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={onCase}
              >
                Mở hòm đầu tiên
              </button>
            )}
          </div>
        ) : (
          <div className="case-grid inv-grid">
            {drops.map(({ drop, item }) => {
              const on = inventory.isEquipped(drop.uid);
              return (
                <MiniItem
                  key={drop.uid}
                  item={item}
                  active={on}
                  onClick={() => onOpen(drop.uid)}
                >
                  {/* rarity tag hidden; only the equipped badge shows
                  <em className="mini-item__tag" title={itemLabel(item)}>{on ? 'Đang dùng' : tierBySlug(item.tier).label}</em> */}
                  {on && (
                    <em className="mini-item__tag" title={itemLabel(item)}>
                      Đang dùng
                    </em>
                  )}
                </MiniItem>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
