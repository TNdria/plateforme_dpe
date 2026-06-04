import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { toast } from "sonner";

export type NotificationType = "info" | "success" | "warning" | "error";

export interface AppNotification {
  id: string;
  title: string;
  message?: string;
  type: NotificationType;
  createdAt: number;
  read: boolean;
  link?: string;
}

interface NotificationsContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (n: Omit<AppNotification, "id" | "createdAt" | "read">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const STORAGE_KEY = "dpe_notifications_v1";
const MAX_NOTIFICATIONS = 50;

/** Global helper — usable from anywhere without React context */
export function notify(n: { title: string; message?: string; type?: NotificationType; link?: string; silent?: boolean }) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("app:notify", { detail: { type: "info", ...n } }));
  }
}

const seedNotifications = (): AppNotification[] => [
  {
    id: "welcome-1",
    title: "Bienvenue sur la plateforme DPE",
    message: "Vous pouvez consulter les tableaux de bord, les besoins et les diagnostics depuis le menu latéral.",
    type: "info",
    createdAt: Date.now() - 1000 * 60 * 5,
    read: false,
  },
  {
    id: "data-1",
    title: "Données 2024-2025 disponibles",
    message: "Les statistiques de l'année scolaire 2024-2025 sont maintenant accessibles dans le dashboard.",
    type: "success",
    createdAt: Date.now() - 1000 * 60 * 60 * 2,
    read: false,
    link: "/dashboard",
  },
];

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { /* ignore */ }
    return seedNotifications();
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications)); } catch { /* ignore */ }
  }, [notifications]);

  const addNotification = useCallback(
    (n: Omit<AppNotification, "id" | "createdAt" | "read">) => {
      setNotifications((prev) =>
        [
          {
            ...n,
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            createdAt: Date.now(),
            read: false,
          },
          ...prev,
        ].slice(0, MAX_NOTIFICATIONS),
      );
    },
    [],
  );

  // Listen to global window events so any module can push a notification
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const { silent, ...rest } = detail;
      addNotification({
        title: rest.title || "Notification",
        message: rest.message,
        type: rest.type || "info",
        link: rest.link,
      });
      if (!silent) {
        const t = rest.type || "info";
        const fn = t === "success" ? toast.success : t === "error" ? toast.error : t === "warning" ? toast.warning : toast.info;
        fn(rest.title, { description: rest.message });
      }
    };
    window.addEventListener("app:notify", handler);
    return () => window.removeEventListener("app:notify", handler);
  }, [addNotification]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => setNotifications([]), []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, addNotification, markAsRead, markAllAsRead, removeNotification, clearAll }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
};
