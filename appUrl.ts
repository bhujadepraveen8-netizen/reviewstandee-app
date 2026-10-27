/**
 * Canonical URL utilities for HeReview.
 * Dynamically determines the application URL from the live browser context (window.location.origin),
 * making VITE_APP_URL completely optional.
 */

export const DEV_APP_URL = 'https://ais-dev-pjn3b6xprb4ixpuejbmm76-976431152729.asia-east1.run.app';
export const PREVIEW_APP_URL = 'https://ais-pre-pjn3b6xprb4ixpuejbmm76-976431152729.asia-east1.run.app';

/**
 * Returns the canonical public web URL for this application.
 * Priority:
 * 1. Live browser origin (window.location.origin) - dynamic, requires zero configuration
 * 2. Optional VITE_APP_URL or APP_URL environment variable if explicitly specified
 * 3. Default fallback to Cloud Run URL
 */
export function getAppBaseUrl(): string {
  // 1. Live browser window.location.origin (always preferred and dynamic)
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    if (
      origin &&
      origin.startsWith('http') &&
      !origin.includes('127.0.0.1') &&
      !origin.includes('0.0.0.0')
    ) {
      return origin.replace(/\/$/, '');
    }
  }

  // 2. Injected environment variable (optional override)
  const envUrl =
    (import.meta.env?.VITE_APP_URL as string) ||
    (import.meta.env?.APP_URL as string) ||
    '';
  if (
    envUrl &&
    envUrl.startsWith('http') &&
    !envUrl.includes('127.0.0.1') &&
    !envUrl.includes('0.0.0.0')
  ) {
    return envUrl.replace(/\/$/, '');
  }

  // 3. Current window origin fallback if available
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }

  // 4. Default fallback
  return DEV_APP_URL;
}

export function getSharedAppUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    if (origin.includes('ais-pre-')) {
      return origin;
    }
  }
  return PREVIEW_APP_URL;
}

/**
 * The exact URL passed to Supabase auth.resetPasswordForEmail({ redirectTo }).
 * Must match an entry in Supabase Authentication -> URL Configuration -> Redirect URLs.
 */
export function getPasswordResetRedirectUrl(): string {
  return `${getAppBaseUrl()}/#reset-password`;
}

/**
 * Exact values required in Supabase Dashboard -> Authentication -> URL Configuration.
 */
export function getSupabaseUrlConfiguration() {
  const currentBase = getAppBaseUrl();
  const urls = new Set<string>();

  if (currentBase) {
    urls.add(`${currentBase}/**`);
    urls.add(`${currentBase}/#reset-password`);
  }
  if (DEV_APP_URL && DEV_APP_URL !== currentBase) {
    urls.add(`${DEV_APP_URL}/**`);
    urls.add(`${DEV_APP_URL}/#reset-password`);
  }
  if (PREVIEW_APP_URL && PREVIEW_APP_URL !== currentBase) {
    urls.add(`${PREVIEW_APP_URL}/**`);
    urls.add(`${PREVIEW_APP_URL}/#reset-password`);
  }

  return {
    siteUrl: currentBase || DEV_APP_URL,
    redirectUrls: Array.from(urls),
  };
}
