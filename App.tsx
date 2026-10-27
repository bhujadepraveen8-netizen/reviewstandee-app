import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { Navbar } from './components/Navbar';
import { DemoDataNotice } from './components/DemoDataNotice';
import { OwnerDashboard } from './components/OwnerDashboard';
import { StandeeGenerator } from './components/StandeeGenerator';
import { FounderAdminDashboard } from './components/FounderAdminDashboard';
import { PublicQRLanding } from './components/PublicQRLanding';
import { SupabaseSetupModal } from './components/SupabaseSetupModal';
import { AuthModal } from './components/AuthModal';
import { ResetPasswordModal } from './components/ResetPasswordModal';
import { Business } from './types';
import { SANDBOX_BUSINESSES, fetchBusinessByIdOrSlug } from './lib/dataService';

function AppContent() {
  const { currentBusiness, setCurrentBusiness, profile, isPasswordRecovery, setIsPasswordRecovery } = useAuth();

  const [currentView, setCurrentView] = useState<'owner_dashboard' | 'admin_dashboard' | 'public_qr' | 'standee_generator'>('owner_dashboard');
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [publicSlug, setPublicSlug] = useState('bella-vista');
  const [publicTable, setPublicTable] = useState('04');
  const [isGenuineQRScan, setIsGenuineQRScan] = useState(false);

  // Listen to hash changes for direct QR scans or password recovery
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      const search = window.location.search;
      if (
        hash.startsWith('#reset-password') ||
        hash.includes('reset-password') ||
        hash.includes('type=recovery') ||
        search.includes('type=recovery') ||
        search.includes('code=')
      ) {
        setIsPasswordRecovery(true);
      } else if (
        hash.startsWith('#qr/') ||
        hash.startsWith('#/qr/') ||
        hash.startsWith('#r/') ||
        hash.startsWith('#/r/')
      ) {
        const cleanHash = hash
          .replace(/^#\/?qr\//, '')
          .replace(/^#\/?r\//, '');
        const parts = cleanHash.split('?');
        const slug = parts[0];
        setPublicSlug(slug);

        if (parts[1]) {
          const params = new URLSearchParams(parts[1]);
          const t = params.get('table');
          if (t) setPublicTable(t);
        }
        setIsGenuineQRScan(true);
        setCurrentView('public_qr');
      } else if (search.includes('client=') || hash.includes('client=')) {
        const urlParams = new URLSearchParams(search || hash.split('?')[1] || '');
        const clientParam = urlParams.get('client') || urlParams.get('slug');
        if (clientParam) {
          fetchBusinessByIdOrSlug(clientParam).then((b) => {
            if (b) setCurrentBusiness(b);
          });
        }
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [setIsPasswordRecovery, setCurrentBusiness]);

  // Sync default view with role if changed
  useEffect(() => {
    if (profile?.role === 'founder' && currentView === 'owner_dashboard') {
      setCurrentView('admin_dashboard');
    }
  }, [profile?.role]);

  const activeBusiness = currentBusiness;

  const handleSelectBusinessFromAdmin = (b: Business) => {
    setCurrentBusiness(b);
    setCurrentView('owner_dashboard');
  };

  const handleOpenGuestQRFromAdmin = (slug: string) => {
    setPublicSlug(slug);
    setIsGenuineQRScan(false);
    setCurrentView('public_qr');
  };

  // If in public QR view (diner phone view)
  if (currentView === 'public_qr') {
    return (
      <div className="min-h-screen bg-slate-100">
        <PublicQRLanding
          initialSlug={publicSlug}
          tableNumber={publicTable}
          isGenuineQRScan={isGenuineQRScan}
          onExitPreview={() => {
            window.location.hash = '';
            setIsGenuineQRScan(false);
            setCurrentView(profile?.role === 'founder' ? 'admin_dashboard' : 'owner_dashboard');
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <DemoDataNotice onOpenSetup={() => setIsSetupOpen(true)} />

      <Navbar
        currentView={currentView}
        onNavigate={setCurrentView}
        onOpenSetup={() => setIsSetupOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'owner_dashboard' && (
          <OwnerDashboard
            business={activeBusiness}
            onNavigateToStudio={() => setCurrentView('standee_generator')}
            onNavigateToGuestQR={() => {
              if (activeBusiness) setPublicSlug(activeBusiness.slug);
              setIsGenuineQRScan(false);
              setCurrentView('public_qr');
            }}
            onNavigateToAdmin={() => setCurrentView('admin_dashboard')}
            onSelectBusiness={(b) => setCurrentBusiness(b)}
          />
        )}

        {currentView === 'standee_generator' && (
          <StandeeGenerator
            business={activeBusiness}
            onNavigateToAdmin={() => setCurrentView('admin_dashboard')}
          />
        )}

        {currentView === 'admin_dashboard' && (
          <FounderAdminDashboard
            onSelectBusiness={handleSelectBusinessFromAdmin}
            onOpenGuestQR={handleOpenGuestQRFromAdmin}
            onOpenAuth={() => setIsAuthOpen(true)}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">HeReview</span>
            <span>·</span>
            <span>B2B Google Reviews QR Standee SaaS</span>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => setIsSetupOpen(true)}
              className="hover:text-slate-900 transition-colors"
            >
              Supabase Settings & Schema
            </button>
            <button
              onClick={() => setCurrentView('public_qr')}
              className="hover:text-slate-900 transition-colors"
            >
              Diner QR View
            </button>
            <span>Tenant Isolation via Supabase RLS</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <SupabaseSetupModal
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />

      <ResetPasswordModal
        isOpen={isPasswordRecovery}
        onClose={() => setIsPasswordRecovery(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
