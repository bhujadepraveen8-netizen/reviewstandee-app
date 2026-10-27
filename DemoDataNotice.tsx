import React from 'react';
import { getStoredConfig } from '../lib/supabaseClient';

interface DemoDataNoticeProps {
  onOpenSetup: () => void;
}

export const DemoDataNotice: React.FC<DemoDataNoticeProps> = ({ onOpenSetup }) => {
  const config = getStoredConfig();
  const isConnected = Boolean(config.url && config.anonKey);

  if (isConnected) {
    return null; // When connected, no intrusive banner needed
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-900">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-amber-950">Supabase Connection Required:</span>
          <span>
            Operating in Local Sandbox mode. Required settings:{' '}
            <code className="bg-amber-100 font-mono px-1 py-0.5 rounded text-[11px]">
              VITE_SUPABASE_URL
            </code>{' '}
            and{' '}
            <code className="bg-amber-100 font-mono px-1 py-0.5 rounded text-[11px]">
              VITE_SUPABASE_ANON_KEY
            </code>
            .
          </span>
        </div>
        <button
          onClick={onOpenSetup}
          className="text-xs font-semibold text-blue-700 hover:text-blue-900 underline whitespace-nowrap shrink-0 text-left sm:text-right"
        >
          Connect Your Supabase Project →
        </button>
      </div>
    </div>
  );
};
