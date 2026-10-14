import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import {
  ADMIN_PREFERENCES_CHANGE_EVENT,
  applyAdminPreferences,
  clearAppliedAdminPreferences,
  readAdminPreferences,
} from "@faako/theme/adminPreferences";
import { UiSystemProvider } from "@faako/ui";
import { waterAppSystem } from "./appSystem.js";
import { AuthProvider, useAuth } from "./auth/AuthContext.jsx";
import "./styles/admin.css";
import WaterLogin from "./pages/WaterLogin.jsx";
import { WaterAccessDenied, WaterLoading } from "./pages/WaterAppStates.jsx";

const AdminWater = lazy(() => import("./pages/Water/AdminWater.jsx"));

function ProtectedWaterApp() {
  const { user, authReady, logout } = useAuth();
  const [accessDenied, setAccessDenied] = useState(false);

  if (!authReady) return <WaterLoading label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (accessDenied) return <WaterAccessDenied onLogout={logout} />;

  return (
    <div className="water-app">
      <Suspense fallback={<WaterLoading label="Loading Water workspace…" />}>
        <AdminWater onAccessDenied={() => setAccessDenied(true)} />
      </Suspense>
    </div>
  );
}

function AppRoutes() {
  const { user, authReady } = useAuth();
  if (!authReady) return <WaterLoading label="Checking your session…" />;
  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <WaterLogin />}
      />
      <Route path="/sales" element={<Navigate to="/orders?new=1" replace />} />
      {["/", "/orders", "/customers", "/stock"].map((path) => (
        <Route key={path} path={path} element={<ProtectedWaterApp />} />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AdminPreferencesProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : undefined;
    const syncPreferences = () => {
      applyAdminPreferences(readAdminPreferences(userId), { root, mediaQuery });
    };
    const handlePreferencesChange = (event) => {
      if (String(event?.detail?.userId || "guest") !== String(userId || "guest")) return;
      applyAdminPreferences(event?.detail?.preferences, { root, mediaQuery });
    };

    syncPreferences();
    if (mediaQuery?.addEventListener) mediaQuery.addEventListener("change", syncPreferences);
    else mediaQuery?.addListener?.(syncPreferences);
    window.addEventListener(ADMIN_PREFERENCES_CHANGE_EVENT, handlePreferencesChange);

    return () => {
      if (mediaQuery?.removeEventListener) mediaQuery.removeEventListener("change", syncPreferences);
      else mediaQuery?.removeListener?.(syncPreferences);
      window.removeEventListener(ADMIN_PREFERENCES_CHANGE_EVENT, handlePreferencesChange);
      clearAppliedAdminPreferences(root);
    };
  }, [userId]);

  return children;
}

export default function App() {
  return (
    <UiSystemProvider appSystem={waterAppSystem}>
      <BrowserRouter>
        <AuthProvider>
          <AdminPreferencesProvider>
            <AppRoutes />
          </AdminPreferencesProvider>
        </AuthProvider>
      </BrowserRouter>
    </UiSystemProvider>
  );
}
