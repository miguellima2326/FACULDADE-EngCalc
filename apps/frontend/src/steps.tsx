import React from "react";
import type { Step, Material, CalcReference } from "@engcalc/core";

/* ═══════════════════════════════════════════════════════════════
   Passo a passo · conferir resposta · exemplos de livro · comparação · custo
   ═══════════════════════════════════════════════════════════════ */

export const br = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d).replace(".", ",") : "—");
const parseUser = (s: string) => { const v = Number(s.trim().replace(/\s/g, "").replace(",", ".")); return s.trim() === "" || !Number.isFinite(v) ? null : v; };

/** A resposta confere? Tolerância: 1 % do valor ou meia unidade da última casa exibida. */
export function confere(user: number, ref: number, dec = 2) {
  const tol = Math.max(Math.abs(ref) * 0.01, 0.5 * 10 ** -dec);
  return Math.abs(user - ref) <= tol;
}

export function StepsBlock({ steps, reference }: { steps: Step[]; reference?: CalcReference | null }) {
  const [checking, setChecking] = React.useState(false);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  React.useEffect(() => setAnswers({}), [steps]);
  const exp = reference?.expected ?? {};
  const results = steps.map((s) => { const u = parseUser(answers[s.id] ?? ""); return u === null ? null : confere(u, s.value, s.dec ?? 2); });
  const answered = results.filter((r) => r !== null).length;
  const firstWrong = results.findIndex((r) => r === false);
  const ok = results.filter((r) => r === true).length;
  return <div className="steps">
    <div className="steps-head">
      <span className="ws-block-label">Passo a passo</span>
      <button className={`ws-tool${checking ? " on" : ""}`} onClick={() => setChecking((c) => !c)} aria-pressed={checking}>{checking ? "fechar conferência" : "conferir minha resposta"}</button>
    </div>
    {checking && <div className="steps-check-help">
      Digite os valores que você achou na mão (vírgula ou ponto). Não precisa preencher todos: o site compara cada um com tolerância de 1 %.
      {answered > 0 && <div className={`steps-check-sum ${firstWrong >= 0 ? "bad" : "ok"}`}>
        {firstWrong >= 0
          ? <>✗ {ok} de {answered} conferem. Sua conta diverge a partir do <b>passo {String(firstWrong + 1).padStart(2, "0")} — {steps[firstWrong]!.label}</b>. Refaça esse passo usando os números que aparecem nele, depois da fórmula.</>
          : <>✓ {ok} de {answered} conferem.</>}
      </div>}
    </div>}
    <ol className="steps-list">{steps.map((s, i) => {
      const e = exp[s.id];
      const bookOk = e ? Math.abs(s.value - e.value) <= e.tol : null;
      const r = results[i];
      return <li key={s.id} className={`step${r === false ? " step-bad" : r === true ? " step-ok" : ""}${i === firstWrong ? " step-first" : ""}`}>
        <span className="step-num">{String(i + 1).padStart(2, "0")}</span>
        <div className="step-body">
          <div className="step-label">{s.label}</div>
          <div className="step-math"><span className="step-expr">{s.expr}</span>{s.subst && <><span className="step-eq"> = </span><span className="step-subst">{s.subst}</span></>}</div>
          {e && <div className={`step-book ${bookOk ? "ok" : "bad"}`}>{bookOk ? "✓" : "✗"} livro: {br(e.value, s.dec ?? 2)} {s.unit}</div>}
        </div>
        <span className="step-res"><b>{br(s.value, s.dec ?? 2)}</b> {s.unit}</span>
        {checking && <span className="step-user">
          <input inputMode="decimal" aria-label={`Sua resposta para ${s.label}`} placeholder="sua resposta" value={answers[s.id] ?? ""} onChange={(ev) => setAnswers((a) => ({ ...a, [s.id]: ev.target.value }))} />
          <span className="step-mark" aria-hidden="true">{r === null ? "" : r ? "✓" : "✗"}</span>
        </span>}
      </li>;
    })}</ol>
  </div>;
}

