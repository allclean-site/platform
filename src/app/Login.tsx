/**
 * Login screen — replaces the interim shared-password Gate. Email + password against the mock
 * authenticator; role decides the landing (agency → console, client → their cabinet). Demo hint chips
 * fill credentials during development. Swap the authenticator for Supabase Auth without touching this UI.
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { Logo } from "../components/Logo";
import { useAuth } from "../auth/AuthContext";
import { DEMO_HINTS } from "../auth/store";
import "./login.css";

export function Login() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    // The password is checked on the server now, so this is a real round trip — say that it is running
    // instead of leaving a button that looks like it did nothing.
    const res = await signIn(email, pw);
    setBusy(false);
    if (res.ok && res.session) {
      nav(res.session.role === "agency" ? "/app/agency" : "/app", { replace: true });
    } else {
      setErr(res.error ?? "Не удалось войти");
      setPw("");
    }
  };

  const fill = (h: (typeof DEMO_HINTS)[number]) => {
    setEmail(h.email); setPw(h.password); setErr(null);
  };

  return (
    <div className="login">
      <form className="login__card glass" onSubmit={submit}>
        <Logo size={30} />
        <div className="login__badge"><LogIn size={18} /></div>
        <h1 className="login__title">Вход в кабинет</h1>
        <p className="login__sub">LeadGenium — управление сайтом, блогом и заявками.</p>

        <label className="login__lbl">Email</label>
        <input
          className={"login__inp" + (err ? " is-err" : "")}
          type="email" autoFocus autoComplete="username"
          value={email} placeholder="you@company.com"
          onChange={(e) => { setEmail(e.target.value); setErr(null); }}
        />
        <label className="login__lbl">Пароль</label>
        <input
          className={"login__inp" + (err ? " is-err" : "")}
          type="password" autoComplete="current-password"
          value={pw} placeholder="Пароль"
          onChange={(e) => { setPw(e.target.value); setErr(null); }}
        />
        {err && <div className="login__err" role="alert">{err}</div>}
        <button className="login__btn" type="submit" disabled={busy}>{busy ? "Проверяю…" : "Войти"}</button>

        {/* Local development only: DEMO_HINTS is empty in every build we ship. */}
        {DEMO_HINTS.length > 0 && (
          <div className="login__demo">
            <span className="muted">Демо-вход:</span>
            {DEMO_HINTS.map((h) => (
              <button type="button" key={h.email} className="login__chip" onClick={() => fill(h)}>
                {h.label}
              </button>
            ))}
          </div>
        )}
      </form>
    </div>
  );
}
