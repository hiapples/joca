import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

const API_BASE = 'http://192.168.1.139:4000';
const REFRESH_KEY = 'refresh_token_v1';

type GenderType = '男' | '女' | null;

export type UserInfo = {
  userId: string; // Mongo _id
  phone: string;  // +8869...
  nickname: string;
  gender: GenderType;
  age: number | null;
  intro: string;
};

type AuthState = {
  booting: boolean;
  loggedIn: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  user: UserInfo | null;

  setSession: (accessToken: string, refreshToken: string, user: UserInfo) => Promise<void>;
  refreshSession: () => Promise<boolean>;
  clearSession: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth must be used within AuthProvider');
  return v;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [booting, setBooting] = useState(true);

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);

  async function setSession(at: string, rt: string, u: UserInfo) {
    setAccessToken(at);
    setRefreshToken(rt);
    setUser(u);
    await SecureStore.setItemAsync(REFRESH_KEY, rt);
  }

  async function clearSession() {
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
    try {
      await SecureStore.deleteItemAsync(REFRESH_KEY);
    } catch {}
  }

  async function refreshSession(): Promise<boolean> {
    const rt = await SecureStore.getItemAsync(REFRESH_KEY);
    if (!rt) return false;

    try {
      const res = await fetch(API_BASE + '/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });

      if (!res.ok) {
        await clearSession();
        return false;
      }

      const json = await res.json();
      if (!json.accessToken || !json.user) {
        await clearSession();
        return false;
      }

      await setSession(json.accessToken, rt, json.user);
      return true;
    } catch {
      return false;
    }
  }

  useEffect(() => {
    (async function () {
      try {
        await refreshSession();
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  const value = useMemo<AuthState>(() => {
    return {
      booting,
      loggedIn: !!accessToken && !!user,
      accessToken,
      refreshToken,
      user,
      setSession,
      refreshSession,
      clearSession,
    };
  }, [booting, accessToken, refreshToken, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}