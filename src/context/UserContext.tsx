import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePolling } from "../lib/usePolling";
import { demoFetch } from "../demo/api";

export interface AppUser {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  avatarInitials: string;
  avatarUrl?: string;
  hasPassword: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  memberSince: string;
  balance: number;
  nextInvoiceDate: string;
  nextInvoiceAmount: number;
  twoFactorEnabled: boolean;
  notificationPrefs: {
    serverAlerts: boolean;
    billingReminders: boolean;
    productUpdates: boolean;
    marketingEmails: boolean;
  };
}

interface RegisterInput {
  username: string;
  email: string;
  password: string;
  inviteCode: string;
}

interface SettingsUpdate {
  twoFactorEnabled?: boolean;
  notificationPrefs?: Partial<AppUser["notificationPrefs"]>;
}

interface UserContextValue {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  loginWithGoogle: (accessToken: string, inviteCode?: string) => Promise<void>;
  updateProfile: (updates: Partial<Pick<AppUser, "firstName" | "lastName" | "username" | "email">>) => Promise<void>;
  updateSettings: (updates: SettingsUpdate) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteAccount: (password?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within <UserProvider>");
  return ctx;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await demoFetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Something went wrong. Please try again.");
  }
  return data as T;
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<AppUser>("/api/auth/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function refreshUser() {
    const nextUser = await apiFetch<AppUser>("/api/auth/me");
    setUser(nextUser);
  }

  // Balance (and anything else on the user record) can change from sources
  // other than the current tab's own actions — an admin bonus credit, a
  // billing-cron renewal charge — so poll rather than only refreshing after
  // this tab's own requests. Only polls once actually logged in.
  usePolling(() => {
    if (user) refreshUser().catch(() => {});
  }, 5000);

  async function login(email: string, password: string) {
    const nextUser = await apiFetch<AppUser>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setUser(nextUser);
  }

  async function register(input: RegisterInput) {
    const nextUser = await apiFetch<AppUser>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
    setUser(nextUser);
  }

  async function loginWithGoogle(accessToken: string, inviteCode?: string) {
    const nextUser = await apiFetch<AppUser>("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ accessToken, inviteCode }),
    });
    setUser(nextUser);
  }

  async function updateProfile(updates: Partial<Pick<AppUser, "firstName" | "lastName" | "username" | "email">>) {
    const nextUser = await apiFetch<AppUser>("/api/account/profile", {
      method: "PATCH",
      body: JSON.stringify({ ...user, ...updates }),
    });
    setUser(nextUser);
  }

  async function updateSettings(updates: SettingsUpdate) {
    const nextUser = await apiFetch<AppUser>("/api/account/settings", {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
    setUser(nextUser);
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    await apiFetch<void>("/api/account/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async function deleteAccount(password?: string) {
    await apiFetch<void>("/api/account", {
      method: "DELETE",
      body: JSON.stringify({ password }),
    });
    setUser(null);
  }

  async function logout() {
    await apiFetch<void>("/api/auth/logout", { method: "POST" });
    setUser(null);
  }

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        loginWithGoogle,
        updateProfile,
        updateSettings,
        changePassword,
        deleteAccount,
        logout,
        refreshUser,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}
