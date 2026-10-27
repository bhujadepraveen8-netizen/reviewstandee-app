import React, { useState, useEffect } from 'react';
import { Business, DashboardStats, Feedback, Complaint, GooglePlaceDetails, ReviewFeedbackRecord } from '../types';
import {
  fetchBusinessStats,
  updateComplaintStatus,
  fetchGooglePlaceReviews,
  matchFeedbackToBusiness,
  fetchAllBusinesses,
} from '../lib/dataService';
import { getSupabase } from '../lib/supabaseClient';
import { generateMonthlyPDFReport } from '../lib/pdfReport';
import { useAuth } from '../lib/AuthContext';

interface OwnerDashboardProps {
  business: Business | null;
  onNavigateToStudio: () => void;
  onNavigateToGuestQR: () => void;
  onNavigateToAdmin?: () => void;
  onSelectBusiness?: (b: Business) => void;
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({
  business,
  onNavigateToStudio,
  onNavigateToGuestQR,
  onNavigateToAdmin,
  onSelectBusiness,
}) => {
  const { user } = useAuth();
  const [availableBusinesses, setAvailableBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [feedbackRecords, setFeedbackRecords] = useState<ReviewFeedbackRecord[]>([]);
  const [complaintsList, setComplaintsList] = useState<Complaint[]>([]);
  const [isLiveSupabase, setIsLiveSupabase] = useState(false);
  const [hasBusinessIdColumn, setHasBusinessIdColumn] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlNotice, setShowSqlNotice] = useState(true);
  const [activeTab, setActiveTab] = useState<'feedback' | 'google_reviews' | 'complaints' | 'reports'>('feedback');

  // Dynamic Realtime Metrics state (Total QR Scans, Total Ratings, Average Rating)
  const [totalScans, setTotalScans] = useState<number>(0);
  const [totalRatings, setTotalRatings] = useState<number>(0);
  const [avgRating, setAvgRating] = useState<string | number>('0.0');
  const [realtimeActive, setRealtimeActive] = useState(false);
  const [liveFeedbackNotice, setLiveFeedbackNotice] = useState<{
    message: string;
    rating: number;
    time: string;
  } | null>(null);

  // Pagination & Display state for Customer Feedback Section
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize] = useState<number>(5);
  const [viewAllFeedback, setViewAllFeedback] = useState<boolean>(false);
  const [showMobileNumbers, setShowMobileNumbers] = useState<boolean>(true);

