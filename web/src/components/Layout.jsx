import React, { useState } from 'react';

import {
  Activity,
  AlertTriangle,
  Cog,
  Egg,
  History,
  Lightbulb,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  X,
} from 'lucide-react';
import {
  Navigate,
  NavLink,
  Outlet,
  useNavigate,
} from 'react-router-dom';

import { useLiveData } from '../context/LiveDataContext';
import { useMqtt } from '../context/MqttContext';
import { useAuth } from '../hooks/useAuth';
import ChickIcon from './ChickIcon';
import IncubatorSelector from './IncubatorSelector';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
  { path: '/synoptique', icon: Egg, label: 'Synoptique' },
  { path: '/historique', icon: History, label: 'Historique' },
  { path: '/commandes', icon: Settings, label: 'Commandes' },
  { path: '/led', icon: Lightbulb, label: 'LED GPIO2' },
  { path: '/profils', icon: Activity, label: 'Profils' },
  { path: '/alarmes', icon: AlertTriangle, label: 'Alarmes' },
  { path: '/parametres', icon: Cog, label: 'Paramètres' },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { enLigne } = useLiveData();
  const { connection, connected, deviceStatus } = useMqtt();
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--color-ink-soft)]">
        Chargement de la session…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-[var(--color-bg)] bg-[radial-gradient(circle_at_top_right,rgba(246,201,69,0.10),transparent_32rem)]">
      { }
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-[var(--color-chick-brown)]/20 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      { }
      <aside className={`
        fixed left-0 top-0 z-50 h-full w-64 border-r border-[var(--color-line)] bg-[var(--color-bg)] shadow-[8px_0_30px_rgba(107,69,31,0.06)] backdrop-blur-sm
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="flex flex-col h-full">
          { }
          <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl text-[var(--color-chick-brown)] shadow-sm shadow-amber-900/10">
                <ChickIcon className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-[var(--color-ink)] leading-tight">Smart Incubator</h1>
                <p className="text-xs text-[var(--color-accent)] leading-tight">Supervision v1.0</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-xl p-1.5 transition hover:bg-[var(--color-accent-soft)] lg:hidden"
            >
              <X className="w-4 h-4 text-[var(--color-ink-soft)]" />
            </button>
          </div>

          { }
          <div className="px-4 pt-4 space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] px-3 py-2.5">
              <span className={`status-dot ${import.meta.env.VITE_USE_MOCKS === 'true' ? 'bg-[var(--color-warn)]' : enLigne ? 'bg-[var(--color-ok)]' : 'bg-[var(--color-crit)]'}`} />
              {import.meta.env.VITE_USE_MOCKS === 'true' ? (
                <span className="text-xs text-[var(--color-warn)] font-medium">Mesures de démonstration</span>
              ) : enLigne ? (
                <span className="text-xs text-[var(--color-ok)] font-medium">Données couveuse connectées</span>
              ) : (
                <span className="text-xs text-[var(--color-crit)] font-medium">Couveuse hors ligne</span>
              )}
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] px-3 py-2.5">
              <span className={`status-dot ${connected ? 'bg-[var(--color-ok)]' : 'bg-[var(--color-crit)]'}`} />
              <span className={`text-xs font-medium ${connected ? 'text-[var(--color-ok)]' : 'text-[var(--color-crit)]'}`}>
                {connected
                  ? deviceStatus === 'online' ? 'ESP32 MQTT en ligne' : 'Broker MQTT connecté'
                  : connection}
              </span>
            </div>
            
            { }
            <div className="px-1">
              <IncubatorSelector />
            </div>
          </div>

          { }
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 pt-4">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => `
                  group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150
                  ${isActive
                    ? 'bg-[var(--color-accent-soft)] font-semibold text-[var(--color-accent)] shadow-sm shadow-amber-900/5'
                    : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-bg)] hover:text-[var(--color-ink)]'
                  }
                `}
              >
                <item.icon className="h-4 w-4" strokeWidth={1.75} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          { }
          <div className="border-t border-[var(--color-line)] px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-[var(--color-chick-gold)] bg-[var(--color-accent-soft)]">
                  <span className="text-xs font-medium text-[var(--color-ink)]">
                    {user?.name?.charAt(0) || 'U'}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-[var(--color-ink)] truncate">{user?.name || 'Utilisateur'}</p>
                  <p className="text-xs text-[var(--color-ink-faint)] capitalize">{user?.role || 'admin'}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex-shrink-0 rounded-xl p-2 transition-colors hover:bg-[var(--color-accent-soft)]"
              >
                <LogOut className="w-4 h-4 text-[var(--color-ink-soft)]" strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      { }
      <div className="lg:ml-64 min-h-screen">
        { }
        <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[var(--color-surface)]/90 p-4 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-xl p-1.5 transition hover:bg-[var(--color-accent-soft)]"
            >
              <Menu className="w-5 h-5 text-[var(--color-ink-soft)]" strokeWidth={1.75} />
            </button>
            <div className="flex items-center gap-2">
              <span className={`status-dot ${enLigne ? 'bg-[var(--color-ok)]' : 'bg-[var(--color-crit)]'}`} />
              <span className="text-sm text-[var(--color-ink-soft)]">
                {enLigne ? 'Connecté' : 'Hors ligne'}
              </span>
            </div>
          </div>
          { }
          <div className="mt-3">
            <IncubatorSelector />
          </div>
        </header>

        { }
        <main className="mx-auto max-w-[1600px] p-4 md:p-7 lg:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}