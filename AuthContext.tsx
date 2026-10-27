import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSupabase } from './supabaseClient';
import { Profile, Business, UserRole } from '../types';
import { SANDBOX_BUSINESSES } from './dataService';
import { getPasswordResetRedirectUrl } from './appUrl';

interface AuthContextType {
  user: { id: string; email: string } | null;
  profile: Profile | null;
  currentBusiness: Business | null;
  loading: boolean;
  isSupabaseAuth: boolean;
  isPasswordRecovery: boolean;
  setIsPasswordRecovery: (val: boolean) => void;
  signIn: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password?: string, fullName?: string, role?: UserRole) => Promise<{ success: boolean; error?: string }>;
  resetPasswordForEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
  switchDemoRole: (role: UserRole, businessId?: string) => void;
  setCurrentBusiness: (b: Business | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentBusiness, setCurrentBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSupabaseAuth, setIsSupabaseAuth] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  const syncSession = async (session: any) => {
    const client = getSupabase();
    if (!client || !session?.user) {
      setUser(null);
      setProfile(null);
      return;
    }

    const authUser = { id: session.user.id, email: session.user.email || '' };
    setUser(authUser);

    // Securely derive user role from authenticated session / JWT metadata
    // Verified Founder Admin email is kumarharishbhai34@gmail.com
    // Strictly does not query nonexistent public.profiles table
    const cleanEmail = (session.user.email || '').toLowerCase().trim();
    const metadataRole = session.user.user_metadata?.role as UserRole | undefined;
    const appRole = session.user.app_metadata?.role as UserRole | undefined;
    const isFounder = cleanEmail === 'kumarharishbhai34@gmail.com' || metadataRole === 'founder' || appRole === 'founder';
    const finalRole: UserRole = isFounder ? 'founder' : (metadataRole || 'restaurant_owner');

    const derivedProfile: Profile = {
      id: session.user.id,
      email: session.user.email || '',
      full_name: session.user.user_metadata?.full_name || (isFounder ? 'Harish Kumar (Founder Admin)' : ''),
      role: finalRole,
      created_at: session.user.created_at || new Date().toISOString(),
    };
    setProfile(derivedProfile);

    try {
      // Find a business row accessible to this user
      let bData = null;
      if (!isFounder) {
        const { data: ownedBiz } = await client
          .from('businesses')
          .select('*')
          .eq('owner_id', session.user.id)
          .limit(1)
          .maybeSingle();
        bData = ownedBiz;
      }
      if (!bData) {
        const { data: firstBiz } = await client.from('businesses').select('*').limit(1).maybeSingle();
        bData = firstBiz;
      }
      if (bData) {
        setCurrentBusiness({
          ...bData,
          name: bData.name || bData.business_name || 'Business',
          is_active: bData.is_active ?? bData.active ?? true,
        } as Business);
      }
    } catch (err) {
      console.warn('Business fetch notice in syncSession:', err);
    }
  };

  useEffect(() => {
    const client = getSupabase();

    if (!client) {
      // Default to restaurant owner in local sandbox mode
      setUser({
        id: 'u1111111-1111-1111-1111-111111111111',
        email: 'owner@bellavista.com',
      });
      setProfile({
        id: 'u1111111-1111-1111-1111-111111111111',
        email: 'owner@bellavista.com',
        full_name: 'Marco Rossi',
        role: 'restaurant_owner',
        business_id: SANDBOX_BUSINESSES[0].id,
        created_at: new Date().toISOString(),
      });
      setCurrentBusiness(SANDBOX_BUSINESSES[0]);
      setIsSupabaseAuth(false);
      setLoading(false);
      return;
    }

    // Supabase is configured! Listen to auth state
    setIsSupabaseAuth(true);

    const initAuth = async () => {
      try {
        const { data: { session } } = await client.auth.getSession();
        if (session?.user) {
          await syncSession(session);
        } else {
          setUser(null);
          setProfile(null);
          const { data: firstBiz } = await client.from('businesses').select('*').limit(1);
          if (firstBiz && firstBiz.length > 0) {
            setCurrentBusiness(firstBiz[0] as Business);
          } else {
            setCurrentBusiness(null);
          }
        }
      } catch (err) {
        console.warn('Supabase session load error:', err);
      } finally {
        setLoading(false);
      }
    };

    if (typeof window !== 'undefined') {
      const h = window.location.hash;
      const s = window.location.search;
      if (
        h.includes('type=recovery') ||
        h.includes('reset-password') ||
        s.includes('type=recovery') ||
        s.includes('code=')
      ) {
        setIsPasswordRecovery(true);
      }
    }

    initAuth();

    const { data: { subscription } } = client.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }

      if (session?.user) {
        await syncSession(session);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const refreshSession = async (): Promise<void> => {
    const client = getSupabase();
    if (!client) return;

    try {
      const { data: { session }, error } = await client.auth.getSession();
      if (error) {
        console.warn('Session refresh error:', error);
      }
      if (session?.user) {
        await syncSession(session);
      } else {
        setUser(null);
        setProfile(null);
      }
    } catch (err) {
      console.warn('Failed to refresh Supabase session:', err);
    }
  };

  const signIn = async (email: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    const client = getSupabase();
    if (!client) {
      return { success: false, error: 'Supabase client is not configured. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' };
    }

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      return { success: false, error: 'Please enter your email address.' };
    }

    if (!password) {
      return { success: false, error: 'Password is required to authenticate with Supabase.' };
    }

    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data.user) {
        return { success: false, error: 'No user returned from Supabase.' };
      }

      // Explicitly refresh session using the existing Supabase client to ensure session and tokens are updated
      const { data: sessionData, error: refreshError } = await client.auth.getSession();
      if (refreshError) {
        console.warn('Session refresh warning after sign-in:', refreshError);
      }

      const activeSession = sessionData?.session || data.session;
      if (activeSession) {
        await syncSession(activeSession);
      } else {
        setUser({ id: data.user.id, email: data.user.email || cleanEmail });
      }

      setIsSupabaseAuth(true);
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  };

  const signUp = async (
    email: string,
    password?: string,
    fullName?: string,
    role: UserRole = 'restaurant_owner'
  ): Promise<{ success: boolean; error?: string }> => {
    const client = getSupabase();
    if (client) {
      if (!password) {
        return { success: false, error: 'Password is required to create a Supabase account.' };
      }
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, role },
        },
      });
      if (error) return { success: false, error: error.message };
      if (data.user) {
        return { success: true };
      }
      return { success: false, error: 'Failed to create user account.' };
    }

    return { success: false, error: 'Supabase client is not configured.' };
  };

  const resetPasswordForEmail = async (email: string): Promise<{ success: boolean; error?: string }> => {
    const client = getSupabase();
    if (client) {
      const cleanEmail = email.trim();
      if (!cleanEmail) {
        return { success: false, error: 'Please enter a valid email address.' };
      }
      const redirectTo = getPasswordResetRedirectUrl();
      const { error } = await client.auth.resetPasswordForEmail(cleanEmail, { redirectTo });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    }
    return { success: false, error: 'Supabase client is not configured.' };
  };

  const updatePassword = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    const client = getSupabase();
    if (client) {
      if (!newPassword || newPassword.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters long.' };
      }
      const { data, error } = await client.auth.updateUser({ password: newPassword });
      if (error) {
        return { success: false, error: error.message };
      }
      if (data.user) {
        setUser({ id: data.user.id, email: data.user.email || '' });
      }
      setIsPasswordRecovery(false);
      if (typeof window !== 'undefined' && window.location.hash.startsWith('#reset-password')) {
        window.location.hash = '';
      }
      return { success: true };
    }
    return { success: false, error: 'Supabase client is not configured.' };
  };

  const signOut = async () => {
    const client = getSupabase();
    if (client) {
      try {
        await client.auth.signOut();
      } catch {
        // ignore
      }
    }
    setUser(null);
    setProfile(null);
  };

  const switchDemoRole = (role: UserRole, businessId?: string) => {
    if (role === 'founder') {
      setUser({ id: 'u_founder_demo', email: 'founder@hereview.com' });
      setProfile({
        id: 'u_founder_demo',
        email: 'founder@hereview.com',
        full_name: 'Sarah Chen (Platform Founder)',
        role: 'founder',
        created_at: new Date().toISOString(),
      });
    } else {
      const b = SANDBOX_BUSINESSES.find((item) => item.id === businessId) || SANDBOX_BUSINESSES[0];
      setUser({ id: 'u_owner_demo', email: 'owner@' + b.slug + '.com' });
      setProfile({
        id: 'u_owner_demo',
        email: 'owner@' + b.slug + '.com',
        full_name: `${b.name} Manager`,
        role: 'restaurant_owner',
        business_id: b.id,
        created_at: new Date().toISOString(),
      });
      setCurrentBusiness(b);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        currentBusiness,
        loading,
        isSupabaseAuth,
        isPasswordRecovery,
        setIsPasswordRecovery,
        signIn,
        signUp,
        resetPasswordForEmail,
        updatePassword,
        refreshSession,
        signOut,
        switchDemoRole,
        setCurrentBusiness,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
