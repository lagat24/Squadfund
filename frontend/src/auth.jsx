import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api.js";

const KEY = "squadfund.identities";
const AuthContext = createContext(null);

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
function save(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 8)));
  } catch {
    /* storage unavailable: switching identities just won't be remembered */
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [identities, setIdentities] = useState(load);

  useEffect(() => {
    api.me().then((r) => setUser(r.user)).catch(() => {}).finally(() => setReady(true));
  }, []);

  const signUp = useCallback(async (name) => {
    const r = await api.signUp(name);
    const next = [{ id: r.user.id, name: r.user.display_name, token: r.resume_token }, ...load().filter((i) => i.id !== r.user.id)];
    save(next);
    setIdentities(next);
    setUser(r.user);
    return r.user;
  }, []);

  const switchTo = useCallback(async (identity) => {
    try {
      const r = await api.resume(identity.token);
      setUser(r.user);
    } catch (e) {
      const next = load().filter((i) => i.id !== identity.id);
      save(next);
      setIdentities(next);
      throw e;
    }
  }, []);

  const signOut = useCallback(async () => {
    await api.signOut().catch(() => {});
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, ready, identities, signUp, switchTo, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
