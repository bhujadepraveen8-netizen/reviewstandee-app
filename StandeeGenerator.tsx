import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Business } from '../types';
import { getAppBaseUrl } from '../lib/appUrl';

interface StandeeGeneratorProps {
  business: Business | null;
  onNavigateToAdmin?: () => void;
}

export const StandeeGenerator: React.FC<StandeeGeneratorProps> = ({ business, onNavigateToAdmin }) => {
  const isRestaurant = (business?.category || '').toLowerCase() === 'restaurant';
  const [tableNumber, setTableNumber] = useState(isRestaurant ? '04' : '');
  const [callToAction, setCallToAction] = useState('Scan to rate your experience & win a dessert!');
  const [secondaryText, setSecondaryText] = useState('We value your honest feedback · Takes only 15 seconds');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const printRef = useRef<HTMLDivElement>(null);

  // Sync category awareness when business changes
  useEffect(() => {
    const isRest = (business?.category || '').toLowerCase() === 'restaurant';
    if (!isRest) {
      setTableNumber('');
    } else if (!tableNumber) {
      setTableNumber('04');
    }
  }, [business?.id, business?.category]);

  // Compute public QR target URL using canonical preview host
  const appBaseUrl = getAppBaseUrl();
  const slug = business?.slug || 'my-client';
  const qrTargetUrl = `${appBaseUrl}/#qr/${slug}${isRestaurant && tableNumber ? `?table=${encodeURIComponent(tableNumber)}` : ''}`;

  if (!business) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-xs space-y-3">
        <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-lg">
          🪧
        </div>
        <h2 className="text-base font-bold text-slate-900">No Client Selected</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Please select or add a client in the Founder Admin Console to customize and print QR standees.
        </p>
        {onNavigateToAdmin && (
          <button
            onClick={onNavigateToAdmin}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs"
          >
            Open Founder Admin Console →
          </button>
        )}
      </div>
    );
  }

  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(
      qrTargetUrl,
      {
        width: 320,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      },
      (err, url) => {
        if (!err && isMounted) {
          setQrDataUrl(url);
        }
      }
    );
    return () => {
      isMounted = false;
    };
  }, [qrTargetUrl]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    const suffix = isRestaurant && tableNumber ? `-table-${tableNumber}` : '';
    link.download = `${business.slug}${suffix}-qr.png`;
    link.href = qrDataUrl;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Top Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">QR Standee Studio</h1>
          <p className="text-xs text-slate-500">
            Generate and print physical tabletop acrylic standees for <span className="font-semibold text-slate-800">{business.name}</span>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadQR}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            Download QR PNG
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            Print Standee Card
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Customization Controls (Left 5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900">Standee Customization</h2>

          {isRestaurant ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Table Identifier
              </label>
              <input
                type="text"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="e.g. 12, Booth A, Patio 3"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Embedded in the QR URL so diner reviews are automatically matched to this table.
              </p>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Category: {business.category || 'General Business'}</span>
                <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-medium">Standard Standee</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Table numbers are excluded by default for non-restaurant clients. Scans connect directly to feedback and reviews.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Primary Headline
            </label>
            <input
              type="text"
              value={callToAction}
              onChange={(e) => setCallToAction(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Secondary Subtitle
            </label>
            <input
              type="text"
              value={secondaryText}
              onChange={(e) => setSecondaryText(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Target Scanned URL</label>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[11px] text-slate-600 break-all select-all">
              {qrTargetUrl}
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 space-y-1">
            <span className="font-bold">Acrylic Standee Sizing Tip:</span>
            <p>
              {isRestaurant
                ? 'This template fits standard 4" × 6" vertical acrylic tent card holders commonly placed at dining tables or bar counters.'
                : 'This template fits standard 4" × 6" vertical acrylic tent card holders commonly placed at reception desks, checkouts, or display counters.'}
            </p>
          </div>
        </div>

        {/* Live Standee Tent Card Preview (Right 7 Cols) */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="text-xs font-medium text-slate-500 mb-2">
            {isRestaurant ? 'Acrylic Table Standee Preview (4" × 6" Standard)' : 'Acrylic Standee Preview (4" × 6" Standard)'}
          </div>

          <div
            ref={printRef}
            className="w-full max-w-[340px] aspect-[4/6] bg-white rounded-2xl shadow-xl border-2 border-slate-200 p-6 flex flex-col justify-between items-center text-center relative overflow-hidden"
            style={{ minHeight: '480px' }}
          >
            {/* Top Branding */}
            <div className="w-full space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-lg shadow-sm">
                {business.name.slice(0, 1)}
              </div>
              <h3 className="text-lg font-extrabold tracking-tight text-slate-900">{business.name}</h3>
              <div className="flex justify-center text-amber-400 text-sm tracking-widest">
                ★★★★★
              </div>
            </div>

            {/* Middle QR Container */}
            <div className="space-y-3 w-full flex flex-col items-center">
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm inline-block">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Standee QR Code" className="w-44 h-44 object-contain" />
                ) : (
                  <div className="w-44 h-44 bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                    Generating QR...
                  </div>
                )}
              </div>

              <div className="space-y-1 max-w-[260px]">
                <h4 className="text-xs font-bold text-slate-900 leading-snug">{callToAction}</h4>
                <p className="text-[10px] text-slate-500 leading-normal">{secondaryText}</p>
              </div>
            </div>

            {/* Bottom Identifier */}
            <div className="w-full pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              {isRestaurant && tableNumber ? (
                <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                  TABLE {tableNumber}
                </span>
              ) : (
                <span className="font-medium text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded text-[10px]">
                  {business.category || 'Client Standee'}
                </span>
              )}
              <span className="font-mono text-[10px] text-slate-400 font-medium">HeReview</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
