import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { api, ApiError } from "../api/client.js";

const AuthCtx = createContext();

const TOKEN_KEY = "np-token";
const USER_KEY = "np-user";

function readStored() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const user = JSON.parse(localStorage.getItem(USER_KEY));
    return token && user ? { token, user } : { token: null, user: null };
  } catch {
    return { token: null, user: null };
  }
}

function persist(token, user) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch { /* noop */ }
}

function clearPersisted() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch { /* noop */ }
}

export function AuthProvider({ children }) {
  const [{ token, user }, setAuth] = useState(readStored);

  const logout = useCallback(() => {
    clearPersisted();
    setAuth({ token: null, user: null });
  }, []);

  // Listen for 401 Unauthorized responses across the app and sign out cleanly
  useEffect(() => {
    const handleUnauth = () => logout();
    window.addEventListener("np-unauthorized", handleUnauth);
    return () => window.removeEventListener("np-unauthorized", handleUnauth);
  }, [logout]);

  // Verify stored token against /auth/me when app mounts
  useEffect(() => {
    if (!token) return;
    let active = true;
    api.me(token)
      .then((freshUser) => {
        if (active && freshUser) {
          persist(token, freshUser);
          setAuth({ token, user: freshUser });
        }
      })
      .catch((err) => {
        if (active && err instanceof ApiError && err.status === 401) {
          logout();
        }
      });
    return () => { active = false; };
  }, [token, logout]);

  const signup = useCallback(async (name, email, password) => {
    try {
      const { token, user } = await api.signup(name, email, password);
      persist(token, user);
      setAuth({ token, user });
      return { ok: true, user };
    } catch (e) {
      return { ok: false, error: e instanceof ApiError ? e.message : "Could not reach the server. Is the API running?" };
    }
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const { token, user } = await api.login(email, password);
      persist(token, user);
      setAuth({ token, user });
      return { ok: true, user };
    } catch (e) {
      return { ok: false, error: e instanceof ApiError ? e.message : "Could not reach the server. Is the API running?" };
    }
  }, []);

  const loginWithGoogle = useCallback(async (credential) => {
    try {
      const { token, user } = await api.googleLogin(credential);
      persist(token, user);
      setAuth({ token, user });
      return { ok: true, user };
    } catch (e) {
      return { ok: false, error: e instanceof ApiError ? e.message : "Could not sign in with Google. Is the API running?" };
    }
  }, []);

  return (
    <AuthCtx.Provider value={{
      user,
      token,
      isAuthed: Boolean(token && user),
      isAdmin: Boolean(token && user?.isAdmin),
      signup,
      login,
      loginWithGoogle,
      logout,
    }}>
      {children}
    </AuthCtx.Provider>
  );

}

export const useAuth = () => useContext(AuthCtx);
