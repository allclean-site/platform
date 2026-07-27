/**
 * Simple shared-password gate for the cabinet (interim, until real Supabase Auth). The password lives
 * in the bundle so this is NOT strong security — but publishing to the live site is separately gated by
 * the server EDIT_KEY, so the worst a bypass gets is local editing that never reaches the site.
 */

import React, { useState } from "react";
import { Lock } from "lucide-react";
import { Logo } from "../components/Logo";
import "./gate.css";

const PASSWORD = "AllClean2026!";
const KEY = "leadgenium:auth";

export function Gate({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState(() => localStorage.getItem(KEY) === "1");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);

  if (ok) return <>{children}</>;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw === PASSWORD) { localStorage.setItem(KEY, "1"); setOk(true); }
    else { setErr(true); setPw(""); }
  };

  return (
    <div className="gate">
      <form className="gate__card glass" onSubmit={submit}>
        <Logo size={30} />
        <div className="gate__lock"><Lock size={18} /></div>
        <h1 className="gate__title">Вход в кабинет</h1>
        <p className="gate__sub">Введите пароль, чтобы продолжить.</p>
        <input
          className={"gate__inp" + (err ? " is-err" : "")}
          type="password"
          autoFocus
          value={pw}
          placeholder="Пароль"
          onChange={(e) => { setPw(e.target.value); setErr(false); }}
        />
        {err && <div className="gate__err">Неверный пароль</div>}
        <button className="gate__btn" type="submit">Войти</button>
      </form>
    </div>
  );
}