  // Google Places API (New) state
  const [googlePlaceData, setGooglePlaceData] = useState<GooglePlaceDetails | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googleErrorCode, setGoogleErrorCode] = useState<string | undefined>(undefined);

  // Resolution modal state
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [newStatus, setNewStatus] = useState<'new' | 'investigating' | 'resolved'>('resolved');
  const [managerNotes, setManagerNotes] = useState('');
  const [savingResolution, setSavingResolution] = useState(false);

  // Dynamic Data & Feedback Fetching for Selected Business
  const loadData = async (showSpinner = true) => {
    if (!business) {
      setLoading(false);
      return;
    }
    if (showSpinner) setLoading(true);
    setDbError(null);

    try {
      const res = await fetchBusinessStats(business);
      setStats(res.stats);
      setFeedbackList(res.recentFeedback);
      setFeedbackRecords(res.feedbackRecords);
      setComplaintsList(res.complaints);
      setIsLiveSupabase(res.isLiveSupabase);
      setHasBusinessIdColumn(res.hasBusinessIdColumn);
      setTotalScans(res.stats.totalScans);
      setTotalRatings(res.stats.totalRatings);
      setAvgRating(res.stats.averageRating > 0 ? res.stats.averageRating.toFixed(1) : '—');
      if (res.error) {
        setDbError(res.error);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setDbError(msg);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  // Dynamic metrics refresh helper matching requested signature
  const loadDashboardMetrics = async (_clientId?: string) => {
    await loadData(false);
  };

  const loadGoogleReviews = async () => {
    if (!business) return;
    setGoogleLoading(true);
    setGoogleError(null);
    setGoogleErrorCode(undefined);

    try {
      const res = await fetchGooglePlaceReviews({
        businessId: business.id,
        placeId: business.place_id,
        googleReviewUrl: business.google_review_url,
      });

      if (res.error) {
        setGoogleError(res.error);
        setGoogleErrorCode(res.code);
        setGooglePlaceData(null);
      } else {
        setGooglePlaceData(res.data);
        setGoogleError(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setGoogleError(msg);
      setGooglePlaceData(null);
    } finally {
      setGoogleLoading(false);
    }
  };

  // Fetch all registered businesses for multi-client switching
  useEffect(() => {
    let isMounted = true;
    fetchAllBusinesses().then((res) => {
      if (isMounted && res.businesses && res.businesses.length > 0) {
        setAvailableBusinesses(res.businesses);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Realtime Listener: Automatically listen to reviews_and_feedback and qr_events
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !business) return;

    const currentBizName = business.name || (business as any).business_name || '';
    const currentBizId = business.id;

    // Load initial data
    loadData(true);

    const channel = supabase
      .channel(`owner-feedback-channel-${business.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reviews_and_feedback' },
        (payload) => {
          console.log('Realtime reviews_and_feedback update:', payload);
          const newRow = payload.new as any;
          const matchesThisBiz = !newRow || matchFeedbackToBusiness(newRow, business);

          if (matchesThisBiz) {
            const starText = newRow?.rating ? `${newRow.rating}★` : newRow?.action_type || 'feedback';
            setLiveFeedbackNotice({
              message: `New feedback received for ${currentBizName}! (${starText})`,
              rating: newRow?.rating || 5,
              time: new Date().toLocaleTimeString(),
            });
            setTimeout(() => setLiveFeedbackNotice(null), 6000);
            loadData(false);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'qr_events' },
        (payload) => {
          const newRow = payload.new as any;
          if (!newRow || newRow.business_id === currentBizId) {
            loadData(false);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeActive(true);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [business?.id, business?.name]);

  useEffect(() => {
    loadData();
    // Auto-fetch Google reviews if business has place_id or google_review_url
    if (business) {
      loadGoogleReviews();
    }
  }, [business?.id, business?.place_id]);

  if (!business) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-xs space-y-3">
        <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-lg">
          🏪
        </div>
        <h2 className="text-base font-bold text-slate-900">No Client Selected</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Your Supabase database does not have any client records registered yet. Open the Founder Admin Console to add your first client.
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

  const handleUpdateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    setSavingResolution(true);
    try {
      await updateComplaintStatus(selectedComplaint.id, newStatus, managerNotes);
      setSelectedComplaint(null);
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingResolution(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!stats) return;
    const currentMonthName = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    generateMonthlyPDFReport(business, stats, complaintsList, feedbackList, currentMonthName);
  };

  return (
    <div className="space-y-6">
      {/* Realtime Live Update Toast */}
      {liveFeedbackNotice && (
        <div className="p-3.5 bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-between shadow-md transition-all animate-fade-in">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
            <span>{liveFeedbackNotice.message}</span>
            <span className="text-emerald-100 font-normal">
              ({liveFeedbackNotice.time}) — Realtime listener updated Total Ratings & Average Rating automatically!
            </span>
          </div>
          <button
            onClick={() => setLiveFeedbackNotice(null)}
            className="text-white hover:text-emerald-100 font-bold px-2 py-0.5 rounded text-sm cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Top Banner / Client Info */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">{business.name}</h1>
            <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded border border-slate-200">
              /r/{business.slug}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded font-medium border ${
                isLiveSupabase
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {isLiveSupabase ? 'Live Supabase' : 'Sandbox Storage'}
            </span>
            {realtimeActive && (
              <span className="flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded font-medium border bg-emerald-50 text-emerald-800 border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Realtime Active
              </span>
            )}
            {availableBusinesses.length > 1 && onSelectBusiness && (
              <div className="flex items-center gap-1.5 ml-1">
                <label htmlFor="owner-client-select" className="text-xs text-slate-500 font-medium">
                  Client:
                </label>
                <select
                  id="owner-client-select"
                  value={business.id}
                  onChange={(e) => {
                    const sel = availableBusinesses.find((b) => b.id === e.target.value);
                    if (sel) onSelectBusiness(sel);
                  }}
                  className="text-xs bg-slate-50 border border-slate-300 rounded-md px-2 py-1 text-slate-800 font-semibold focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs"
                >
                  {availableBusinesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.slug})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {business.address || (business.category === 'Restaurant' ? 'Table Standee Management' : `${business.category || 'Client'} Standee Management`)} · Google Reviews URL:{' '}
            <a
              href={business.google_review_url}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline font-mono"
            >
              Configured
            </a>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadDashboardMetrics(business.slug || business.id)}
            className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors shadow-xs cursor-pointer"
            title="Fetch live Supabase metrics"
          >
            ↻ Live Metrics
          </button>
          <button
            onClick={onNavigateToGuestQR}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors shadow-xs"
          >
            Simulate Guest QR
          </button>
          <button
            onClick={onNavigateToStudio}
            className="px-3.5 py-2 text-xs font-semibold text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors shadow-xs"
          >
            Standee QR Studio
          </button>
          <button
            onClick={handleDownloadPDF}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs"
          >
            Download Monthly PDF
          </button>
        </div>
      </div>

      {loading || !stats ? (
        <div className="p-12 text-center text-xs text-slate-500">Loading client analytics...</div>
      ) : (
        <>
          {/* Key Metric Cards (KPI Grid) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* 1. Total QR Scans */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Total QR Scans</span>
                {realtimeActive ? (
                  <span className="flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                ) : !isLiveSupabase ? (
                  <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">
                    Demo
                  </span>
                ) : null}
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {(totalScans || stats.totalScans || 0).toLocaleString()}
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block truncate">
                {isLiveSupabase ? 'From qr_events' : 'Scan events'}
              </span>
            </div>

            {/* 2. Total Ratings */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Total Ratings</span>
                {realtimeActive && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                )}
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {stats.totalRatings.toLocaleString()}
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block truncate">Rated reviews</span>
            </div>

            {/* 3. Average Rating */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Average Rating</span>
                {realtimeActive && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                )}
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-amber-600 mt-1 flex items-baseline gap-1">
                <span>{avgRating || (stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '—')}</span>
                <span className="text-xs text-slate-400">/ 5.0</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block truncate">Valid ratings only</span>
            </div>

            {/* 4. Total Submissions */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Total Submissions</span>
                <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 font-mono">
                  reviews_and_feedback
                </span>
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-blue-600 mt-1">
                {(stats.totalSubmissions ?? feedbackRecords.length).toLocaleString()}
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block truncate">All client records</span>
            </div>

            {/* 5. Google Reviews (4-5★) */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Google (4-5★)</span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                  Promoted
                </span>
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 mt-1">
                {stats.positiveFeedbackCount}
              </div>
              <span className="text-[11px] text-emerald-700 mt-0.5 block font-medium truncate">
                Routed to Google
              </span>
            </div>

            {/* 6. Intercepted (1-3★) */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Intercepted (1-3★)</span>
                <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                  Private
                </span>
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-rose-600 mt-1">
                {stats.negativeFeedbackCount}
              </div>
              <span className="text-[11px] text-rose-700 mt-0.5 block font-medium truncate">
                Protected privately
              </span>
            </div>
          </div>

          {/* Database Relationship Insight Notice */}
          {!hasBusinessIdColumn && showSqlNotice && (
            <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-950 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-blue-900">
                  <span>ℹ️</span>
                  <span>Database Relationship Note (public.reviews_and_feedback)</span>
                </div>
                <button
                  onClick={() => setShowSqlNotice(false)}
                  className="text-blue-500 hover:text-blue-800 text-sm font-bold cursor-pointer"
                  title="Dismiss notice"
                >
                  ×
                </button>
              </div>
              <p className="text-[11px] text-blue-800 leading-relaxed">
                Feedback records are currently filtered accurately using case-insensitive matching for <strong>"{business.name}"</strong> ({feedbackRecords.length} records verified). To establish a strict relational UUID foreign key constraint and index for all clients, run:
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <pre className="flex-1 bg-white p-2 rounded border border-blue-200 font-mono text-[10px] text-slate-800 overflow-x-auto select-all whitespace-pre-wrap">
{`ALTER TABLE public.reviews_and_feedback ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
UPDATE public.reviews_and_feedback r SET business_id = b.id FROM public.businesses b WHERE r.business_id IS NULL AND (LOWER(TRIM(r.restaurant_name)) = LOWER(TRIM(b.name)) OR LOWER(TRIM(r.restaurant_name)) = LOWER(TRIM(b.slug)) OR LOWER(TRIM(r.restaurant_name)) = LOWER(REPLACE(b.slug, '-', ' ')));
CREATE INDEX IF NOT EXISTS idx_reviews_feedback_business_id ON public.reviews_and_feedback(business_id);`}
                </pre>
                <button
                  type="button"
                  onClick={() => {
                    const sql = `ALTER TABLE public.reviews_and_feedback ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;\nUPDATE public.reviews_and_feedback r SET business_id = b.id FROM public.businesses b WHERE r.business_id IS NULL AND (LOWER(TRIM(r.restaurant_name)) = LOWER(TRIM(b.name)) OR LOWER(TRIM(r.restaurant_name)) = LOWER(TRIM(b.slug)) OR LOWER(TRIM(r.restaurant_name)) = LOWER(REPLACE(b.slug, '-', ' ')));\nCREATE INDEX IF NOT EXISTS idx_reviews_feedback_business_id ON public.reviews_and_feedback(business_id);`;
                    navigator.clipboard.writeText(sql);
                    setCopiedSql(true);
                    setTimeout(() => setCopiedSql(false), 2500);
                  }}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs whitespace-nowrap cursor-pointer shrink-0"
                >
                  {copiedSql ? '✓ Copied SQL!' : 'Copy SQL'}
                </button>
              </div>
            </div>
          )}

          {/* Database Error Banner if any */}
          {dbError && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>⚠️</span>
                <span>Database Notice: {dbError}</span>
              </div>
              <button onClick={() => loadData(true)} className="underline font-semibold hover:text-amber-950">
                Retry Query
              </button>
            </div>
          )}

          {/* Rating Breakdown & Interception Mechanics */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Rating distribution bar (7 cols) */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Sentiment Distribution</h2>
                <span className="text-xs text-slate-500 font-mono">
                  {stats.totalRatings} Total submissions
                </span>
              </div>

              <div className="space-y-2.5">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = stats.ratingsBreakdown[star] || 0;
                  const total = stats.totalRatings || 1;
                  const pct = Math.round((count / total) * 100);
                  const isPositive = star >= 4;

                  return (
                    <div key={star} className="flex items-center gap-3 text-xs">
                      <span className="w-12 text-slate-600 font-medium">{star} Stars</span>
                      <div className="flex-1 bg-slate-100 h-3 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isPositive ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-16 text-right font-mono text-slate-700 tabular-nums">
                        {count} ({pct}%)
                      </span>
                      <span
                        className={`text-[10px] w-28 text-right font-medium ${
                          isPositive ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {isPositive ? '→ Google Reviews' : '→ Intercepted'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Smart Routing Insight Box (5 cols) */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
              <h2 className="text-sm font-bold text-slate-900">Smart Review Routing</h2>
              <div className="space-y-2 text-xs text-slate-600">
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                  <div className="font-semibold text-emerald-900">Positive Flow (4-5 Stars)</div>
                  <p className="text-emerald-800 text-[11px] mt-0.5">
                    Happy diners are congratulated and given a 1-click button to copy their review directly to your public Google Business profile.
                  </p>
                </div>

                <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg">
                  <div className="font-semibold text-rose-900">Damage Control Flow (1-3 Stars)</div>
                  <p className="text-rose-800 text-[11px] mt-0.5">
                    Unhappy guests are routed to a private management resolution box. Their complaint is kept off Google so your public star rating stays high!
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Tabs */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="flex border-b border-slate-200 px-6 pt-3 bg-slate-50/50">
              <button
                onClick={() => setActiveTab('feedback')}
                className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'feedback'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <span>Recent Customer Feedback</span>
                <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded font-mono">
                  {feedbackRecords.length}
                </span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('google_reviews');
                  if (!googlePlaceData && !googleLoading) {
                    loadGoogleReviews();
                  }
                }}
                className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'google_reviews'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <span>Google Reviews</span>
                <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded">
                  Live API
                </span>
              </button>
              <button
                onClick={() => setActiveTab('complaints')}
                className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                  activeTab === 'complaints'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Private Issues Inbox ({complaintsList.length})
              </button>
              <button
                onClick={() => setActiveTab('reports')}
                className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                  activeTab === 'reports'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Monthly Report Preview
              </button>
            </div>

            {/* Tab 1: Recent Customer Feedback (Live Supabase public.reviews_and_feedback) */}
            {activeTab === 'feedback' && (
              <div className="space-y-0">
                {/* Section Controls Bar */}
                <div className="px-6 py-3 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">
                      Live Customer Submissions:
                    </span>
                    <span className="font-mono text-slate-500 text-[11px]">
                      {business.name} ({feedbackRecords.length} records in public.reviews_and_feedback)
                    </span>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {/* Privacy Mask Toggle for Mobile Numbers */}
                    <button
                      type="button"
                      onClick={() => setShowMobileNumbers(!showMobileNumbers)}
                      className="px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
                      title={showMobileNumbers ? 'Mask customer contact numbers' : 'Reveal full customer contact numbers'}
                    >
                      <span>{showMobileNumbers ? '👁️' : '🔒'}</span>
                      <span>{showMobileNumbers ? 'Mask Phones' : 'Show Phones'}</span>
                    </button>

                    {/* View All / Paginated Toggle */}
                    <button
                      type="button"
                      onClick={() => {
                        setViewAllFeedback(!viewAllFeedback);
                        setCurrentPage(1);
                      }}
                      className="px-2.5 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                      {viewAllFeedback ? 'Show Paginated (5/page)' : `View All (${feedbackRecords.length})`}
                    </button>
                  </div>
                </div>

                {/* Submissions List */}
                {feedbackRecords.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-500 space-y-2">
                    <div className="text-2xl">💬</div>
                    <div className="font-semibold text-slate-800">No customer feedback records found yet</div>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      Scan the QR code or use the Simulator to submit the first feedback for {business.name}.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {(viewAllFeedback
                      ? feedbackRecords
                      : feedbackRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize)
                    ).map((rec) => {
                      const hasRating = typeof rec.rating === 'number' && !isNaN(rec.rating) && rec.rating !== null && rec.rating > 0;
                      const customerDisplayName = rec.customer_name?.trim() ? rec.customer_name.trim() : 'Anonymous';
                      const formattedTime = new Date(rec.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      // Phone privacy logic
                      const rawPhone = rec.mobile_number?.trim();
                      let displayPhone = 'Not provided';
                      if (rawPhone) {
                        if (showMobileNumbers) {
                          displayPhone = rawPhone;
                        } else {
                          displayPhone = rawPhone.length > 4 ? `••••••${rawPhone.slice(-4)}` : '••••';
                        }
                      }

                      // Action Type badge styling
                      const actionType = rec.action_type || (hasRating && rec.rating! >= 4 ? 'positive_google' : 'feedback');
                      const isPositiveAction = actionType.includes('positive') || actionType.includes('google') || (hasRating && rec.rating! >= 4);
                      const isComplaintAction = actionType.includes('complaint') || actionType.includes('intercept') || (hasRating && rec.rating! < 4);

                      return (
                        <div
                          key={rec.id}
                          className="p-5 hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row md:items-start md:justify-between gap-3 text-xs"
                        >
                          <div className="space-y-2 flex-1">
                            {/* Header row: Rating, Customer Name, Action Type */}
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Rating display */}
                              {hasRating ? (
                                <span
                                  className={`font-bold font-mono tracking-wide ${
                                    rec.rating! >= 4 ? 'text-amber-500' : 'text-rose-500'
                                  }`}
                                  title={`${rec.rating} out of 5 stars`}
                                >
                                  {'★'.repeat(Math.round(rec.rating!))}
                                  {'☆'.repeat(5 - Math.round(rec.rating!))}
                                  <span className="ml-1 text-slate-700 font-semibold text-xs">
                                    {rec.rating}★
                                  </span>
                                </span>
                              ) : (
                                <span className="text-[11px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                  Rating: Not provided
                                </span>
                              )}

                              {/* Customer Name */}
                              <span className="font-bold text-slate-900">
                                {customerDisplayName}
                              </span>

                              {/* Action Type Badge */}
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${
                                  isPositiveAction
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : isComplaintAction
                                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                    : 'bg-blue-50 text-blue-800 border border-blue-200'
                                }`}
                              >
                                {actionType}
                              </span>
                            </div>

                            {/* Written Feedback Text */}
                            <div className="text-slate-800 text-xs leading-relaxed">
                              {rec.feedback_text?.trim() ? (
                                <p className="italic text-slate-700 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                                  &ldquo;{rec.feedback_text.trim()}&rdquo;
                                </p>
                              ) : (
                                <span className="text-slate-400 italic">No written feedback</span>
                              )}
                            </div>

                            {/* Contact & Meta footer */}
                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                              <span className="flex items-center gap-1">
                                <span className="text-slate-400 font-medium">Mobile:</span>
                                <span className={rawPhone ? 'font-mono font-medium text-slate-700' : 'text-slate-400'}>
                                  {displayPhone}
                                </span>
                              </span>
                              {rec.restaurant_name && (
                                <span className="flex items-center gap-1 text-slate-400">
                                  <span>•</span>
                                  <span>Client: <strong className="text-slate-600 font-normal">{rec.restaurant_name}</strong></span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Timestamp */}
                          <div className="text-[11px] font-mono text-slate-400 shrink-0 self-start md:text-right">
                            {formattedTime}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Pagination Controls */}
                {!viewAllFeedback && feedbackRecords.length > pageSize && (
                  <div className="px-6 py-3 bg-slate-50/70 border-t border-slate-200 flex items-center justify-between text-xs">
                    <span className="text-slate-500 text-[11px]">
                      Showing {(currentPage - 1) * pageSize + 1} to{' '}
                      {Math.min(currentPage * pageSize, feedbackRecords.length)} of {feedbackRecords.length} submissions
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                      >
                        ← Prev
                      </button>
                      <span className="px-2 py-1 text-xs font-semibold text-slate-600 font-mono">
                        Page {currentPage} of {Math.ceil(feedbackRecords.length / pageSize) || 1}
                      </span>
                      <button
                        type="button"
                        disabled={currentPage >= Math.ceil(feedbackRecords.length / pageSize)}
                        onClick={() => setCurrentPage((p) => p + 1)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Google Reviews (Google Places API New) */}
            {activeTab === 'google_reviews' && (
              <div className="p-6 space-y-6">
                {/* Header Sub-bar */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                        G
                      </div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Public Google Reviews (Places API New)
                      </h3>
                      <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                        {googlePlaceData?.placeId || business.place_id || 'No place_id'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Live public customer reviews fetched directly from Google Places API via secure Supabase Edge Function.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={loadGoogleReviews}
                      disabled={googleLoading}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      {googleLoading ? (
                        <>
                          <div className="inline-block animate-spin rounded-full h-3 w-3 border-2 border-blue-600 border-t-transparent" />
                          <span>Fetching...</span>
                        </>
                      ) : (
                        <>
                          <span>↻</span>
                          <span>Refresh from Google</span>
                        </>
                      )}
                    </button>
                    {business.google_review_url && (
                      <a
                        href={business.google_review_url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        Open on Google Maps ↗
                      </a>
                    )}
                  </div>
                </div>

                {/* Honest Attribution / Notice Banner */}
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-900 text-xs flex items-start gap-2.5">
                  <span className="text-base shrink-0">ℹ️</span>
                  <div className="text-[11px] leading-relaxed">
                    <strong>Direct Public Google Data:</strong> These reviews are retrieved directly from Google Places API (New). Google's API returns up to 5 of the most helpful public reviews. This feed is distinct from internal ratings collected via your physical HeReview standees.
                  </div>
                </div>

                {/* Loading State */}
                {googleLoading && (
                  <div className="p-12 text-center space-y-3">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-blue-600 border-t-transparent" />
                    <div className="text-xs font-semibold text-slate-700">Connecting to Google Places API...</div>
                    <p className="text-[11px] text-slate-400">
                      Querying Supabase Edge Function with place_id: {business.place_id || 'extracting from URL'}
                    </p>
                  </div>
                )}

                {/* Error State */}
                {!googleLoading && googleError && (
                  <div className="p-5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">⚠️</span>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900">
                        Failed to Load Google Reviews
                      </h4>
                    </div>
                    <p className="text-xs font-mono bg-rose-100/60 p-2.5 rounded border border-rose-200 break-words">
                      {googleError}
                    </p>

                    {googleErrorCode === 'MISSING_PLACE_ID' && (
                      <div className="text-xs text-rose-800 space-y-1">
                        <p className="font-semibold">How to resolve:</p>
                        <p>1. Open the Supabase Table Editor → <code>businesses</code> table.</p>
                        <p>2. Set the <code>place_id</code> column for this business (e.g. <code>ChIJ...</code>).</p>
                        <p>3. Or configure a direct Google Review URL containing <code>placeid=...</code>.</p>
                      </div>
                    )}

                    {googleErrorCode === 'FUNCTION_NOT_DEPLOYED' && (
                      <div className="text-xs text-rose-800 space-y-1.5 pt-1">
                        <p className="font-semibold">Supabase Edge Function Deployment Required:</p>
                        <p className="text-[11px]">The Edge Function <code>get-google-reviews</code> has been written in <code>/supabase/functions/get-google-reviews/index.ts</code>. To deploy it to your Supabase project, run the following in your terminal:</p>
                        <pre className="bg-rose-900/10 p-2 rounded text-[11px] font-mono text-rose-950">
                          supabase functions deploy get-google-reviews
                        </pre>
                        <pre className="bg-rose-900/10 p-2 rounded text-[11px] font-mono text-rose-950">
                          supabase secrets set GOOGLE_PLACES_API_KEY="your_api_key_here"
                        </pre>
                      </div>
                    )}

                    {googleErrorCode === 'MISSING_SERVER_SECRET' && (
                      <div className="text-xs text-rose-800 space-y-1.5 pt-1">
                        <p className="font-semibold">Missing Google Places Secret:</p>
                        <p className="text-[11px]">Set your restricted Google Places API key in Supabase Secrets:</p>
                        <pre className="bg-rose-900/10 p-2 rounded text-[11px] font-mono text-rose-950">
                          supabase secrets set GOOGLE_PLACES_API_KEY="your_api_key_here"
                        </pre>
                      </div>
                    )}

                    <div className="pt-2">
                      <button
                        onClick={loadGoogleReviews}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-lg transition-colors cursor-pointer"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                )}

                {/* Success Data View */}
                {!googleLoading && !googleError && googlePlaceData && (
                  <div className="space-y-6">
                    {/* Overall Google Score Banner */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                          Overall Google Rating
                        </span>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-3xl font-extrabold text-amber-500 font-mono">
                            {googlePlaceData.rating ? googlePlaceData.rating.toFixed(1) : '—'}
                          </span>
                          <span className="text-amber-500 text-base">
                            {'★'.repeat(Math.round(googlePlaceData.rating || 0))}
                            {'☆'.repeat(Math.max(0, 5 - Math.round(googlePlaceData.rating || 0)))}
                          </span>
                          <span className="text-xs text-slate-400">/ 5.0</span>
                        </div>
                        <span className="text-[11px] text-slate-500 mt-1 block">
                          Calculated across all public Google ratings
                        </span>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                          Total Public Reviews
                        </span>
                        <div className="text-3xl font-extrabold text-slate-900 font-mono mt-1">
                          {(googlePlaceData.userRatingCount || 0).toLocaleString()}
                        </div>
                        <span className="text-[11px] text-slate-500 mt-1 block">
                          Total reviews registered on Google
                        </span>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                          Google Place Name
                        </span>
                        <div className="text-sm font-bold text-slate-900 mt-1 truncate">
                          {googlePlaceData.displayName || business.name}
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono truncate block mt-1">
                          {googlePlaceData.placeId}
                        </span>
                      </div>
                    </div>

                    {/* Review Cards */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          Returned Public Reviews ({googlePlaceData.reviews.length})
                        </h4>
                        <span className="text-[11px] text-slate-400">
                          Sorted by Google's relevance ranking
                        </span>
                      </div>

                      {googlePlaceData.reviews.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                          No written reviews were returned by Google Places API for this location.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3">
                          {googlePlaceData.reviews.map((rev) => (
                            <div
                              key={rev.id}
                              className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-slate-300 transition-colors space-y-2"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  {rev.authorPhotoUrl ? (
                                    <img
                                      src={rev.authorPhotoUrl}
                                      alt={rev.authorName}
                                      className="w-8 h-8 rounded-full object-cover border border-slate-200"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                                      {rev.authorName ? rev.authorName.charAt(0).toUpperCase() : 'G'}
                                    </div>
                                  )}
                                  <div>
                                    <div className="flex items-center gap-2">
                                      {rev.authorUri ? (
                                        <a
                                          href={rev.authorUri}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-xs font-bold text-slate-900 hover:text-blue-600 hover:underline"
                                        >
                                          {rev.authorName}
                                        </a>
                                      ) : (
                                        <span className="text-xs font-bold text-slate-900">
                                          {rev.authorName}
                                        </span>
                                      )}
                                      <span className="text-[10px] text-slate-400 font-medium">
                                        on Google
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="text-amber-500 font-bold text-xs tracking-tight">
                                        {'★'.repeat(rev.rating)}
                                        {'☆'.repeat(5 - rev.rating)}
                                      </span>
                                      <span className="text-[11px] text-slate-400">
                                        {rev.relativePublishTimeDescription ||
                                          (rev.publishTime
                                            ? new Date(rev.publishTime).toLocaleDateString()
                                            : '')}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {rev.text ? (
                                <p className="text-xs text-slate-700 leading-relaxed font-normal pt-1">
                                  "{rev.text}"
                                </p>
                              ) : (
                                <p className="text-xs text-slate-400 italic pt-1">
                                  (Rating submitted without text comment)
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Complaints & Private Issues */}
            {activeTab === 'complaints' && (
              <div className="divide-y divide-slate-100 overflow-x-auto">
                {complaintsList.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No private complaints. All customer sentiment is positive!
                  </div>
                ) : (
                  complaintsList.map((c) => (
                    <div key={c.id} className="p-4 hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                            {c.category}
                          </span>
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide ${
                              c.status === 'resolved'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : c.status === 'investigating'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-rose-50 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {c.status}
                          </span>
                          {c.table_number && (
                            <span className="text-[11px] font-mono text-slate-500">
                              Table #{c.table_number}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-800 leading-relaxed font-medium">
                          {c.message}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                          {c.customer_name && <span>Customer: {c.customer_name}</span>}
                          {c.customer_phone && <span>Phone: {c.customer_phone}</span>}
                          {c.customer_email && <span>Email: {c.customer_email}</span>}
                        </div>

                        {c.manager_notes && (
                          <div className="p-2.5 bg-blue-50/60 border border-blue-100 rounded-lg text-xs text-blue-900 space-y-0.5 mt-2">
                            <span className="font-semibold text-[10px] uppercase tracking-wide text-blue-700">Manager Resolution Notes:</span>
                            <p>{c.manager_notes}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex md:flex-col items-center md:items-end justify-between gap-2 shrink-0">
                        <span className="text-[11px] font-mono text-slate-400">
                          {new Date(c.created_at).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <button
                          onClick={() => {
                            setSelectedComplaint(c);
                            setNewStatus(c.status);
                            setManagerNotes(c.manager_notes || '');
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md transition-colors"
                        >
                          Resolve Issue
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 3: Monthly Report Preview */}
            {activeTab === 'reports' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Monthly Performance Report</h3>
                    <p className="text-xs text-slate-500">
                      Standard monthly summary of QR scans, review conversions, and intercepted negative reviews.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadPDF}
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs"
                  >
                    Download Official PDF
                  </button>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3 font-mono text-xs">
                  <div className="flex justify-between border-b border-slate-200 pb-2 font-sans font-bold">
                    <span>{business.name} — Monthly Report</span>
                    <span>{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
                    <div>
                      <div className="text-slate-400 text-[11px]">Total QR Scans</div>
                      <div className="text-lg font-bold text-slate-900">{stats.totalScans}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[11px]">Ratings Submitted</div>
                      <div className="text-lg font-bold text-slate-900">{stats.totalRatings}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[11px]">Average Score</div>
                      <div className="text-lg font-bold text-amber-600">{stats.averageRating.toFixed(1)} / 5.0</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[11px]">Negative Intercepted</div>
                      <div className="text-lg font-bold text-rose-600">{stats.negativeFeedbackCount}</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 pt-2 font-sans">
                    Click "Download Official PDF" above to generate a client-ready, printable PDF formatted with high-resolution layout and staff training recommendations.
                  </p>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Complaint Resolution Modal */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Resolve Customer Incident</h3>
              <button
                onClick={() => setSelectedComplaint(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <div className="text-xs bg-slate-50 p-3 rounded-lg text-slate-700">
              <div className="font-semibold text-slate-900 mb-1">{selectedComplaint.category} Issue:</div>
              <p className="italic">"{selectedComplaint.message}"</p>
              {selectedComplaint.customer_name && (
                <div className="mt-2 text-[11px] text-slate-500">
                  Guest: {selectedComplaint.customer_name} ({selectedComplaint.customer_phone || selectedComplaint.customer_email || 'No contact'})
                </div>
              )}
            </div>

            <form onSubmit={handleUpdateComplaint} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="new">New (Unresolved)</option>
                  <option value="investigating">Investigating / In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Manager Resolution Notes
                </label>
                <textarea
                  rows={3}
                  value={managerNotes}
                  onChange={(e) => setManagerNotes(e.target.value)}
                  placeholder="e.g. Called guest, replaced meal, issued $20 dining credit..."
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedComplaint(null)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingResolution}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {savingResolution ? 'Saving...' : 'Save Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