/** Botões "exemplo do livro" + nota da fonte do exemplo carregado. */
export function ReferenceBar({ refs, active, onLoad }: { refs: CalcReference[]; active: CalcReference | null; onLoad: (r: CalcReference) => void }) {
  return <div className="ws-refs">
    <div className="ws-refs-row"><span className="ws-refs-k">Exemplos de livro</span>{refs.map((r) => <button key={r.id} className={`ws-tool${active?.id === r.id ? " on" : ""}`} onClick={() => onLoad(r)}>{r.label}</button>)}</div>
    {active && <div className="ws-ref-note">
      <div><b>{active.source}</b> — {active.where}{active.url && <> · <a href={active.url} target="_blank" rel="noopener noreferrer">abrir PDF</a></>}</div>
      {active.note && <div>{active.note}</div>}
      <div className="ws-ref-hint">Calcule e compare: no passo a passo, cada valor publicado aparece como "livro" com ✓ ou ✗.</div>
    </div>}
  </div>;
}

/* ── Comparação de alternativas ── */
export type Snapshot = { inputs: Array<{ label: string; value: string; unit: string }>; steps: Step[]; value: string; multi: boolean };

export function CompareBlock({ a, b, onClear }: { a: Snapshot; b: Snapshot; onClear: () => void }) {
  const inputs = b.inputs.map((ib) => ({ ib, ia: a.inputs.find((x) => x.label === ib.label) })).filter(({ ia, ib }) => ia && ia.value !== ib.value);
  const rows = b.steps.map((sb) => ({ sb, sa: a.steps.find((x) => x.id === sb.id) })).filter((r) => r.sa);
  const delta = (va: number, vb: number) => (va === 0 ? (vb === 0 ? 0 : null) : ((vb - va) / Math.abs(va)) * 100);
  const igual = inputs.length === 0 && a.value === b.value;
  if (igual) return <div className="compare">
    <div className="steps-head"><span className="ws-block-label">Comparação</span><button className="ws-tool" onClick={onClear}>cancelar</button></div>
    <div className="steps-check-help">✓ Este resultado foi guardado como <b>A</b>. Agora mude os dados de entrada (outra seção, outro material…) e clique em <b>Calcular</b>: a tabela mostra A e B lado a lado, com a diferença em %.</div>
  </div>;
  return <div className="compare">
    <div className="steps-head"><span className="ws-block-label">Comparação: A (fixado) × B (atual)</span><button className="ws-tool" onClick={onClear}>soltar A</button></div>
    {inputs.length > 0 && <table className="cmp-table"><thead><tr><th>Entrada alterada</th><th>A</th><th>B</th></tr></thead>
      <tbody>{inputs.map(({ ia, ib }) => <tr key={ib.label}><td>{ib.label}</td><td>{ia!.value} {ia!.unit}</td><td>{ib.value} {ib.unit}</td></tr>)}</tbody></table>}
    {rows.length > 0
      ? <table className="cmp-table"><thead><tr><th>Resultado</th><th>A</th><th>B</th><th>Δ</th></tr></thead>
          <tbody>{rows.map(({ sa, sb }) => { const d = delta(sa!.value, sb.value); return <tr key={sb.id} className={d !== null && Math.abs(d) >= 0.05 ? "cmp-diff" : ""}>
            <td>{sb.label}</td><td>{br(sa!.value, sb.dec ?? 2)}</td><td>{br(sb.value, sb.dec ?? 2)} {sb.unit}</td>
            <td className={d === null ? "" : d > 0.05 ? "up" : d < -0.05 ? "down" : ""}>{d === null ? "—" : `${d > 0 ? "+" : ""}${br(d, 1)} %`}</td>
          </tr>; })}</tbody></table>
      : <div className="cmp-side"><pre>{a.value}</pre><pre>{b.value}</pre></div>}
  </div>;
}

