/** Route guard for /app: show the Login screen until there's a session, then render the cabinet. */

import React from "react";
import { useAuth } from "./AuthContext";
import { Login } from "../app/Login";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  if (!session) return <Login />;
  return <>{children}</>;
}
