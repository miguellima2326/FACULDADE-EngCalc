import React from "react";
import { DATA } from "@engcalc/core";

const pad2 = (n: number) => String(n + 1).padStart(2, "0");

/* ═══════════ Índice de cálculos: busca em todas as áreas, favoritos e recentes ═══════════ */
const FAV_KEY = "engcalc_favs";
const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function loadFavs(): string[] { try { const v = JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }
const ALL_CALCS = Object.entries(DATA as Record<string, any>).flatMap(([a, ar]) => ar.calcs.map((c: any, i: number) => ({ a, areaLabel: ar.label as string, c, i, key: `${a}/${c.id}` })));

export function CalcIndex({ area, areaKey, calcId, history, onOpen }: { area: any; areaKey: string; calcId: string | null; history: Array<{ areaKey: string; calcId: string }>; onOpen: (area: string, id: string) => void }) {
  const [q, setQ] = React.useState("");
  const [favs, setFavs] = React.useState<string[]>(loadFavs);
  const toggleFav = (key: string) => setFavs((f) => { const next = f.includes(key) ? f.filter((x) => x !== key) : [...f, key]; localStorage.setItem(FAV_KEY, JSON.stringify(next)); return next; });
  const byKey = (k: string) => ALL_CALCS.find((x) => x.key === k);
  const recentes = [...new Set(history.map((h) => `${h.areaKey}/${h.calcId}`))].map(byKey).filter(Boolean).slice(0, 5) as typeof ALL_CALCS;
  const favoritos = favs.map(byKey).filter(Boolean) as typeof ALL_CALCS;
  const query = norm(q.trim());
  const words = query.split(/\s+/).filter(Boolean);
  const results = query ? ALL_CALCS.filter((x) => { const hay = norm(`${x.c.name} ${x.c.desc} ${x.c.norma ?? ""} ${x.areaLabel} ${x.c.formula ?? ""}`); return words.every((w) => hay.includes(w)); }) : null;
  const list = results ?? ALL_CALCS.filter((x) => x.a === areaKey);
  const chip = (x: (typeof ALL_CALCS)[number]) => <button key={x.key} className="idx-chip" onClick={() => onOpen(x.a, x.c.id)} title={x.c.name}><span className="idx-chip-area">{x.areaLabel.slice(0, 3)}</span><span className="idx-chip-name">{x.c.name}</span></button>;
  return <section className="sheet" id="index-sheet">
    <div className="sheet-head"><span className="sheet-code">{results ? "BUS" : area.label.slice(0, 3).toUpperCase()}</span><span className="sheet-title">{results ? "Busca" : area.label}</span><span className="sheet-count">{results ? `${results.length} resultado(s) em todas as áreas` : `${area.calcs.length} cálculos · selecione um item`}</span></div>
    <div className="idx-search"><input type="search" placeholder="Buscar cálculo em todas as áreas (ex.: viga, cabo, curto, polia)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar cálculo" /></div>
    {!results && (favoritos.length > 0 || recentes.length > 0) && <div className="idx-quick">
      {favoritos.length > 0 && <div className="idx-quick-row"><span className="idx-quick-k">★ Favoritos</span>{favoritos.map(chip)}</div>}
      {recentes.length > 0 && <div className="idx-quick-row"><span className="idx-quick-k">◷ Recentes</span>{recentes.map(chip)}</div>}
    </div>}
    {list.map((x) => { const fav = favs.includes(x.key); return <div className="calc-row" key={x.key}>
      <button className={`calc-item ${x.c.id === calcId && x.a === areaKey ? "active" : ""}`} onClick={() => onOpen(x.a, x.c.id)}>
        <span className="calc-num">{results ? x.areaLabel.slice(0, 3).toUpperCase() : pad2(x.i)}</span>
        <span className="calc-info"><span className="calc-name">{x.c.name}</span><span className="calc-desc">{x.c.desc}</span></span>
        {x.c.norma ? <span className="norma-stamp">{x.c.norma}</span> : <span className="calc-index-arrow">→</span>}
      </button>
      <button className={`fav-btn${fav ? " on" : ""}`} onClick={() => toggleFav(x.key)} aria-pressed={fav} aria-label={fav ? `Tirar ${x.c.name} dos favoritos` : `Favoritar ${x.c.name}`} title={fav ? "Tirar dos favoritos" : "Favoritar"}>{fav ? "★" : "☆"}</button>
    </div>; })}
    {results?.length === 0 && <div className="hist-empty">Nenhum cálculo encontrado para "{q}".</div>}
  </section>;
}

