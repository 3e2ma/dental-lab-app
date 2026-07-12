"use client";

import React, { useState, useEffect, useRef } from "react";
import { Plus, Minus, Trash2, X, RotateCcw, Search, Settings2, Calculator, Delete } from "lucide-react";
import { SEED_ITEMS } from "@/lib/seedItems";

const yen = (n) => `¥${Number(n || 0).toLocaleString("ja-JP")}`;
const uid = () => Math.random().toString(36).slice(2, 10);

export default function Page() {
  const [items, setItems] = useState(SEED_ITEMS);
  const [cart, setCart] = useState({}); // { itemId: qty }
  const [customLines, setCustomLines] = useState([]); // 明細に直接足した項目
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [taxRate, setTaxRate] = useState(10);
  const [pulseId, setPulseId] = useState(null);
  const [syncState, setSyncState] = useState("loading"); // loading | synced | error
  const [isPersistent, setIsPersistent] = useState(null); // true=Redis保存 / false=一時保存のみ
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcInput, setCalcInput] = useState("");
  const [calcAccum, setCalcAccum] = useState(null);
  const [calcOp, setCalcOp] = useState(null);
  const [calcName, setCalcName] = useState("");
  const saveItemsTimer = useRef(null);

  // ---- ロード（価格表はサーバーAPI経由で共有。計算内容は保存しない）----
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/items", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.items) && data.items.length) {
            setItems(data.items);
          }
          if (typeof data.persistent === "boolean") setIsPersistent(data.persistent);
          setSyncState("synced");
        } else {
          setSyncState("error");
        }
      } catch (e) {
        setSyncState("error");
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // ---- 価格表を定期的に再取得（他の人の編集を反映。自分が編集中は上書きしない）----
  useEffect(() => {
    if (!loaded) return;
    const interval = setInterval(async () => {
      if (editMode) return; // 編集中は取り込まない
      try {
        const res = await fetch("/api/items", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.items) && data.items.length) {
            setItems(data.items);
          }
          if (typeof data.persistent === "boolean") setIsPersistent(data.persistent);
          setSyncState("synced");
        }
      } catch (e) {
        setSyncState("error");
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [loaded, editMode]);

  // ---- 価格表の自動保存（共有・デバウンス）----
  useEffect(() => {
    if (!loaded) return;
    if (saveItemsTimer.current) clearTimeout(saveItemsTimer.current);
    saveItemsTimer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        });
        setSyncState(res.ok ? "synced" : "error");
      } catch (e) {
        setSyncState("error");
      }
    }, 500);
    return () => clearTimeout(saveItemsTimer.current);
  }, [items, loaded]);

  // ---- 計算内容（カート・その場追加項目・税率）は保存しない ----
  // ページを閉じる/リロードすると計算はリセットされます（意図的な仕様）

  // ---- カート操作（ポチポチ）----
  const bump = (id, delta) => {
    setCart((c) => {
      const next = Math.max(0, (c[id] || 0) + delta);
      const copy = { ...c };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
    if (delta > 0) {
      setPulseId(id);
      setTimeout(() => setPulseId((p) => (p === id ? null : p)), 220);
    }
  };

  const clearCart = () => {
    setCart({});
    setCustomLines([]);
  };

  // ---- カスタム明細（マスタにない項目をその場で追加）----
  const addCustomLine = () => {
    setCustomLines((ls) => [
      ...ls,
      { id: uid(), code: "", name: "新規項目", price: 0, qty: 1 },
    ]);
  };
  const updateCustomLine = (id, patch) => {
    setCustomLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };
  const removeCustomLine = (id) =>
    setCustomLines((ls) => ls.filter((l) => l.id !== id));

  // ---- 電卓で手入力 ----
  const applyOp = (a, b, op) => (op === "-" ? a - b : a + b);

  const openCalc = () => {
    setCalcInput("");
    setCalcAccum(null);
    setCalcOp(null);
    setCalcName("");
    setCalcOpen(true);
  };
  const closeCalc = () => setCalcOpen(false);

  const calcPressDigit = (d) => {
    setCalcInput((s) => {
      if (d === "." && s.includes(".")) return s;
      if (s.length >= 9) return s;
      return s + d;
    });
  };
  const calcBackspace = () => setCalcInput((s) => s.slice(0, -1));
  const calcClear = () => {
    setCalcInput("");
    setCalcAccum(null);
    setCalcOp(null);
  };
  const calcPressOp = (op) => {
    setCalcAccum((accum) => {
      const current = Number(calcInput || 0);
      const next = accum == null ? current : applyOp(accum, current, calcOp);
      return next;
    });
    setCalcOp(op);
    setCalcInput("");
  };
  const calcResultValue = () => {
    const current = Number(calcInput || 0);
    return calcAccum == null ? current : applyOp(calcAccum, current, calcOp);
  };
  const calcPressEquals = () => {
    const result = calcResultValue();
    setCalcAccum(result);
    setCalcOp(null);
    setCalcInput(String(result));
  };
  const calcConfirm = () => {
    const value = calcResultValue();
    setCustomLines((ls) => [
      ...ls,
      {
        id: uid(),
        code: "",
        name: calcName.trim() || "手入力",
        price: value,
        qty: 1,
      },
    ]);
    setCalcOpen(false);
  };
  const calcDisplay =
    calcAccum != null
      ? `${calcAccum.toLocaleString("ja-JP")}${calcOp || ""} ${calcInput}`
      : calcInput || "0";

  // ---- マスタ編集 ----
  const updateItem = (id, patch) => {
    setItems((its) => its.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };
  const removeItem = (id) => {
    setItems((its) => its.filter((it) => it.id !== id));
    setCart((c) => {
      const copy = { ...c };
      delete copy[id];
      return copy;
    });
  };
  const addItem = () => {
    const id = uid();
    setItems((its) => [...its, { id, code: "", name: "新規項目", price: 0 }]);
  };
  const resetToSeed = () => {
    setItems(SEED_ITEMS);
  };

  // ---- 集計 ----
  const cartLines = Object.entries(cart)
    .map(([id, qty]) => {
      const item = items.find((it) => it.id === id);
      if (!item) return null;
      return { ...item, qty };
    })
    .filter(Boolean);

  const allLines = [...cartLines, ...customLines];
  const subtotal = allLines.reduce(
    (s, l) => s + Number(l.price || 0) * Number(l.qty || 0),
    0
  );
  const tax = Math.round(subtotal * (Number(taxRate || 0) / 100));
  const total = subtotal + tax;
  const itemCount = allLines.reduce((s, l) => s + Number(l.qty || 0), 0);

  const filteredItems = items.filter((it) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return it.code.toLowerCase().includes(q) || it.name.toLowerCase().includes(q);
  });

  return (
    <div style={styles.page}>
      <style>{fontImport}</style>
      <div style={styles.wrap}>
        {/* ヘッダー */}
        <header style={styles.header}>
          <div>
            <div style={styles.eyebrow}>DENTAL LAB · 請求計算</div>
            <h1 style={styles.title}>技工物 請求計算</h1>
          </div>
          <button
            style={editMode ? styles.editToggleOn : styles.editToggle}
            onClick={() => setEditMode((s) => !s)}
          >
            <Settings2 size={14} />
            {editMode ? "完了" : "項目を編集"}
          </button>
        </header>

        <div style={styles.searchRow}>
          <Search size={15} color="#7c8a94" />
          <input
            style={styles.searchInput}
            placeholder="コード・項目名で検索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* ===== タップグリッド / 編集グリッド ===== */}
        {!editMode ? (
          <div className="chip-grid" style={styles.chipGrid}>
            {filteredItems.map((it) => {
              const qty = cart[it.id] || 0;
              return (
                <div
                  key={it.id}
                  style={{
                    ...styles.chip,
                    ...(qty > 0 ? styles.chipActive : {}),
                    ...(pulseId === it.id ? styles.chipPulse : {}),
                  }}
                >
                  <button style={styles.chipTap} onClick={() => bump(it.id, 1)}>
                    <span style={styles.chipCode}>{it.code || "—"}</span>
                    <span style={styles.chipName}>{it.name}</span>
                    <span style={styles.chipPrice}>{yen(it.price)}</span>
                  </button>
                  {qty > 0 && (
                    <div style={styles.chipStepper}>
                      <button style={styles.stepBtn} onClick={() => bump(it.id, -1)}>
                        <Minus size={13} />
                      </button>
                      <span style={styles.stepQty}>{qty}</span>
                      <button style={styles.stepBtnPlus} onClick={() => bump(it.id, 1)}>
                        <Plus size={13} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {filteredItems.length === 0 && (
              <div style={styles.emptyNote}>該当する項目がありません</div>
            )}
          </div>
        ) : (
          <div style={styles.editList}>
            <div style={isPersistent === false ? styles.warnNote : styles.sharedNote}>
              {isPersistent === false
                ? "⚠ データベースが未接続のため、この変更は一時的にしか保存されません。他の人には反映されない可能性があります（README参照）。"
                : "この価格表は全員で共有されます。ここでの変更は他の人にも反映されます（数秒〜最大8秒ほどで同期）。"}
            </div>
            {filteredItems.map((it) => (
              <div key={it.id} style={styles.editRow}>
                <input
                  style={styles.editCode}
                  value={it.code}
                  placeholder="コード"
                  onChange={(e) => updateItem(it.id, { code: e.target.value })}
                />
                <input
                  style={styles.editName}
                  value={it.name}
                  placeholder="項目名"
                  onChange={(e) => updateItem(it.id, { name: e.target.value })}
                />
                <input
                  style={styles.editPrice}
                  type="number"
                  value={it.price}
                  onChange={(e) => updateItem(it.id, { price: Number(e.target.value) })}
                />
                <button
                  style={styles.deleteBtn}
                  onClick={() => removeItem(it.id)}
                  title="項目を削除"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <div style={styles.panelFooter}>
              <button style={styles.ghostBtn} onClick={addItem}>
                <Plus size={14} /> 項目を追加
              </button>
              <button style={styles.ghostBtnMuted} onClick={resetToSeed}>
                <RotateCcw size={13} /> 初期状態に戻す
              </button>
            </div>
          </div>
        )}

        {/* ===== カスタム明細（一覧にない項目）===== */}
        {customLines.length > 0 && (
          <div style={styles.customBlock}>
            <div style={styles.customLabel}>その場で追加した項目</div>
            {customLines.map((l) => (
              <div key={l.id} style={styles.customRow}>
                <input
                  style={{ ...styles.cellInput, flex: "0 0 56px" }}
                  value={l.code}
                  placeholder="コード"
                  onChange={(e) => updateCustomLine(l.id, { code: e.target.value })}
                />
                <input
                  style={{ ...styles.cellInput, flex: 1, textAlign: "left" }}
                  value={l.name}
                  onChange={(e) => updateCustomLine(l.id, { name: e.target.value })}
                />
                <input
                  style={{ ...styles.cellInput, flex: "0 0 78px" }}
                  type="number"
                  value={l.price}
                  onChange={(e) =>
                    updateCustomLine(l.id, { price: Number(e.target.value) })
                  }
                />
                <div style={styles.customStepper}>
                  <button
                    style={styles.stepBtn}
                    onClick={() =>
                      updateCustomLine(l.id, { qty: Math.max(0, l.qty - 1) })
                    }
                  >
                    <Minus size={12} />
                  </button>
                  <span style={styles.stepQty}>{l.qty}</span>
                  <button
                    style={styles.stepBtnPlus}
                    onClick={() => updateCustomLine(l.id, { qty: l.qty + 1 })}
                  >
                    <Plus size={12} />
                  </button>
                </div>
                <button style={styles.lineDelete} onClick={() => removeCustomLine(l.id)}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={styles.addBtnRow}>
          <button style={styles.addLineBtn} onClick={addCustomLine}>
            <Plus size={14} /> リストにない項目を追加
          </button>
          <button style={styles.calcBtn} onClick={openCalc}>
            <Calculator size={14} /> 電卓で入力
          </button>
        </div>

        {/* ===== 下部固定：合計バー ===== */}
        <div style={styles.summaryBar}>
          <div style={styles.summaryTop}>
            <span style={styles.summaryCount}>
              {itemCount > 0 ? `${itemCount} 点` : "未選択"}
            </span>
            {allLines.length > 0 && (
              <button style={styles.clearBtn} onClick={clearCart}>
                <Trash2 size={12} /> すべて削除
              </button>
            )}
          </div>

          {allLines.length > 0 && (
            <div style={styles.summaryLines}>
              {allLines.map((l, i) => (
                <div key={l.id || i} style={styles.summaryLineRow}>
                  <span style={styles.summaryLineName}>
                    {l.code ? `[${l.code}] ` : ""}
                    {l.name} × {l.qty}
                  </span>
                  <span style={styles.mono}>
                    {yen(Number(l.price || 0) * Number(l.qty || 0))}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={styles.summaryRow}>
            <span>小計</span>
            <span style={styles.mono}>{yen(subtotal)}</span>
          </div>
          <div style={styles.summaryRow}>
            <span style={styles.taxLabel}>
              消費税
              <input
                style={styles.taxInput}
                type="number"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
              />
              %
            </span>
            <span style={styles.mono}>{yen(tax)}</span>
          </div>
          <div style={styles.summaryTotalRow}>
            <span>合計</span>
            <span style={styles.mono}>{yen(total)}</span>
          </div>

          <div style={styles.savedNote}>
            {syncState === "synced" && (
              <>
                <span style={styles.dot} /> 価格表は同期済み・計算内容は保存されません
              </>
            )}
            {syncState === "loading" && "価格表を読み込み中…"}
            {syncState === "error" && "価格表の同期に失敗しました（オフラインの可能性）"}
          </div>
        </div>
      </div>

      {/* ===== 電卓モーダル ===== */}
      {calcOpen && (
        <div style={styles.calcOverlay} onClick={closeCalc}>
          <div style={styles.calcPanel} onClick={(e) => e.stopPropagation()}>
            <div style={styles.calcHead}>
              <span style={styles.calcTitle}>電卓で金額を入力</span>
              <button style={styles.calcCloseBtn} onClick={closeCalc}>
                <X size={16} />
              </button>
            </div>

            <input
              style={styles.calcNameInput}
              placeholder="項目名（省略可・後で編集も可能）"
              value={calcName}
              onChange={(e) => setCalcName(e.target.value)}
            />

            <div style={styles.calcDisplay}>¥{calcDisplay}</div>

            <div style={styles.calcGrid}>
              {["7", "8", "9"].map((d) => (
                <button key={d} style={styles.calcKey} onClick={() => calcPressDigit(d)}>
                  {d}
                </button>
              ))}
              <button style={styles.calcKeyOp} onClick={calcBackspace}>
                <Delete size={16} />
              </button>

              {["4", "5", "6"].map((d) => (
                <button key={d} style={styles.calcKey} onClick={() => calcPressDigit(d)}>
                  {d}
                </button>
              ))}
              <button style={styles.calcKeyOp} onClick={() => calcPressOp("-")}>
                −
              </button>

              {["1", "2", "3"].map((d) => (
                <button key={d} style={styles.calcKey} onClick={() => calcPressDigit(d)}>
                  {d}
                </button>
              ))}
              <button style={styles.calcKeyOp} onClick={() => calcPressOp("+")}>
                ＋
              </button>

              <button style={styles.calcKeyMuted} onClick={calcClear}>
                C
              </button>
              <button style={styles.calcKey} onClick={() => calcPressDigit("0")}>
                0
              </button>
              <button style={styles.calcKey} onClick={() => calcPressDigit("00")}>
                00
              </button>
              <button style={styles.calcKeyOp} onClick={calcPressEquals}>
                =
              </button>
            </div>

            <button style={styles.calcConfirmBtn} onClick={calcConfirm}>
              この金額で明細に追加
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const fontImport = `
@import url('https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700;900&family=JetBrains+Mono:wght@500;700&display=swap');
input:focus { outline: 2px solid #0f6f5c; outline-offset: 1px; }
button:focus-visible { outline: 2px solid #0f6f5c; outline-offset: 2px; }
input[type=number]::-webkit-outer-spin-button,
input[type=number]::-webkit-inner-spin-button { opacity: 0.4; }
@media (min-width: 720px) {
  .chip-grid { grid-template-columns: repeat(3, 1fr) !important; }
}
@media (min-width: 1000px) {
  .chip-grid { grid-template-columns: repeat(4, 1fr) !important; }
}
`;

const COLORS = {
  bg: "#F3F1EC",
  panel: "#FFFFFF",
  ink: "#1B2320",
  sub: "#5C6B66",
  line: "#E1DDD3",
  accent: "#0F6F5C",
  accentSoft: "#E4F0EC",
  danger: "#B3492F",
};

const styles = {
  page: {
    minHeight: "100vh",
    background: COLORS.bg,
    fontFamily: "'Zen Kaku Gothic New', 'Hiragino Sans', sans-serif",
    color: COLORS.ink,
    padding: "18px 12px 24px",
  },
  wrap: { maxWidth: 1040, margin: "0 auto" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 14,
    flexWrap: "wrap",
    gap: 8,
    borderBottom: `2px solid ${COLORS.ink}`,
    paddingBottom: 12,
  },
  eyebrow: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    letterSpacing: "0.14em",
    color: COLORS.accent,
    fontWeight: 700,
    marginBottom: 4,
  },
  title: { margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: "0.02em" },
  editToggle: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    background: "transparent",
    border: `1px solid ${COLORS.line}`,
    color: COLORS.sub,
    borderRadius: 8,
    padding: "7px 12px",
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
  },
  editToggleOn: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    background: COLORS.ink,
    border: `1px solid ${COLORS.ink}`,
    color: "#fff",
    borderRadius: 8,
    padding: "7px 12px",
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
  },
  searchRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: COLORS.panel,
    border: `1px solid ${COLORS.line}`,
    borderRadius: 9,
    padding: "9px 12px",
    marginBottom: 12,
  },
  searchInput: {
    border: "none",
    background: "transparent",
    fontSize: 14,
    flex: 1,
    color: COLORS.ink,
  },
  chipGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    position: "relative",
    background: COLORS.panel,
    border: `1.5px solid ${COLORS.line}`,
    borderRadius: 12,
    overflow: "hidden",
    transition: "border-color 120ms ease, transform 120ms ease",
  },
  chipActive: {
    border: `1.5px solid ${COLORS.accent}`,
    background: COLORS.accentSoft,
  },
  chipPulse: {
    transform: "scale(0.97)",
  },
  chipTap: {
    width: "100%",
    background: "transparent",
    border: "none",
    textAlign: "left",
    padding: "12px 12px 10px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  chipCode: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    fontWeight: 700,
    color: COLORS.accent,
  },
  chipName: {
    fontSize: 13.5,
    fontWeight: 700,
    color: COLORS.ink,
    lineHeight: 1.25,
  },
  chipPrice: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12.5,
    color: COLORS.sub,
  },
  chipStepper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: COLORS.accent,
    padding: "6px 10px",
  },
  stepBtn: {
    width: 26,
    height: 26,
    borderRadius: 7,
    border: "none",
    background: "rgba(255,255,255,0.25)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  stepBtnPlus: {
    width: 26,
    height: 26,
    borderRadius: 7,
    border: "none",
    background: "rgba(255,255,255,0.95)",
    color: COLORS.accent,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  stepQty: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 14,
    fontWeight: 700,
    color: "#fff",
    minWidth: 18,
    textAlign: "center",
  },
  emptyNote: {
    gridColumn: "1 / -1",
    fontSize: 12.5,
    color: COLORS.sub,
    padding: "18px 4px",
    textAlign: "center",
  },
  editList: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    marginBottom: 14,
    background: COLORS.panel,
    border: `1px solid ${COLORS.line}`,
    borderRadius: 10,
    padding: 10,
  },
  editRow: {
    display: "flex",
    gap: 6,
    alignItems: "center",
    padding: "5px 2px",
    borderBottom: `1px solid ${COLORS.line}`,
  },
  editCode: {
    flex: "0 0 56px",
    fontSize: 12,
    padding: "6px 6px",
    border: `1px solid ${COLORS.line}`,
    borderRadius: 6,
    fontFamily: "'JetBrains Mono', monospace",
  },
  editName: {
    flex: 1,
    fontSize: 13,
    padding: "6px 8px",
    border: `1px solid ${COLORS.line}`,
    borderRadius: 6,
  },
  editPrice: {
    flex: "0 0 84px",
    fontSize: 12.5,
    padding: "6px 6px",
    border: `1px solid ${COLORS.line}`,
    borderRadius: 6,
    textAlign: "right",
    fontFamily: "'JetBrains Mono', monospace",
  },
  deleteBtn: {
    background: "transparent",
    border: "none",
    color: COLORS.danger,
    cursor: "pointer",
    padding: 4,
  },
  panelFooter: {
    display: "flex",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap",
  },
  ghostBtn: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    background: COLORS.accent,
    color: "#fff",
    border: "none",
    borderRadius: 7,
    padding: "8px 12px",
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
  },
  ghostBtnMuted: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    background: "transparent",
    color: COLORS.sub,
    border: `1px solid ${COLORS.line}`,
    borderRadius: 7,
    padding: "8px 12px",
    fontSize: 12.5,
    cursor: "pointer",
  },
  customBlock: {
    background: COLORS.panel,
    border: `1px solid ${COLORS.line}`,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  customLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: COLORS.sub,
    marginBottom: 6,
  },
  customRow: {
    display: "flex",
    gap: 6,
    alignItems: "center",
    padding: "5px 2px",
    borderBottom: `1px solid ${COLORS.line}`,
  },
  customStepper: {
    flex: "0 0 78px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    background: COLORS.accentSoft,
    borderRadius: 7,
    padding: "3px 4px",
  },
  cellInput: {
    fontSize: 12.5,
    padding: "6px 6px",
    border: `1px solid ${COLORS.line}`,
    borderRadius: 6,
    textAlign: "right",
    fontFamily: "'JetBrains Mono', monospace",
    minWidth: 0,
  },
  lineDelete: {
    flex: "0 0 24px",
    background: "transparent",
    border: "none",
    color: COLORS.sub,
    cursor: "pointer",
    display: "flex",
    justifyContent: "center",
  },
  addBtnRow: {
    display: "flex",
    gap: 8,
    marginBottom: 90,
  },
  addLineBtn: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    flex: 1,
    background: "transparent",
    border: `1px dashed ${COLORS.line}`,
    borderRadius: 9,
    padding: "10px 12px",
    fontSize: 12.5,
    color: COLORS.accent,
    fontWeight: 700,
    cursor: "pointer",
    justifyContent: "center",
  },
  calcBtn: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    flex: 1,
    background: COLORS.ink,
    border: `1px solid ${COLORS.ink}`,
    borderRadius: 9,
    padding: "10px 12px",
    fontSize: 12.5,
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    justifyContent: "center",
  },
  calcOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(27,35,32,0.45)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    zIndex: 50,
  },
  calcPanel: {
    width: "100%",
    maxWidth: 420,
    background: COLORS.panel,
    borderRadius: "16px 16px 0 0",
    padding: "14px 16px 20px",
    boxShadow: "0 -8px 30px rgba(0,0,0,0.25)",
  },
  calcHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  calcTitle: { fontSize: 14, fontWeight: 700, color: COLORS.ink },
  calcCloseBtn: {
    background: COLORS.bg,
    border: "none",
    borderRadius: 7,
    padding: 6,
    color: COLORS.sub,
    cursor: "pointer",
    display: "flex",
  },
  calcNameInput: {
    width: "100%",
    fontSize: 13,
    padding: "9px 10px",
    border: `1px solid ${COLORS.line}`,
    borderRadius: 8,
    marginBottom: 10,
  },
  calcDisplay: {
    textAlign: "right",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 30,
    fontWeight: 700,
    color: COLORS.ink,
    background: COLORS.bg,
    border: `1px solid ${COLORS.line}`,
    borderRadius: 10,
    padding: "14px 14px",
    marginBottom: 10,
    overflowX: "auto",
    whiteSpace: "nowrap",
  },
  calcGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 8,
    marginBottom: 12,
  },
  calcKey: {
    padding: "16px 0",
    fontSize: 18,
    fontWeight: 700,
    fontFamily: "'JetBrains Mono', monospace",
    background: COLORS.bg,
    border: `1px solid ${COLORS.line}`,
    borderRadius: 10,
    color: COLORS.ink,
    cursor: "pointer",
  },
  calcKeyMuted: {
    padding: "16px 0",
    fontSize: 16,
    fontWeight: 700,
    background: COLORS.bg,
    border: `1px solid ${COLORS.line}`,
    borderRadius: 10,
    color: COLORS.danger,
    cursor: "pointer",
  },
  calcKeyOp: {
    padding: "16px 0",
    fontSize: 18,
    fontWeight: 700,
    background: COLORS.accentSoft,
    border: `1px solid ${COLORS.accent}`,
    borderRadius: 10,
    color: COLORS.accent,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  calcConfirmBtn: {
    width: "100%",
    background: COLORS.accent,
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "13px 0",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  summaryBar: {
    position: "sticky",
    bottom: 10,
    background: COLORS.panel,
    border: `1.5px solid ${COLORS.ink}`,
    borderRadius: 12,
    padding: "12px 14px",
    boxShadow: "0 6px 20px rgba(27,35,32,0.14)",
  },
  summaryTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  summaryCount: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12,
    fontWeight: 700,
    color: COLORS.accent,
  },
  clearBtn: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    background: "transparent",
    border: "none",
    color: COLORS.danger,
    fontSize: 11.5,
    cursor: "pointer",
  },
  summaryLines: {
    maxHeight: 120,
    overflowY: "auto",
    borderTop: `1px solid ${COLORS.line}`,
    borderBottom: `1px solid ${COLORS.line}`,
    padding: "4px 0",
    marginBottom: 4,
  },
  summaryLineRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    color: COLORS.sub,
    padding: "3px 2px",
  },
  summaryLineName: { flex: 1, marginRight: 8 },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
    padding: "4px 2px",
    color: COLORS.sub,
  },
  taxLabel: { display: "flex", alignItems: "center", gap: 6 },
  taxInput: {
    width: 40,
    fontSize: 12,
    padding: "3px 4px",
    border: `1px solid ${COLORS.line}`,
    borderRadius: 5,
    textAlign: "center",
    fontFamily: "'JetBrains Mono', monospace",
  },
  summaryTotalRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 19,
    fontWeight: 900,
    padding: "8px 2px 2px",
    color: COLORS.ink,
    borderTop: `2px solid ${COLORS.ink}`,
    marginTop: 4,
  },
  sharedNote: {
    fontSize: 11,
    color: COLORS.accent,
    background: COLORS.accentSoft,
    border: `1px solid ${COLORS.accent}`,
    borderRadius: 7,
    padding: "6px 9px",
    marginBottom: 8,
    lineHeight: 1.4,
  },
  warnNote: {
    fontSize: 11,
    color: "#8a4a12",
    background: "#FBEBD9",
    border: "1px solid #C97A2B",
    borderRadius: 7,
    padding: "6px 9px",
    marginBottom: 8,
    lineHeight: 1.4,
  },
  savedNote: {
    fontSize: 10.5,
    color: COLORS.sub,
    display: "flex",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
    fontFamily: "'JetBrains Mono', monospace",
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 99,
    background: COLORS.accent,
    display: "inline-block",
  },
  mono: { fontFamily: "'JetBrains Mono', monospace" },
};
