import React from 'react';
import { useAuth } from '../lib/AuthContext';
import { getStoredConfig } from '../lib/supabaseClient';

interface NavbarProps {
  currentView: 'owner_dashboard' | 'admin_dashboard' | 'public_qr' | 'standee_generator';
  onNavigate: (view: 'owner_dashboard' | 'admin_dashboard' | 'public_qr' | 'standee_generator') => void;
  onOpenSetup: () => void;
  onOpenAuth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  onOpenSetup,
  onOpenAuth,
}) => {
  const { user, profile, signOut } = useAuth();
  const config = getStoredConfig();
  const isConnected = Boolean(config.url && config.anonKey);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-8 h-16">
          {/* Zone 1: Wordmark */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('owner_dashboard')}
              className="text-xl font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-blue-600 transition-colors flex items-center gap-2.5"
            >
              <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
                HR
              </span>
              <span className="text-xl font-bold tracking-tight text-slate-900">
                HeReview
              </span>
            </button>
            <span className="hidden sm:inline-block text-xs text-slate-400 font-mono">B2B SaaS</span>
          </div>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <button
              onClick={() => onNavigate('owner_dashboard')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                currentView === 'owner_dashboard' ? 'text-blue-600 font-semibold' : ''
              }`}
            >
              Restaurant Dashboard
            </button>
            <button
              onClick={() => onNavigate('standee_generator')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                currentView === 'standee_generator' ? 'text-blue-600 font-semibold' : ''
              }`}
            >
              Standee QR Studio
            </button>
            <button
              onClick={() => onNavigate('admin_dashboard')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                currentView === 'admin_dashboard' ? 'text-blue-600 font-semibold' : ''
              }`}
            >
              Founder Admin
            </button>
            <button
              onClick={() => onNavigate('public_qr')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
                currentView === 'public_qr' ? 'text-blue-600 font-semibold' : ''
              }`}
            >
              Guest QR Preview
            </button>
          </nav>

          {/* Zone 3: Primary Action & Auth */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Supabase Connection Status Button */}
            <button
              onClick={onOpenSetup}
              className={`text-xs px-3 py-1.5 rounded-md font-medium border transition-colors whitespace-nowrap shrink-0 ${
                isConnected
                  ? 'border-emerald-200 text-emerald-800 bg-emerald-50 hover:bg-emerald-100'
                  : 'border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100'
              }`}
              title="Click to check or configure Supabase connection"
            >
              {isConnected ? 'Supabase Connected' : 'Connect Supabase'}
            </button>

            {user ? (
              <div className="flex items-center gap-2">
                <span className="hidden lg:inline text-xs text-slate-600 font-mono truncate max-w-[140px]">
                  {profile?.full_name || user.email}
                </span>
                <button
                  onClick={() => signOut()}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 shadow-sm"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile nav drawer */}
      <div className="md:hidden flex border-t border-slate-100 px-4 py-2 overflow-x-auto gap-3 text-xs bg-slate-50">
        <button
          onClick={() => onNavigate('owner_dashboard')}
          className={`whitespace-nowrap px-2.5 py-1 rounded ${currentView === 'owner_dashboard' ? 'bg-white shadow-xs font-semibold text-blue-600' : 'text-slate-600'}`}
        >
          Restaurant
        </button>
        <button
          onClick={() => onNavigate('standee_generator')}
          className={`whitespace-nowrap px-2.5 py-1 rounded ${currentView === 'standee_generator' ? 'bg-white shadow-xs font-semibold text-blue-600' : 'text-slate-600'}`}
        >
          Standee Studio
        </button>
        <button
          onClick={() => onNavigate('admin_dashboard')}
          className={`whitespace-nowrap px-2.5 py-1 rounded ${currentView === 'admin_dashboard' ? 'bg-white shadow-xs font-semibold text-blue-600' : 'text-slate-600'}`}
        >
          Founder Admin
        </button>
        <button
          onClick={() => onNavigate('public_qr')}
          className={`whitespace-nowrap px-2.5 py-1 rounded ${currentView === 'public_qr' ? 'bg-white shadow-xs font-semibold text-blue-600' : 'text-slate-600'}`}
        >
          Guest QR
        </button>
      </div>
    </header>
  );
};
