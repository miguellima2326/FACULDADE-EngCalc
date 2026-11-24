import React from "react";
import { signOut, type SessionUser } from "./account.js";

type View = "calc" | "history" | "admin" | "projects";

/** Switch de tema: trilho com sol/lua e botão deslizante (role="switch"). */
export function ThemeSwitch({ theme, onChange }: { theme: "light" | "dark"; onChange: (t: "light" | "dark") => void }) {
  const dark = theme === "dark";
  return <button type="button" role="switch" aria-checked={dark} aria-label="Tema escuro" className={`tswitch${dark ? " is-dark" : ""}`} onClick={() => onChange(dark ? "light" : "dark")}>
    <span className="tswitch-track">
      <svg className="tswitch-ico sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      <svg className="tswitch-ico moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>
      <span className="tswitch-knob" />
    </span>
    <span className="tswitch-label">{dark ? "Escuro" : "Claro"}</span>
  </button>;
}

export function Sidebar({ user, isAdmin, view, theme, onTheme, onGo, onClose }: {
  user: SessionUser; isAdmin: boolean; view: View; theme: "light" | "dark";
  onTheme: (t: "light" | "dark") => void; onGo: (v: View) => void; onClose: () => void;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const Item = ({ to, icon, label }: { to: View; icon: string; label: string }) =>
    <button className={`sb-item${view === to ? " active" : ""}`} onClick={() => onGo(to)}><span className="sb-ico" aria-hidden="true">{icon}</span><span>{label}</span></button>;

  return <>
    <div className="sidebar-overlay open" onClick={onClose} />
    <aside className="sidebar open sb" aria-label="Menu">
      <div className="sidebar-head"><span className="sidebar-code">MENU</span><span className="sidebar-title">Navegação</span><button className="sidebar-close" onClick={onClose} aria-label="Fechar menu">×</button></div>

      <div className="sb-body">
        <div className="sb-group">
          <div className="sb-label">Trabalho</div>
          <Item to="calc" icon="∑" label="Cálculos" />
          <Item to="projects" icon="▦" label="Projetos" />
          <Item to="history" icon="◷" label="Histórico" />
        </div>
        {isAdmin && <div className="sb-group">
          <div className="sb-label">Administração</div>
          <Item to="admin" icon="⚙" label="Usuários, uso e atividades" />
        </div>}
        <div className="sb-group">
          <div className="sb-label">Preferências</div>
          <div className="sb-row"><span>Aparência</span><ThemeSwitch theme={theme} onChange={onTheme} /></div>
        </div>
      </div>

      <footer className="sb-account">
        <div className="sb-user">
          <span className="sb-avatar">{user.image ? <img src={user.image} alt="" referrerPolicy="no-referrer" /> : user.name.slice(0, 1).toUpperCase()}</span>
          <span className="sb-who">
            <span className="sb-name">{user.name}</span>
            <span className="sb-email">{user.email}</span>
          </span>
          <span className={`sb-role${isAdmin ? " is-admin" : ""}`}>{isAdmin ? "admin" : "usuário"}</span>
        </div>
        <button className="sb-logout" onClick={() => signOut()}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
          Sair da conta
        </button>
      </footer>
    </aside>
  </>;
}
