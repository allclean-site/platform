/**
 * Auth + active-client context. One provider drives login state and, for agency staff, which client's
 * cabinet is currently entered. Everything (Shell, console, guards) reads this so the UI re-renders on
 * sign-in / sign-out / enter-client / exit-client without page reloads.
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  type Session, type SignInResult, getSession, signIn as doSignIn, clearSession,
} from "./store";
import { getActiveClientId, setActiveClientId, clearActiveClient } from "../agency/store";

interface AuthCtx {
  session: Session | null;
  /** Which client's cabinet is in view. Clients: always their own tenant. Agency: the entered client (or null on the console). */
  activeClientId: string | null;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => void;
  /** Agency: open a client's cabinet. */
  enterClient: (id: string) => void;
  /** Agency: return to the console. */
  exitClient: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => getSession());
  const [activeClientId, setActive] = useState<string | null>(() => {
    const s = getSession();
    if (s?.role === "client") return s.tenantId ?? null;
    return getActiveClientId();
  });

  const signIn = useCallback(async (email: string, password: string): Promise<SignInResult> => {
    const res = await doSignIn(email, password);
    if (res.ok && res.session) {
      setSession(res.session);
      if (res.session.role === "client") {
        setActive(res.session.tenantId ?? null);
      } else {
        clearActiveClient();
        setActive(null);
      }
    }
    return res;
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    clearActiveClient();
    setSession(null);
    setActive(null);
  }, []);

  const enterClient = useCallback((id: string) => {
    setActiveClientId(id);
    setActive(id);
  }, []);

  const exitClient = useCallback(() => {
    clearActiveClient();
    setActive(null);
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({ session, activeClientId, signIn, signOut, enterClient, exitClient }),
    [session, activeClientId, signIn, signOut, enterClient, exitClient],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
