import { Bell, Check, CheckCheck, Trash2, Info, AlertTriangle, AlertCircle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNotifications, type AppNotification } from "@/contexts/NotificationsContext";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useState } from "react";

const ICONS: Record<AppNotification["type"], React.ComponentType<{ className?: string }>> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
};

const TYPE_STYLES: Record<AppNotification["type"], string> = {
  info: "text-info bg-info/10",
  success: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400",
  warning: "text-amber-600 bg-amber-500/10 dark:text-amber-400",
  error: "text-destructive bg-destructive/10",
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

export function NotificationsBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, clearAll } =
    useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-lg hover:bg-muted/80 transition-all text-muted-foreground hover:text-foreground hover:scale-105"
          aria-label={`Notifications${unreadCount ? ` (${unreadCount} non lues)` : ""}`}
          title="Notifications"
        >
          <Bell className="w-[18px] h-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-4 ring-2 ring-background flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0 overflow-hidden border-border/60 shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
          <div>
            <h3 className="text-sm font-semibold">Notifications</h3>
            <p className="text-[11px] text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}` : "Tout est à jour"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={markAllAsRead}
                title="Tout marquer comme lu"
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Tout lu
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={clearAll}
                title="Tout effacer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Aucune notification</p>
            <p className="text-xs text-muted-foreground mt-1">
              Vous serez notifié des évènements importants ici.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[420px]">
            <ul className="divide-y">
              {notifications.map((n) => {
                const Icon = ICONS[n.type];
                const Wrapper: any = n.link ? Link : "div";
                const wrapperProps = n.link
                  ? { to: n.link, onClick: () => { markAsRead(n.id); setOpen(false); } }
                  : { onClick: () => markAsRead(n.id) };
                return (
                  <li
                    key={n.id}
                    className={cn(
                      "group relative px-4 py-3 hover:bg-muted/50 transition-colors",
                      !n.read && "bg-primary/[0.04]"
                    )}
                  >
                    <Wrapper {...wrapperProps} className="flex gap-3 cursor-pointer">
                      <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0", TYPE_STYLES[n.type])}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-center gap-2">
                          <p className={cn("text-sm leading-tight truncate", !n.read ? "font-semibold text-foreground" : "text-foreground/90")}>
                            {n.title}
                          </p>
                          {!n.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                        </div>
                        {n.message && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">
                          {timeAgo(n.createdAt)}
                        </p>
                      </div>
                    </Wrapper>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                      {!n.read && (
                        <button
                          onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                          className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
                          title="Marquer comme lu"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeNotification(n.id); }}
                        className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-destructive"
                        title="Supprimer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}

        {notifications.length > 0 && (
          <div className="px-3 py-2 border-t bg-muted/30">
            <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
              {notifications.length} notification{notifications.length > 1 ? "s" : ""} au total
            </Badge>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
