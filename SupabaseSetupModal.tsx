import React, { useState } from 'react';
import {
  getStoredConfig,
  saveCustomSupabaseConfig,
  clearCustomSupabaseConfig,
  testSupabaseConnection,
  runSecurityAudit,
  ConnectionTestResult,
  SecurityAuditResult,
} from '../lib/supabaseClient';
import { SUPABASE_SQL_SCHEMA, GUEST_QR_FIX_SQL, FOUNDER_DELETE_RLS_FIX_SQL } from '../lib/sqlMigration';
import { useAuth } from '../lib/AuthContext';
import { DEV_APP_URL, PREVIEW_APP_URL, getPasswordResetRedirectUrl, getSupabaseUrlConfiguration } from '../lib/appUrl';

interface SupabaseSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseSetupModal: React.FC<SupabaseSetupModalProps> = ({ isOpen, onClose }) => {
  const { user, profile } = useAuth();
  const config = getStoredConfig();

  const [activeTab, setActiveTab] = useState<'settings' | 'qr_fix' | 'delete_fix' | 'sql' | 'audit' | 'urls'>('settings');
  const [projectUrl, setProjectUrl] = useState(config.url || '');
  const [anonKey, setAnonKey] = useState(config.anonKey || '');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedQrFixSql, setCopiedQrFixSql] = useState(false);
  const [copiedDeleteFixSql, setCopiedDeleteFixSql] = useState(false);
  const [copiedSiteUrl, setCopiedSiteUrl] = useState(false);
  const [copiedRedirectUrls, setCopiedRedirectUrls] = useState(false);

  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<ConnectionTestResult | null>(null);

  const [runningAudit, setRunningAudit] = useState(false);
  const [auditResult, setAuditResult] = useState<SecurityAuditResult | null>(null);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      saveCustomSupabaseConfig(projectUrl, anonKey);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      handleTestConnection();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      alert(errorMsg);
    }
  };

  const handleClear = () => {
    if (confirm('Clear custom Supabase configuration and revert to default environment settings?')) {
      clearCustomSupabaseConfig();
      setProjectUrl('');
      setAnonKey('');
      setConnectionResult(null);
      setAuditResult(null);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionResult(null);
    try {
      const result = await testSupabaseConnection();
      setConnectionResult(result);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setConnectionResult({
        connected: false,
        message: 'Test failed: ' + errorMsg,
        tablesFound: [],
        tablesMissing: ['businesses', 'reviews_and_feedback'],
        authAccessible: false,
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleRunAudit = async () => {
    setRunningAudit(true);
    setAuditResult(null);
    try {
      const result = await runSecurityAudit(user?.id, profile?.business_id);
      setAuditResult(result);
    } catch (err) {
      console.error(err);
    } finally {
      setRunningAudit(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleCopyQrFixSql = () => {
    navigator.clipboard.writeText(GUEST_QR_FIX_SQL);
    setCopiedQrFixSql(true);
    setTimeout(() => setCopiedQrFixSql(false), 2500);
  };

  const handleCopyDeleteFixSql = () => {
    navigator.clipboard.writeText(FOUNDER_DELETE_RLS_FIX_SQL);
    setCopiedDeleteFixSql(true);
    setTimeout(() => setCopiedDeleteFixSql(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Supabase Connection & Security Guide</h2>
            <p className="text-xs text-slate-500">Connect your existing Supabase project with zero exposed secret keys</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1 rounded-md"
          >
            ×
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 px-6 pt-2 bg-slate-50/50 overflow-x-auto">
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'settings'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            1. API Configuration
          </button>
          <button
            onClick={() => setActiveTab('qr_fix')}
            className={`px-3 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'qr_fix'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            ⚡ Guest QR RLS Fix
          </button>
          <button
            onClick={() => setActiveTab('delete_fix')}
            className={`px-3 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'delete_fix'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            ⚡ Founder Admin &amp; Delete RLS Fix
          </button>
          <button
            onClick={() => setActiveTab('sql')}
            className={`px-3 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'sql'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            3. Full SQL Schema
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'audit'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            4. Live Security Audit
          </button>
          <button
            onClick={() => setActiveTab('urls')}
            className={`px-3 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'urls'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            5. Auth URLs
          </button>
        </div>

        {/* Tab 1: Settings */}
        {activeTab === 'settings' && (
          <div className="p-6 space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3.5 text-xs text-blue-800 space-y-1">
              <p className="font-semibold text-blue-900">Where to find these in your Supabase dashboard:</p>
              <p>1. Open your project on <span className="font-mono underline">supabase.com</span></p>
              <p>2. Navigate to <strong>Project Settings → API</strong></p>
              <p>3. Copy the <strong>Project URL</strong> and <strong>Project API key (anon / public)</strong></p>
              <p className="text-amber-800 font-medium pt-1">
                Security Rule: NEVER copy or enter your <code className="bg-amber-100 px-1 py-0.5 rounded">service_role</code> secret key in browser code!
              </p>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supabase Project URL (VITE_SUPABASE_URL)
                </label>
                <input
                  type="url"
                  placeholder="https://xyzprojectref.supabase.co"
                  value={projectUrl}
                  onChange={(e) => setProjectUrl(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supabase Public Anon Key (VITE_SUPABASE_ANON_KEY)
                </label>
                <textarea
                  rows={3}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ey..."
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  This public anon key will be used by the browser to query tables protected by Supabase Row Level Security.
                </p>
              </div>

              {saveSuccess && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-md">
                  Configuration saved in session! Testing connection now...
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs"
                  >
                    Save & Initialize
                  </button>
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testingConnection || !projectUrl || !anonKey}
                    className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {testingConnection ? 'Testing...' : 'Test Connection'}
                  </button>
                </div>

                {(config.isCustomConfigured || projectUrl) && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-xs text-rose-600 hover:underline"
                  >
                    Clear Custom Keys
                  </button>
                )}
              </div>
            </form>

            {connectionResult && (
              <div
                className={`mt-4 p-4 rounded-lg border text-xs ${
                  connectionResult.connected
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <div className="font-semibold mb-1 flex items-center justify-between">
                  <span>Connection Test: {connectionResult.connected ? 'SUCCESS' : 'ACTION REQUIRED'}</span>
                  <span className="font-mono text-[11px]">
                    Auth: {connectionResult.authAccessible ? 'Accessible' : 'Unavailable'}
                  </span>
                </div>
                <p className="mb-2">{connectionResult.message}</p>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="font-semibold">Detected Tables ({connectionResult.tablesFound.length}):</span>
                    <ul className="list-disc list-inside text-emerald-800 mt-0.5">
                      {connectionResult.tablesFound.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="font-semibold">Missing Tables ({connectionResult.tablesMissing.length}):</span>
                    <ul className="list-disc list-inside text-rose-800 mt-0.5">
                      {connectionResult.tablesMissing.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                      {connectionResult.tablesMissing.length === 0 && <li className="text-slate-500">None</li>}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Guest QR RLS Fix */}
        {activeTab === 'qr_fix' && (
          <div className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-900">
                  Guest QR & Feedback RLS Fix Script (Quick Fix)
                </p>
                <p className="text-[11px] text-slate-500">
                  Fixes: <code className="text-rose-600 bg-rose-50 px-1 py-0.5 rounded font-mono">new row violates row-level security policy for table "qr_events"</code>
                </p>
              </div>
              <button
                onClick={handleCopyQrFixSql}
                className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-xs"
              >
                {copiedQrFixSql ? 'Copied to Clipboard!' : 'Copy Fix Script'}
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-900 space-y-1.5">
              <p className="font-bold text-amber-950">How to apply in Supabase SQL Editor:</p>
              <p>1. Open your <strong>Supabase Dashboard</strong> → Click <strong>SQL Editor</strong> in the left sidebar.</p>
              <p>2. Click <strong>+ New query</strong>, paste the script below, and click <strong>Run</strong>.</p>
              <p>3. This grants safe public INSERT policies for <code className="font-mono bg-amber-100 px-1 rounded">qr_events</code> and <code className="font-mono bg-amber-100 px-1 rounded">feedback</code> and ensures the default client exists.</p>
            </div>

            <div className="relative">
              <pre className="bg-slate-900 text-slate-100 text-[11px] p-4 rounded-lg overflow-x-auto max-h-72 font-mono leading-relaxed border border-slate-800">
                {GUEST_QR_FIX_SQL}
              </pre>
            </div>
          </div>
        )}

        {/* Tab: Founder Access & Delete RLS Fix */}
        {activeTab === 'delete_fix' && (
          <div className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-900">
                  Founder Admin Access &amp; Permanent Business Deletion RLS Fix (Verified Schema)
                </p>
                <p className="text-[11px] text-slate-500">
                  Configured strictly for <code className="font-mono text-blue-700 bg-blue-50 px-1 rounded">public.businesses</code> &amp; <code className="font-mono text-blue-700 bg-blue-50 px-1 rounded">public.reviews_and_feedback</code> without referencing nonexistent tables.
                </p>
              </div>
              <button
                onClick={handleCopyDeleteFixSql}
                className="px-3.5 py-1.5 text-xs font-semibold bg-rose-600 text-white rounded-md hover:bg-rose-700 transition-colors shadow-xs cursor-pointer"
              >
                {copiedDeleteFixSql ? 'Copied to Clipboard!' : 'Copy Founder RLS Fix Script'}
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-[11px] text-blue-900 space-y-1.5">
              <p className="font-bold text-blue-950">How to apply in Supabase SQL Editor:</p>
              <p>1. Open your <strong>Supabase Dashboard</strong> → Click <strong>SQL Editor</strong> in the left sidebar.</p>
              <p>2. Click <strong>+ New query</strong>, paste the script below, and click <strong>Run</strong>.</p>
              <p>3. This restores full <code className="font-mono bg-blue-100 px-1 rounded">SELECT</code> read access and <code className="font-mono bg-blue-100 px-1 rounded">DELETE</code> privileges for Founder Admin (<code className="font-mono bg-blue-100 px-1 rounded">kumarharishbhai34@gmail.com</code>) without creating any fake tables.</p>
            </div>

            <div className="relative">
              <pre className="bg-slate-900 text-slate-100 text-[11px] p-4 rounded-lg overflow-x-auto max-h-72 font-mono leading-relaxed border border-slate-800">
                {FOUNDER_DELETE_RLS_FIX_SQL}
              </pre>
            </div>
          </div>
        )}

        {/* Tab 3: Full SQL Script */}
        {activeTab === 'sql' && (
          <div className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-900">
                  Required Supabase Schema & Row Level Security (RLS)
                </p>
                <p className="text-[11px] text-slate-500">
                  Includes verified tables: businesses, reviews_and_feedback
                </p>
              </div>
              <button
                onClick={handleCopySql}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors shadow-xs"
              >
                {copiedSql ? 'Copied to Clipboard!' : 'Copy SQL Script'}
              </button>
            </div>

            <div className="relative">
              <pre className="bg-slate-900 text-slate-100 text-[11px] p-4 rounded-lg overflow-x-auto max-h-80 font-mono leading-relaxed border border-slate-800">
                {SUPABASE_SQL_SCHEMA}
              </pre>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-900 space-y-1">
              <p className="font-semibold">How to run in Supabase:</p>
              <p>1. Open your Supabase Dashboard → <strong>SQL Editor</strong></p>
              <p>2. Click <strong>New query</strong> and paste this entire script.</p>
              <p>3. Click <strong>Run</strong>. All tables and RLS tenant isolation policies will be created safely without duplicating existing tables!</p>
            </div>
          </div>
        )}

        {/* Tab 3: Security & RLS Audit */}
        {activeTab === 'audit' && (
          <div className="p-6 space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-slate-900">
                Tenant Isolation & Row Level Security Verification
              </h3>
              <p className="text-[11px] text-slate-500">
                Per requirement: Security is only marked verified after performing authenticated access tests.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Current Auth State:</span>
                <span className="font-mono font-medium text-slate-900">
                  {user ? `${user.email} (${profile?.role || 'user'})` : 'Not Authenticated'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Current Tenant ID:</span>
                <span className="font-mono text-[11px] text-slate-700">
                  {profile?.business_id || 'None (Public Diner or Admin)'}
                </span>
              </div>
            </div>

            <button
              onClick={handleRunAudit}
              disabled={runningAudit}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs disabled:opacity-50"
            >
              {runningAudit ? 'Executing Live Access Tests...' : 'Execute Authenticated Security Tests'}
            </button>

            {auditResult && (
              <div
                className={`p-4 rounded-lg border text-xs space-y-2 ${
                  auditResult.status === 'verified_secure'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : auditResult.status === 'needs_auth_to_verify'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span>AUDIT RESULT:</span>
                  <span className="uppercase tracking-wide">
                    {auditResult.status === 'verified_secure'
                      ? 'Verified Secure (Tenant Isolated)'
                      : auditResult.status === 'needs_auth_to_verify'
                      ? 'Auth Required for Full Verification'
                      : 'Attention Required'}
                  </span>
                </div>

                <div className="space-y-1 text-[11px] pt-1">
                  {auditResult.details.map((item, idx) => (
                    <div key={idx} className="font-mono flex items-start gap-1.5">
                      <span>•</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Auth & Redirect URLs */}
        {activeTab === 'urls' && (
          <div className="p-6 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-950">
                <span>⚠️</span>
                <span>ईमेल रीसेट लिंक localhost:3000 पर क्यों जाता है?</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-800">
                Supabase प्रोजेक्ट्स में डिफ़ॉल्ट रूप से <strong>Site URL</strong> <code className="bg-amber-100 px-1 py-0.5 rounded">http://localhost:3000</code> सेट होता है। यदि Supabase की Redirect URLs सूची में यह ऐप पंजीकृत नहीं है, तो Supabase सुरक्षा कारणों से उपयोगकर्ता को वापस डिफ़ॉल्ट Site URL (<code className="bg-amber-100 px-1 py-0.5 rounded">localhost:3000</code>) पर भेज देता है।
              </p>
              <p className="text-[11px] font-semibold text-amber-900 pt-0.5">
                नीचे दिए गए मानों को अपने <strong>Supabase Dashboard → Authentication → URL Configuration</strong> में सेट करें:
              </p>
            </div>

            {/* Site URL Configuration Card */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900">1. Site URL (प्राथमिक साइट URL)</span>
                  <p className="text-[11px] text-slate-500">यह Supabase Auth का प्राथमिक बेस URL बनता है।</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(DEV_APP_URL);
                    setCopiedSiteUrl(true);
                    setTimeout(() => setCopiedSiteUrl(false), 2500);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                >
                  {copiedSiteUrl ? '✓ Copied!' : 'Copy Site URL'}
                </button>
              </div>
              <div className="font-mono text-xs p-2 bg-white border border-slate-200 rounded-lg text-slate-800 break-all select-all">
                {DEV_APP_URL}
              </div>
            </div>

            {/* Redirect URLs Configuration Card */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900">2. Redirect URLs (अनुमत पुनर्निर्देशन सूची)</span>
                  <p className="text-[11px] text-slate-500">Password Recovery व Magic Link के लिए वाइल्डकार्ड समेत जोड़ें।</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const text = getSupabaseUrlConfiguration().redirectUrls.join('\n');
                    navigator.clipboard.writeText(text);
                    setCopiedRedirectUrls(true);
                    setTimeout(() => setCopiedRedirectUrls(false), 2500);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                >
                  {copiedRedirectUrls ? '✓ All Copied!' : 'Copy All Redirect URLs'}
                </button>
              </div>

              <div className="space-y-1.5">
                {getSupabaseUrlConfiguration().redirectUrls.map((url, i) => (
                  <div key={i} className="flex items-center justify-between font-mono text-[11px] p-2 bg-white border border-slate-200 rounded-md text-slate-800">
                    <span className="truncate pr-2">{url}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(url);
                      }}
                      className="text-[10px] text-slate-400 hover:text-blue-600 shrink-0 font-sans"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Password Reset Direct Redirect Info */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs space-y-1">
              <div className="font-semibold text-blue-950">App Code Fix Active:</div>
              <p className="text-[11px] text-blue-900 leading-relaxed">
                HeReview अब पासवर्ड रीसेट ईमेल भेजते समय <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">{getPasswordResetRedirectUrl()}</code> को <code className="font-mono">redirectTo</code> के रूप में Supabase को भेजता है। जब आप ईमेल लिंक खोलेंगे, तो नया पासवर्ड सेट करने का डायलॉग तुरंत खुल जाएगा।
              </p>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