/* ── Quantitativo e custo ── */
const PRICE_KEY = "engcalc_precos";
const priceId = (m: Material) => `${m.label}|${m.unit}`;
function loadPrices(): Record<string, string> { try { return JSON.parse(localStorage.getItem(PRICE_KEY) || "{}"); } catch { return {}; } }
export function usePrices() {
  const [prices, setPrices] = React.useState<Record<string, string>>(loadPrices);
  React.useEffect(() => {
    const sync = (e: StorageEvent) => { if (e.key === PRICE_KEY) setPrices(loadPrices()); };
    window.addEventListener("storage", sync); return () => window.removeEventListener("storage", sync);
  }, []);
  const set = (id: string, v: string) => setPrices((p) => { const next = { ...p, [id]: v }; localStorage.setItem(PRICE_KEY, JSON.stringify(next)); return next; });
  return [prices, set] as const;
}
const brl = (x: number) => x.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Soma quantidades iguais (mesmo material e unidade). */
export function sumMaterials(list: Material[]) {
  const map = new Map<string, Material>();
  for (const m of list) { const k = priceId(m); const cur = map.get(k); map.set(k, cur ? { ...cur, qty: cur.qty + m.qty } : { ...m }); }
  return [...map.values()];
}

export function CostTable({ materials, title = "Quantitativo e custo", note }: { materials: Material[]; title?: string; note?: string }) {
  const [prices, setPrice] = usePrices();
  const rows = materials.map((m) => { const p = parseUser(prices[priceId(m)] ?? ""); return { m, p, sub: p === null ? null : p * m.qty }; });
  const total = rows.reduce((t, r) => t + (r.sub ?? 0), 0);
  const missing = rows.some((r) => r.p === null);
  return <div className="cost">
    <div className="steps-head"><span className="ws-block-label">{title}</span></div>
    <table className="cmp-table cost-table">
      <thead><tr><th>Material</th><th>Quantidade</th><th>Preço unitário (R$)</th><th>Subtotal</th></tr></thead>
      <tbody>{rows.map(({ m, sub }) => <tr key={priceId(m)}>
        <td>{m.label}</td>
        <td className="num">{br(m.qty, ["kg", "sacos", "m"].includes(m.unit) ? 1 : 3)} {m.unit}</td>
        <td><input inputMode="decimal" aria-label={`Preço de ${m.label} por ${m.unit}`} placeholder={`R$/${m.unit}`} value={prices[priceId(m)] ?? ""} onChange={(e) => setPrice(priceId(m), e.target.value)} /></td>
        <td className="num">{sub === null ? "—" : brl(sub)}</td>
      </tr>)}</tbody>
      <tfoot><tr><td colSpan={3}>Total{missing ? " (falta preço de algum item)" : ""}</td><td className="num"><b>{brl(total)}</b></td></tr></tfoot>
    </table>
    <div className="cost-note">{note ?? "Quantidades sem perdas: acrescente 5 a 10 % na compra."} Os preços ficam salvos neste navegador e valem para todos os cálculos e projetos.</div>
  </div>;
}

/** Tabela de materiais e custo para o PDF (sem campos editáveis). */
export function PrintCost({ materials }: { materials: Material[] }) {
  const [prices] = usePrices();
  const rows = materials.map((m) => { const p = parseUser(prices[priceId(m)] ?? ""); return { m, p, sub: p === null ? null : p * m.qty }; });
  const total = rows.reduce((t, r) => t + (r.sub ?? 0), 0);
  return <section className="pd-section">
    <h2>Resumo de materiais e custo</h2>
    <table className="pd-table"><tbody>
      {rows.map(({ m, p, sub }) => <tr key={priceId(m)}><td>{m.label}</td><td className="pd-num">{br(m.qty, ["kg", "sacos", "m"].includes(m.unit) ? 1 : 3)} {m.unit}</td><td className="pd-num">{p === null ? "—" : `${brl(p)}/${m.unit}`}</td><td className="pd-num">{sub === null ? "—" : brl(sub)}</td></tr>)}
      <tr><td colSpan={3}><b>Total</b></td><td className="pd-num"><b>{brl(total)}</b></td></tr>
    </tbody></table>
    <p className="pd-note">Quantidades estimadas, sem perdas (acrescente 5 a 10 % na compra). Preços informados pelo usuário.</p>
  </section>;
}
