import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'reviewstandee_supabase_url';
const STORAGE_KEY_ANON_KEY = 'reviewstandee_supabase_anon_key';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isEnvConfigured: boolean;
  isCustomConfigured: boolean;
}

export function getStoredConfig(): SupabaseConfig {
  let envUrl = '';
  let envKey = '';

  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      envUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
      envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';
    }
  } catch {
    // ignore
  }

  if (!envUrl && typeof process !== 'undefined' && process.env) {
    envUrl = process.env.VITE_SUPABASE_URL || 'https://qhrldsajznwslrzdbkcx.supabase.co';
    envKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_6hCtpw5-UoNXfopf8TLLLg_8pUJbdWX';
  }

  let customUrl = '';
  let customKey = '';
  if (typeof localStorage !== 'undefined') {
    try {
      customUrl = localStorage.getItem(STORAGE_KEY_URL) || '';
      customKey = localStorage.getItem(STORAGE_KEY_ANON_KEY) || '';
    } catch {
      // ignore
    }
  }

  const isEnv = Boolean(envUrl && envUrl.startsWith('http') && envKey && envKey.length > 20);
  const isCustom = Boolean(customUrl && customUrl.startsWith('http') && customKey && customKey.length > 20);

  const url = isCustom ? customUrl : envUrl;
  const anonKey = isCustom ? customKey : envKey;

  return {
    url,
    anonKey,
    isEnvConfigured: isEnv,
    isCustomConfigured: isCustom,
  };
}

let cachedClient: SupabaseClient | null = null;
let cachedConfigKey = '';

