import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { UserRole } from '../types';
import { getPasswordResetRedirectUrl } from '../lib/appUrl';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { signIn, signUp, resetPasswordForEmail, switchDemoRole, isSupabaseAuth } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot_password'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('restaurant_owner');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isInvalidCredentials, setIsInvalidCredentials] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Guarantee clean sign-in mode whenever the modal opens
  React.useEffect(() => {
    if (isOpen) {
      setMode('signin');
      setErrorMsg('');
      setIsInvalidCredentials(false);
      setLoading(false);
      setResetSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setIsInvalidCredentials(false);

    try {
      if (mode === 'signin') {
        const res = await signIn(email, password);
        if (res.success) {
          setErrorMsg('');
          setIsInvalidCredentials(false);
          onClose();
        } else {
          const err = res.error || 'Failed to sign in. Check your credentials.';
          if (
            err.toLowerCase().includes('invalid login credentials') ||
            err.toLowerCase().includes('invalid_grant') ||
            err.toLowerCase().includes('invalid credentials')
          ) {
            setIsInvalidCredentials(true);
            setErrorMsg(err);
          } else if (err.toLowerCase().includes('email not confirmed')) {
            setErrorMsg('Email not confirmed: Supabase requires email verification before signing in. Please check your inbox or confirm the email in your Supabase Dashboard.');
          } else {
            setErrorMsg(err);
          }
        }
      } else if (mode === 'signup') {
        const res = await signUp(email, password, fullName, role);
        if (res.success) {
          alert('Account created! If email confirmation is enabled in your Supabase project, check your inbox.');
          onClose();
        } else {
          setErrorMsg(res.error || 'Failed to sign up.');
        }
      } else if (mode === 'forgot_password') {
        const res = await resetPasswordForEmail(email);
        if (res.success) {
          setResetSuccess(true);
        } else {
          const err = res.error || 'Failed to send reset email.';
          if (err.toLowerCase().includes('rate limit') || err.toLowerCase().includes('rate_limit')) {
            setErrorMsg(
              'Supabase Email Rate Limit Exceeded (ईमेल भेजने की सीमा पार हो गई): Supabase के डिफ़ॉल्ट मेल सर्वर पर प्रति घंटा 3-4 ईमेल की सीमा होती है। कृपया 1 घंटा प्रतीक्षा करें या Supabase Dashboard (Authentication -> Users -> Edit User) से सीधे नया पासवर्ड सेट करें।'
            );
          } else {
            setErrorMsg(err);
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      if (msg.toLowerCase().includes('invalid login credentials')) {
        setIsInvalidCredentials(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = (selectedRole: UserRole) => {
    switchDemoRole(selectedRole);
    onClose();
  };

  const handleSwitchMode = (newMode: 'signin' | 'signup' | 'forgot_password') => {
    setMode(newMode);
    setErrorMsg('');
    setIsInvalidCredentials(false);
    setResetSuccess(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {mode === 'signin'
                ? 'Sign In to HeReview'
                : mode === 'signup'
                ? 'Create HeReview Account'
                : 'Reset Password (पासवर्ड रीसेट करें)'}
            </h2>
            <p className="text-xs text-slate-500">
              {isSupabaseAuth ? 'Connected to live Supabase Auth' : 'Local Sandbox mode'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 leading-none rounded cursor-pointer"
            aria-label="Close auth dialog"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Actionable Diagnostic Error when Invalid login credentials occurs */}
          {isInvalidCredentials && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 text-xs rounded-xl space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-rose-950">
                <span>⚠️</span>
                <span>Invalid Login Credentials (गलत ईमेल या पासवर्ड)</span>
              </div>
              <p className="text-[11px] leading-relaxed text-rose-800">
                Supabase ने इस ईमेल और पासवर्ड को अस्वीकार कर दिया है। कृपया निम्नलिखित कारणों की जाँच करें:
              </p>
              <ul className="text-[11px] list-disc list-inside space-y-1 text-rose-900 font-medium">
                <li>
                  <strong>ईमेल स्पेलिंग:</strong> क्या आपने सही ईमेल एड्रेस डाला है? (जैसे <span className="font-mono">{email}</span>)
                </li>
                <li>
                  <strong>गलत पासवर्ड:</strong> क्या आपका पासवर्ड सही है? अगर भूल गए हैं, तो नीचे दिए गए{' '}
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('forgot_password')}
                    className="underline text-blue-700 font-bold hover:text-blue-900"
                  >
                    Forgot Password?
                  </button>{' '}
                  पर क्लिक करें।
                </li>
                <li>
                  <strong>Email Confirmation:</strong> यदि आपके Supabase प्रोजेक्ट में 'Confirm email' चालू है, तो पहले अपने ईमेल इनबॉक्स में जाकर Confirmation लिंक पर क्लिक करना अनिवार्य है।
                </li>
                <li>
                  <strong>नया यूजर:</strong> यदि आपने अभी तक अकाउंट नहीं बनाया है, तो पहले{' '}
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('signup')}
                    className="underline text-blue-700 font-bold hover:text-blue-900"
                  >
                    Sign Up
                  </button>{' '}
                  करें।
                </li>
              </ul>
            </div>
          )}

          {/* Standard generic error (if not invalid credentials) */}
          {errorMsg && !isInvalidCredentials && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">
              {errorMsg}
            </div>
          )}

          {/* Mode 1 & 2: Sign In / Sign Up Form */}
          {mode !== 'forgot_password' && (
            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === 'signup' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Marco Rossi"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Account Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="restaurant_owner">Restaurant Owner (Single Tenant)</option>
                      <option value="founder">Founder Admin (All Tenants Platform Access)</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@restaurant.com"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Password</label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('forgot_password')}
                      className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline font-medium"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs disabled:opacity-50 mt-2"
              >
                {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            </form>
          )}

          {/* Mode 3: Forgot Password Form */}
          {mode === 'forgot_password' && (
            <div className="space-y-4">
              {resetSuccess ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3 text-center">
                  <div className="w-10 h-10 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-lg">
                    ✓
                  </div>
                  <h3 className="text-xs font-bold text-emerald-950">Password Reset Email Sent!</h3>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    हमने <strong>{email}</strong> पर पासवर्ड रीसेट लिंक भेज दिया है।
                  </p>
                  <div className="p-2.5 bg-white border border-emerald-200 rounded-lg text-left text-[11px] text-slate-700 space-y-1">
                    <div className="font-semibold text-slate-900">Redirect Target URL:</div>
                    <code className="block p-1 bg-slate-50 border border-slate-200 rounded text-[10px] break-all font-mono text-blue-700">
                      {getPasswordResetRedirectUrl()}
                    </code>
                    <p className="text-[10px] text-slate-500 pt-0.5">
                      ⚠️ यदि लिंक पर क्लिक करने पर भी localhost:3000 खुलता है, तो Supabase Dashboard में Site URL को इस ऐप के URL पर सेट करें।
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('signin')}
                    className="w-full py-2 text-xs font-semibold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors"
                  >
                    Back to Sign In (लॉगिन पर वापस जाएं)
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    अपना रजिस्टर्ड ईमेल एड्रेस दर्ज करें। हम आपको पासवर्ड रीसेट करने के लिए Supabase Auth लिंक भेजेंगे।
                  </p>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Registered Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. bhujaden@gmail.com"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Supabase URL Configuration Warning & Info Box */}
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-amber-950 text-[11px]">
                      <span>🔗</span>
                      <span>Password Recovery Redirect Target</span>
                    </div>
                    <p className="text-[11px] text-amber-900 leading-relaxed">
                      यह ऐप Supabase को रीसेट लिंक के लिए यह Redirect URL भेजता है:
                    </p>
                    <div className="font-mono text-[10px] bg-white p-1.5 rounded border border-amber-300 text-slate-800 break-all select-all">
                      {getPasswordResetRedirectUrl()}
                    </div>
                    <p className="text-[10px] text-amber-800">
                      <strong>जरूरी:</strong> Supabase Dashboard &gt; <em>Authentication &gt; URL Configuration</em> में <strong>Site URL</strong> को इस ऐप का URL रखें, ताकि ईमेल लिंक कभी भी <code className="bg-amber-100 px-0.5 rounded">localhost:3000</code> पर न भटके।
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !email.trim()}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs disabled:opacity-50"
                  >
                    {loading ? 'Sending Reset Link...' : 'Send Password Reset Link (रीसेट लिंक भेजें)'}
                  </button>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('signin')}
                      className="text-xs text-slate-500 hover:text-slate-800 underline"
                    >
                      ← Back to Sign In
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Mode Switchers */}
          {mode !== 'forgot_password' && (
            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleSwitchMode(mode === 'signin' ? 'signup' : 'signin')}
                className="text-blue-600 hover:underline"
              >
                {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </div>
          )}

          {/* Quick Demo Switcher */}
          <div className="pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-slate-500">
                UI Sandbox Mode (स्थानीय पूर्वावलोकन)
              </span>
              <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-medium">
                Not Supabase Auth
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
              यह केवल यूआई लेआउट टेस्ट करने के लिए है। असली Supabase डेटाबेस और RLS रिकॉर्ड्स देखने के लिए ऊपर असली ईमेल/पासवर्ड से लॉगिन आवश्यक है।
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemo('restaurant_owner')}
                className="p-2 border border-slate-200 hover:border-slate-300 rounded-lg text-left text-xs bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="font-semibold text-slate-900">Sandbox Owner</div>
                <div className="text-[10px] text-slate-500">Offline Simulation</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo('founder')}
                className="p-2 border border-slate-200 hover:border-slate-300 rounded-lg text-left text-xs bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="font-semibold text-slate-900">Sandbox Founder</div>
                <div className="text-[10px] text-slate-500">Offline Simulation</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
