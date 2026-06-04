import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import AppLayout from "@/components/layout/AppLayout";
import RequireAuth from "@/components/auth/RequireAuth";
import RequireAdmin from "@/components/auth/RequireAdmin";

// Eager (small / always-needed)
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import Dashboard from "@/pages/Dashboard";
import Admin from "@/pages/Admin";

/**
 * Robust lazy loader: retries failed dynamic imports (common when a chunk
 * resolves to `undefined` due to a stale/aborted preload in the preview
 * environment, which causes "e._result is undefined" inside React.lazy).
 */
const lazyRetry = <T extends { default: any }>(
  factory: () => Promise<T>,
  name: string,
) =>
  lazy(async () => {
    try {
      const mod = await factory();
      if (!mod || !(mod as any).default) {
        throw new Error(`Module ${name} has no default export`);
      }
      return mod;
    } catch (err) {
      const flag = `dpe_lazy_retry_${name}`;
      if (!sessionStorage.getItem(flag)) {
        sessionStorage.setItem(flag, "1");
        window.location.reload();
      }
      throw err;
    }
  });

// Lazy-loaded routes (code-split for fast initial load)
const Referentiel   = lazyRetry(() => import("@/pages/Referentiel"), "Referentiel");
const SIG           = lazyRetry(() => import("@/pages/SIG"), "SIG");
const ORSPrimaire   = lazyRetry(() => import("@/pages/ORSPrimaire"), "ORSPrimaire");
const ORSCollege    = lazyRetry(() => import("@/pages/ORSCollege"), "ORSCollege");
const ORSLycee      = lazyRetry(() => import("@/pages/ORSLycee"), "ORSLycee");
const DataViz       = lazyRetry(() => import("@/pages/DataViz"), "DataViz");
const Donnees       = lazyRetry(() => import("@/pages/Donnees"), "Donnees");
const Besoins       = lazyRetry(() => import("@/pages/Besoins"), "Besoins");
const TDBZap        = lazyRetry(() => import("@/pages/TDBZap"), "TDBZap");
const TDBEcole      = lazyRetry(() => import("@/pages/TDBEcole"), "TDBEcole");
const TDBDren       = lazyRetry(() => import("@/pages/TDBDren"), "TDBDren");
const TDBCisco      = lazyRetry(() => import("@/pages/TDBCisco"), "TDBCisco");
const Diagnostic    = lazyRetry(() => import("@/pages/Diagnostic"), "Diagnostic");
const Eager         = lazyRetry(() => import("@/pages/Eager"), "Eager");
const Utilisateurs  = lazyRetry(() => import("@/pages/Utilisateurs"), "Utilisateurs");
const Profil        = lazyRetry(() => import("@/pages/Profil"), "Profil");


const PageFallback = () => (
  <div className="fixed top-0 left-0 right-0 z-[100] h-[3px] overflow-hidden bg-primary/10 pointer-events-none">
    <div
      className="h-full w-1/4 bg-gradient-to-r from-transparent via-primary to-transparent"
      style={{ animation: "route-progress 1s ease-in-out infinite" }}
    />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <NotificationsProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/referentiel" element={<RequireAdmin><Referentiel /></RequireAdmin>} />
              <Route path="/sig" element={<SIG />} />
              <Route path="/ors-primaire" element={<RequireAuth><ORSPrimaire /></RequireAuth>} />
              <Route path="/ors-college" element={<RequireAuth><ORSCollege /></RequireAuth>} />
              <Route path="/ors-lycee" element={<RequireAuth><ORSLycee /></RequireAuth>} />
              <Route path="/dataviz" element={<DataViz />} />
              <Route path="/diagnostic" element={<RequireAuth><Diagnostic /></RequireAuth>} />
              <Route path="/donnees" element={<Navigate to="/donnees/primaire" replace />} />
              <Route path="/donnees/:niveau" element={<Donnees />} />
              <Route path="/besoins" element={<RequireAuth><Navigate to="/besoins/primaire" replace /></RequireAuth>} />
              <Route path="/besoins/:niveau" element={<RequireAuth><Besoins /></RequireAuth>} />
              <Route path="/tdb-dren" element={<TDBDren />} />
              <Route path="/tdb-cisco" element={<TDBCisco />} />
              <Route path="/tdb-zap" element={<TDBZap />} />
              <Route path="/tdb-ecole" element={<TDBEcole />} />
              {/* Alias paths so older or alternative links keep working */}
              <Route path="/tdb/dren" element={<Navigate to="/tdb-dren" replace />} />
              <Route path="/tdb/cisco" element={<Navigate to="/tdb-cisco" replace />} />
              <Route path="/tdb/zap" element={<Navigate to="/tdb-zap" replace />} />
              <Route path="/tdb/ecole" element={<Navigate to="/tdb-ecole" replace />} />
              <Route path="/utilisateurs" element={<RequireAdmin><Utilisateurs /></RequireAdmin>} />
              <Route path="/profil" element={<RequireAuth><Profil /></RequireAuth>} />
              <Route path="/eager" element={<RequireAdmin><Eager /></RequireAdmin>} />
              <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
              <Route path="/utilisateurs" element={<Navigate to="/admin" replace />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
      </NotificationsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
