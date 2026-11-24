import React from "react";
import { signInWithGoogle } from "./account.js";

/** Fórmulas que se alternam na prancha — uma de cada disciplina. */
const FORMULAS = [
  { area: "CIVIL", expr: "M = q·L² / 8", note: "momento máximo · viga biapoiada" },
  { area: "ELÉTRICA", expr: "In = S / (√3 · V)", note: "corrente nominal trifásica" },
  { area: "CIVIL", expr: "As = Md / (z · fyd)", note: "armadura de flexão · NBR 6118" },
  { area: "MECÂNICA", expr: "RPM = 1000·Vc / (π·D)", note: "rotação da ferramenta" },
  { area: "ELÉTRICA", expr: "S = Icc·√t / k", note: "seção mínima por curto-circuito" },
  { area: "CIVIL", expr: "Q = C · i · A / 360", note: "vazão de projeto · método racional" },
];

/** Contador que sobe até `to` (usa requestAnimationFrame; respeita reduced-motion). */
function useCountUp(to: number, ms: number, delay: number) {
  const [v, setV] = React.useState(0);
  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(to); return; }
    let raf = 0; const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(Math.max((now - start) / ms, 0), 1);
      setV(to * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms, delay]);
  return v;
}

function Blueprint() {
  const M = useCountUp(45, 1400, 2300);
  const arrows = [70, 110, 150, 190, 230, 270, 310];
  return (
    <svg className="bp" viewBox="0 0 380 260" role="img" aria-label="Viga biapoiada com carga distribuída, deformada e diagrama de momento fletor">
      {/* carga distribuída q */}
      <g className="bp-load">
        <line className="bp-acc bp-draw" x1="60" y1="52" x2="320" y2="52" style={{ ["--len" as string]: 260, ["--d" as string]: "0.9s" }} />
        {arrows.map((x, i) => (
          <g key={x} className="bp-arrow" style={{ ["--d" as string]: `${1.1 + i * 0.07}s` }}>
            <line x1={x} y1="52" x2={x} y2="84" /><path d={`M${x - 4} 77 L${x} 84 L${x + 4} 77`} />
          </g>
        ))}
        <text className="bp-t-acc bp-fade" x="190" y="42" textAnchor="middle" style={{ ["--d" as string]: "1.2s" }}>q = 10 kN/m</text>
      </g>

      {/* viga + apoios */}
      <line className="bp-strong bp-draw" x1="60" y1="92" x2="320" y2="92" style={{ ["--len" as string]: 260, ["--d" as string]: "0.2s" }} />
      <path className="bp-line bp-draw" d="M60 92 l-10 17 l20 0 z" style={{ ["--len" as string]: 60, ["--d" as string]: "0.5s" }} />
      <path className="bp-line bp-draw" d="M320 92 l-10 17 l20 0 z" style={{ ["--len" as string]: 60, ["--d" as string]: "0.6s" }} />
      <line className="bp-line bp-draw" x1="300" y1="113" x2="340" y2="113" style={{ ["--len" as string]: 40, ["--d" as string]: "0.7s" }} />

      {/* deformada */}
      <path className="bp-dash bp-draw" d="M60 92 Q190 128 320 92" style={{ ["--len" as string]: 275, ["--d" as string]: "1.7s" }} />
      <text className="bp-t bp-fade" x="204" y="122" textAnchor="middle" style={{ ["--d" as string]: "2.1s" }}>δ</text>

      {/* cota L */}
      <g className="bp-fade" style={{ ["--d" as string]: "0.8s" }}>
        <line className="bp-dim" x1="60" y1="150" x2="320" y2="150" />
        <path className="bp-dim" d="M60 145 L60 155 M320 145 L320 155" />
        <text className="bp-t" x="190" y="146" textAnchor="middle">L = 6,00 m</text>
      </g>

      {/* diagrama de momento */}
      <line className="bp-cl bp-fade" x1="50" y1="172" x2="330" y2="172" style={{ ["--d" as string]: "2.0s" }} />
      <path className="bp-moment" d="M60 172 Q190 268 320 172 Z" />
      <path className="bp-acc bp-draw" d="M60 172 Q190 268 320 172" style={{ ["--len" as string]: 300, ["--d" as string]: "2.2s" }} />
      <line className="bp-dim bp-fade" x1="190" y1="172" x2="190" y2="220" style={{ ["--d" as string]: "2.6s" }} />
      <text className="bp-t-readout bp-fade" x="198" y="236" style={{ ["--d" as string]: "2.3s" }}>M = {M.toFixed(2).replace(".", ",")} kN·m</text>
    </svg>
  );
}

function FormulaTicker() {
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((n) => (n + 1) % FORMULAS.length), 2800);
    return () => clearInterval(id);
  }, []);
  const f = FORMULAS[i]!;
  return (
    <div className="ticker" aria-live="off">
      <span className="ticker-area">{f.area}</span>
      <span className="ticker-expr" key={i}>{f.expr}</span>
      <span className="ticker-note" key={`n${i}`}>{f.note}</span>
    </div>
  );
}

export function LoginScreen({ error, onDismissError, loading }: { error: string | null; onDismissError: () => void; loading?: boolean }) {
  const [busy, setBusy] = React.useState(false);
  return (
    <div className="login">
      <div className="login-sheet">
        <section className="login-art">
          <div className="login-art-head"><span>FOLHA 00</span><span>MEMÓRIA DE CÁLCULO</span><span>ESC 1:1</span></div>
          <Blueprint />
          <FormulaTicker />
        </section>

        <section className="login-panel">
          <div className="login-brand">
            <svg width="34" height="34" viewBox="0 0 28 28" aria-hidden="true"><polygon points="14,2 25,8 25,20 14,26 3,20 3,8" stroke="#1f5fbf" strokeWidth="1.5" fill="none" /><path d="M10 9v10h8M10 14h6" stroke="currentColor" strokeWidth="1.8" fill="none" /></svg>
            <div><div className="tb-name login-name">Eng<b>Calc</b></div><div className="tb-tagline">memória de cálculo técnica</div></div>
          </div>
          <p className="login-lead">Fórmulas verificadas, verificação de norma e relatórios para engenharia mecânica, civil e elétrica.</p>

          {error && <div className="auth-banner" role="alert"><span>⚠ {error}</span><button onClick={onDismissError} aria-label="Fechar">×</button></div>}

          <button className="btn-google login-google" disabled={busy || loading} onClick={() => { setBusy(true); signInWithGoogle().finally(() => setBusy(false)); }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 10l3.7-2.9z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4z"/></svg>
            {loading ? "Verificando sessão…" : busy ? "Abrindo o Google…" : "Entrar com Google"}
          </button>
          <p className="login-note">Acesso por convite: peça a um administrador para cadastrar o e-mail Google que você vai usar.</p>

          <div className="login-stamp">
            <div><span>NORMAS</span><b>NBR 6118 · 6122 · 5410 · 10844</b></div>
            <div><span>REV</span><b>3.0</b></div>
          </div>
        </section>
      </div>
    </div>
  );
}
