import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { notify } from "./NotificationsContext";

interface User {
  username: string;
  first_name: string;
  last_name: string;
  dren?: string;
  cisco?: string;
  is_active: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    username: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string; redirect?: string }>;
  logout: () => Promise<void>;
  updateProfile: (data: {
    first_name?: string;
    last_name?: string;
    current_password: string;
    new_password?: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

const DJANGO_BASE_URL = "https://dpe-men.mg";

async function loginDjangoSession(username: string, password: string): Promise<boolean> {
  try {
    const body = new URLSearchParams();
    body.append("username", username);
    body.append("password", password);
    const res = await fetch(`${DJANGO_BASE_URL}/login/`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      redirect: "manual",
    });
    // redirect:manual → succès = opaqueredirect (status 0)
    return res.type === "opaqueredirect";
  } catch (err) {
    console.warn("Session Django non établie (login parallèle) :", err);
    return false;
  }
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Ne restaure PAS depuis localStorage : chaque chargement part déconnecté.
  // Évite les sessions « collées » sur le même navigateur / machine.
  useEffect(() => {
    localStorage.removeItem("dpe_user");
    setUser(null);
    setIsLoading(false);
  }, []);

  const login = async (
    username: string,
    password: string,
  ): Promise<{ success: boolean; error?: string; redirect?: string }> => {
    try {
      if (!username || !password) {
        return { success: false, error: "Nom d'utilisateur et mot de passe requis" };
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const supabaseUrl = projectId
        ? `https://${projectId}.supabase.co`
        : import.meta.env.VITE_SUPABASE_URL;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      let response: Response;
      try {
        response = await fetch(`${supabaseUrl}/functions/v1/db-query?action=login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ username, password }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      let result: any = {};
      try {
        result = await response.json();
      } catch {
        /* ignore parse */
      }

      if (response.status === 503 || result?.code === "DB_UNREACHABLE") {
        return {
          success: false,
          error:
            result?.error ||
            "Votre serveur de base de données est injoignable. Vérifiez qu'il est démarré et accessible depuis Internet.",
        };
      }

      if (!response.ok || !result.success) {
        return { success: false, error: result?.error || "Identifiants invalides" };
      }

      const djangoOk = await loginDjangoSession(username, password);
      if (!djangoOk) {
        notify({
          title: "Connexion partielle",
          message:
            "Connecté à la plateforme, mais la session serveur n'a pas pu être établie — certaines actions administratives pourraient échouer.",
          type: "warning",
        });
      }

      const userData: User = {
        username: result.user.username,
        first_name: result.user.first_name,
        last_name: result.user.last_name,
        dren: result.user.dren,
        cisco: result.user.cisco,
        is_active: result.user.is_active,
        is_staff: result.user.is_staff,
        is_superuser: result.user.is_superuser,
      };

      // Stockage session-only pour l'UI de cet onglet (pas de persistance long terme)
      sessionStorage.setItem("dpe_user", JSON.stringify(userData));
      setUser(userData);

      notify({
        title: `Bienvenue, ${userData.first_name || userData.username}`,
        message: "Connexion réussie à la plateforme DPE.",
        type: "success",
      });

      return { success: true, redirect: result.redirect };
    } catch (error: any) {
      console.error("Login error:", error);
      const isAbort = error?.name === "AbortError";
      return {
        success: false,
        error: isAbort
          ? "Délai de connexion dépassé. Votre serveur PostgreSQL ne répond pas (102.16.234.114:5453)."
          : "Impossible de joindre l'edge function. Vérifiez votre connexion Internet ou que votre serveur PostgreSQL est accessible.",
      };
    }
  };

  const logout = async () => {
    const name = user?.first_name || user?.username;
    try {
      await fetch(`${DJANGO_BASE_URL}/login/logout/`, {
        method: "POST",
        credentials: "include",
      });
    } catch (e) {
      console.warn("Logout Django échoué:", e);
    }
    localStorage.removeItem("dpe_user");
    sessionStorage.removeItem("dpe_user");
    setUser(null);
    notify({
      title: "Déconnexion",
      message: name ? `À bientôt, ${name}.` : undefined,
      type: "info",
    });
  };

  const updateProfile = async (data: {
    first_name?: string;
    last_name?: string;
    current_password: string;
    new_password?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!user) {
        return { success: false, error: "Utilisateur non connecté" };
      }

      if (!data.current_password) {
        return { success: false, error: "Le mot de passe actuel est obligatoire" };
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const supabaseUrl = projectId
        ? `https://${projectId}.supabase.co`
        : import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/db-query?action=updatePassword`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          username: user.username,
          current_password: data.current_password,
          new_password: data.new_password,
          first_name: data.first_name,
          last_name: data.last_name,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        return { success: false, error: result.error };
      }

      const updatedUser = {
        ...user,
        first_name: data.first_name || user.first_name,
        last_name: data.last_name || user.last_name,
      };
      sessionStorage.setItem("dpe_user", JSON.stringify(updatedUser));
      setUser(updatedUser);

      notify({
        title: "Profil mis à jour",
        message: "Vos informations ont été enregistrées.",
        type: "success",
      });
      return { success: true };
    } catch (error) {
      console.error("Update profile error:", error);
      return { success: false, error: "Erreur lors de la mise à jour du profil" };
    }
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