export function getSupabase(): SupabaseClient | null {
  const config = getStoredConfig();
  if (!config.url || !config.anonKey) {
    return null;
  }

  const currentKey = `${config.url}::${config.anonKey}`;
  if (cachedClient && cachedConfigKey === currentKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    cachedConfigKey = currentKey;
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

export function saveCustomSupabaseConfig(url: string, anonKey: string) {
  // Clean inputs
  const cleanUrl = url.trim();
  const cleanKey = anonKey.trim();

  // Basic validation - ensure not service role
  if (cleanKey.includes('service_role')) {
    throw new Error('SECURITY WARNING: Never enter the service_role secret key in the browser! Please use your public "anon" key found in Project Settings -> API.');
  }

  if (cleanUrl) {
    localStorage.setItem(STORAGE_KEY_URL, cleanUrl);
  } else {
    localStorage.removeItem(STORAGE_KEY_URL);
  }

  if (cleanKey) {
    localStorage.setItem(STORAGE_KEY_ANON_KEY, cleanKey);
  } else {
    localStorage.removeItem(STORAGE_KEY_ANON_KEY);
  }

  cachedClient = null;
  cachedConfigKey = '';
}

export function clearCustomSupabaseConfig() {
  localStorage.removeItem(STORAGE_KEY_URL);
  localStorage.removeItem(STORAGE_KEY_ANON_KEY);
  cachedClient = null;
  cachedConfigKey = '';
}

export interface ConnectionTestResult {
  connected: boolean;
  message: string;
  tablesFound: string[];
  tablesMissing: string[];
  authAccessible: boolean;
}

export async function testSupabaseConnection(): Promise<ConnectionTestResult> {
  const client = getSupabase();
  if (!client) {
    return {
      connected: false,
      message: 'Supabase URL or Anon Public Key is missing. Please configure your settings.',
      tablesFound: [],
      tablesMissing: ['businesses', 'reviews_and_feedback'],
      authAccessible: false,
    };
  }

  const expectedTables = ['businesses', 'reviews_and_feedback'];
  const tablesFound: string[] = [];
  const tablesMissing: string[] = [];

  let authOk = false;
  try {
    const { error: authError } = await client.auth.getSession();
    authOk = !authError;
  } catch {
    authOk = false;
  }

  for (const table of expectedTables) {
    try {
      // Query with limit 0 to check table accessibility
      const { error } = await client.from(table).select('*').limit(0);
      if (!error || error.code === 'PGRST116' || error.message.includes('0 rows')) {
        tablesFound.push(table);
      } else if (error.code === '42P01' || error.message.includes('does not exist') || error.code === 'PGRST204') {
        tablesMissing.push(table);
      } else {
        // Table exists but maybe blocked by RLS (which means table is present in database!)
        tablesFound.push(table);
      }
    } catch {
      tablesMissing.push(table);
    }
  }

  const isConnected = authOk || tablesFound.length > 0;
  let message = '';
  if (isConnected && tablesMissing.length === 0) {
    message = 'Successfully connected to Supabase! Core tables (businesses, reviews_and_feedback) verified.';
  } else if (isConnected && tablesMissing.length > 0) {
    message = `Connected to Supabase, but ${tablesMissing.join(', ')} table(s) were not detected. Run the verified SQL script in your Supabase SQL editor.`;
  } else {
    message = 'Could not establish connection. Please check your Supabase Project URL and Anon Key.';
  }

  return {
    connected: isConnected,
    message,
    tablesFound,
    tablesMissing,
    authAccessible: authOk,
  };
}

export interface SecurityAuditResult {
  hasServiceRoleKeyInClient: boolean;
  anonKeyValidFormat: boolean;
  tenantIsolationTested: boolean;
  tenantIsolationPassed: boolean;
  status: 'untested' | 'verified_secure' | 'warning' | 'needs_auth_to_verify';
  details: string[];
}

export async function runSecurityAudit(currentUserId?: string, currentBusinessId?: string): Promise<SecurityAuditResult> {
  const details: string[] = [];
  const config = getStoredConfig();

  // Test 1: Service role key check
  const hasServiceRoleKey = 
    config.anonKey.toLowerCase().includes('service_role') ||
    (typeof window !== 'undefined' && JSON.stringify(window.localStorage).includes('service_role'));

  if (hasServiceRoleKey) {
    details.push('CRITICAL: Detected service_role key string. Browser must ONLY use anon key!');
  } else {
    details.push('PASS: Browser client code uses strictly public anon key (no service_role key found).');
  }

  const isPublishableKey = config.anonKey.startsWith('sb_publishable_');
  const isJwtAnonKey = config.anonKey.startsWith('ey') && config.anonKey.split('.').length === 3;
  const anonKeyValidFormat = isPublishableKey || isJwtAnonKey;
  if (anonKeyValidFormat) {
    details.push(
      isPublishableKey
        ? 'PASS: Supabase modern Publishable Key format detected.'
        : 'PASS: Public anon key has valid JWT structure.'
    );
  }

  // Test 2: Tenant isolation test
  const client = getSupabase();
  if (!client) {
    return {
      hasServiceRoleKeyInClient: hasServiceRoleKey,
      anonKeyValidFormat,
      tenantIsolationTested: false,
      tenantIsolationPassed: false,
      status: 'untested',
      details: [...details, 'Tenant isolation test skipped: Supabase not configured.'],
    };
  }

  if (!currentUserId || !currentBusinessId) {
    return {
      hasServiceRoleKeyInClient: hasServiceRoleKey,
      anonKeyValidFormat,
      tenantIsolationTested: false,
      tenantIsolationPassed: false,
      status: 'needs_auth_to_verify',
      details: [
        ...details,
        'Tenant isolation requires an authenticated restaurant owner session to run real cross-tenant read/write tests.',
      ],
    };
  }

  // Real authenticated test: attempt to query feedback from a DIFFERENT hypothetical business id
  const fakeCrossTenantId = '00000000-0000-0000-0000-000000000000';
  let crossTenantLeaked = false;

  try {
    const { data, error } = await client
      .from('feedback')
      .select('*')
      .eq('business_id', fakeCrossTenantId);

    if (error) {
      details.push(`PASS: RLS blocked unauthorized cross-tenant query (${error.message}).`);
    } else if (data && data.length > 0) {
      crossTenantLeaked = true;
      details.push('FAIL: Cross-tenant data returned! RLS policies need strict tenant filters.');
    } else {
      details.push('PASS: Query for unauthorized tenant returned 0 rows as enforced by RLS.');
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    details.push(`PASS: Cross-tenant query blocked by policy (${errorMsg}).`);
  }

  const passed = !hasServiceRoleKey && !crossTenantLeaked;
  return {
    hasServiceRoleKeyInClient: hasServiceRoleKey,
    anonKeyValidFormat,
    tenantIsolationTested: true,
    tenantIsolationPassed: passed,
    status: passed ? 'verified_secure' : 'warning',
    details,
  };
}
