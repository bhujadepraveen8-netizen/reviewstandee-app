import React, { useState, useEffect } from 'react';
import { Business, Subscription, ReviewFeedbackRecord } from '../types';
import {
  fetchAllBusinesses,
  fetchPlatformTelemetry,
  fetchBusinessFeedbackCounts,
  matchFeedbackToBusiness,
  createBusiness,
  updateBusinessStatus,
  checkBusinessDependencies,
  deleteBusiness,
  deleteBusinessPermanently,
  BusinessDependencyInspection,
  PlatformTelemetry,
  MissingColumnDetail,
} from '../lib/dataService';
import { useAuth } from '../lib/AuthContext';
import { getSupabase } from '../lib/supabaseClient';

interface FounderAdminDashboardProps {
  onSelectBusiness: (business: Business) => void;
  onOpenGuestQR: (slug: string) => void;
  onOpenAuth?: () => void;
}

export const FounderAdminDashboard: React.FC<FounderAdminDashboardProps> = ({
  onSelectBusiness,
  onOpenGuestQR,
  onOpenAuth,
}) => {
  const { user, profile } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [telemetry, setTelemetry] = useState<PlatformTelemetry>({
    totalScans: 0,
    totalRatings: 0,
    totalComplaints: 0,
    subscriptions: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isLiveSupabase, setIsLiveSupabase] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [liveNotice, setLiveNotice] = useState<string | null>(null);
  const [realtimeActive, setRealtimeActive] = useState(false);

  // Business-wise customer feedback submissions state
  const [feedbackCounts, setFeedbackCounts] = useState<{
    byBusinessId: Record<string, number>;
    byRestaurantName: Record<string, number>;
    allRecords: ReviewFeedbackRecord[];
  }>({ byBusinessId: {}, byRestaurantName: {}, allRecords: [] });

  // Scoped feedback inspection modal for authorized founder (strictly tenant-isolated)
  const [inspectModalBusiness, setInspectModalBusiness] = useState<Business | null>(null);
  const [inspectModalRecords, setInspectModalRecords] = useState<ReviewFeedbackRecord[]>([]);

  const handleOpenInspectFeedback = (b: Business) => {
    setInspectModalBusiness(b);
    const filtered = (feedbackCounts.allRecords || []).filter((rec) => matchFeedbackToBusiness(rec, b));
    setInspectModalRecords(filtered);
  };

  const [debugInfo, setDebugInfo] = useState<{
    queryExecuted: string;
    rowCount: number;
    rawResponse: any;
    httpStatus?: number;
    currentUserEmail: string | null;
    currentUserId: string | null;
  } | null>(null);

  const [showDebug, setShowDebug] = useState(false);

  const CATEGORY_OPTIONS = [
    'Restaurant',
    'Temple/Religious Place',
    'Salon',
    'Gym',
    'Clinic',
    'Retail Shop',
    'Hotel',
    'School',
    'Custom',
  ] as const;

  // New client modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newCategory, setNewCategory] = useState<string>('Restaurant');
  const [customBusinessType, setCustomBusinessType] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newReviewUrl, setNewReviewUrl] = useState('');
  const [newPlaceId, setNewPlaceId] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newLogoUrl, setNewLogoUrl] = useState('');
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createMissingColumns, setCreateMissingColumns] = useState<MissingColumnDetail[] | null>(null);
  const [copyMigrationSuccess, setCopyMigrationSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Business lifecycle action states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Delete modal state
  const [deleteModalBusiness, setDeleteModalBusiness] = useState<Business | null>(null);
  const [dependencyInspection, setDependencyInspection] = useState<BusinessDependencyInspection | null>(null);
  const [inspectingDependencies, setInspectingDependencies] = useState(false);
  const [deleteConfirmChecked, setDeleteConfirmChecked] = useState(false);
  const [deletingBusiness, setDeletingBusiness] = useState(false);
  const [deleteResultError, setDeleteResultError] = useState<{
    error: string;
    errorCode?: string;
    errorDetails?: string;
    rlsBlocked?: boolean;
    requiredSql?: string;
  } | null>(null);
  const [copiedDeleteFixSql, setCopiedDeleteFixSql] = useState(false);

  const handleToggleActive = async (business: Business) => {
    setActionError(null);
    setSuccessMessage(null);

    // Founder authentication check
    if (!user) {
      setActionError('Authentication required: You must be signed in with a Supabase Founder Admin account to activate or deactivate businesses.');
      return;
    }

    const nextState = !business.is_active;
    setActionLoadingId(business.id);

    try {
      const res = await updateBusinessStatus(business.id, nextState);
      if (res.error) {
        setActionError(`Failed to update status for ${business.name}: ${res.error}`);
      } else {
        setSuccessMessage(`Successfully ${nextState ? 'activated' : 'deactivated'} client "${business.name}".`);
        await loadData(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenDeleteModal = async (business: Business) => {
    setActionError(null);
    setSuccessMessage(null);
    setDeleteResultError(null);
    setCopiedDeleteFixSql(false);

    if (!user) {
      setActionError('Authentication required: You must be signed in with a Supabase Founder Admin account to delete a business.');
      return;
    }

    setDeleteModalBusiness(business);
    setDeleteConfirmChecked(false);
    setInspectingDependencies(true);
    setDependencyInspection(null);

    try {
      const inspection = await checkBusinessDependencies(business.id);
      setDependencyInspection(inspection);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(msg);
      setDeleteResultError({ error: msg, errorCode: 'INSPECTION_FAILED' });
    } finally {
      setInspectingDependencies(false);
    }
  };

  const handleConfirmPermanentDelete = async () => {
    if (!deleteModalBusiness) return;

    setDeletingBusiness(true);
    setActionError(null);
    setDeleteResultError(null);

    try {
      const res = await deleteBusinessPermanently(deleteModalBusiness.id, {
        cleanExclusiveRecords: true,
      });

      if (!res.success || res.error) {
        const errObj = {
          error: res.error || 'Database deletion failed: Supabase did not delete the business record.',
          errorCode: res.errorCode,
          errorDetails: res.errorDetails,
          rlsBlocked: res.rlsBlocked,
          requiredSql: res.requiredSql,
        };
        setDeleteResultError(errObj);
        setActionError(`Database Delete Failed: ${res.error}`);
      } else {
        const methodNote = res.details?.serverMethod === 'rpc_transaction' ? ' (via database transaction)' : '';
        setSuccessMessage(`Successfully deleted client "${deleteModalBusiness.name}" from Supabase database${methodNote}.`);
        setDeleteModalBusiness(null);
        setDeleteResultError(null);
        await loadData(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setDeleteResultError({ error: msg, errorCode: 'EXCEPTION' });
      setActionError(`Database Delete Exception: ${msg}`);
    } finally {
      setDeletingBusiness(false);
    }
  };

  const handleDeactivateInsteadFromModal = async () => {
    if (!deleteModalBusiness) return;
    const biz = deleteModalBusiness;
    setDeleteModalBusiness(null);
    setActionLoadingId(biz.id);

    try {
      const res = await updateBusinessStatus(biz.id, false);
      if (res.error) {
        setActionError(res.error);
      } else {
        setSuccessMessage(`Successfully deactivated "${biz.name}". All feedback, complaints, and QR records remain safe.`);
        await loadData(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionError(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setFetchError(null);

    try {
      const [bizResult, telemetryResult, countsResult] = await Promise.all([
        fetchAllBusinesses(),
        fetchPlatformTelemetry(),
        fetchBusinessFeedbackCounts(),
      ]);

      setDebugInfo(bizResult.debugInfo);

      if (bizResult.error) {
        setFetchError(bizResult.error);
        setBusinesses([]);
        setIsLiveSupabase(false);
      } else {
        setBusinesses(bizResult.businesses);
        setIsLiveSupabase(bizResult.isLiveSupabase);
        setTelemetry(telemetryResult);
        setFeedbackCounts(countsResult);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFetchError(msg);
      setBusinesses([]);
      setIsLiveSupabase(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id, profile?.role]);

  // Realtime listener for Founder Admin Console:
  // Auto-refresh platform telemetry and client lists when feedback or businesses change
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    const channel = supabase
      .channel('founder-admin-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'feedback' },
        (payload) => {
          console.log('Naya feedback aya hai (Founder Admin):', payload.new);
          const r = payload.new?.rating || 5;
          setLiveNotice(`Live Realtime: Naya feedback Supabase me record hua (${r}★)`);
          setTimeout(() => setLiveNotice(null), 6000);
          loadData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reviews_and_feedback' },
        (payload) => {
          console.log('Naya review record aya hai (Founder Admin):', payload.new);
          const r = payload.new?.rating || 5;
          setLiveNotice(`Live Realtime: Naya review Supabase me record hua (${r}★)`);
          setTimeout(() => setLiveNotice(null), 6000);
          loadData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'businesses' },
        (payload) => {
          console.log('Business record change detected (Founder Admin):', payload);
          loadData(true);
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
  }, []);

  const handleNameChange = (val: string) => {
    setNewName(val);
    setNewSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
  };

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateMissingColumns(null);

    if (!newName.trim()) {
      setCreateError('Please enter a client or business name.');
      return;
    }
    if (!newSlug.trim()) {
      setCreateError('Please enter a valid unique slug.');
      return;
    }
    if (!newCategory.trim() || !CATEGORY_OPTIONS.includes(newCategory as any)) {
      setCreateError('Please select a valid business category.');
      return;
    }
    if (newCategory === 'Custom' && !customBusinessType.trim()) {
      setCreateError('Please enter a business type for Custom.');
      return;
    }
    if (!newReviewUrl.trim()) {
      setCreateError('Please enter a Google Reviews URL.');
      return;
    }

    const resolvedCategory = newCategory === 'Custom' ? customBusinessType.trim() : newCategory.trim();

    setSavingBusiness(true);

    try {
      const result = await createBusiness({
        owner_id: user?.id || '',
        name: newName.trim(),
        slug: newSlug.trim(),
        category: resolvedCategory,
        address: newAddress.trim() || undefined,
        phone: newPhone.trim() || undefined,
        google_review_url: newReviewUrl.trim(),
        place_id: newPlaceId.trim() || undefined,
        description: newDescription.trim() || undefined,
        logo_url: newLogoUrl.trim() || undefined,
        is_active: true,
      });

      if (result.error) {
        setCreateError(result.error);
        if (result.missingColumns && result.missingColumns.length > 0) {
          setCreateMissingColumns(result.missingColumns);
        }
        return;
      }

      // Show clear success message only after Supabase confirms the client was saved
      if (result.business) {
        let msg = `Successfully added client "${result.business.name}" (${result.business.category || resolvedCategory}) to Supabase!`;
        if (result.notice) {
          msg += ` ${result.notice}`;
        }
        setSuccessMessage(msg);
        setShowAddModal(false);
        setNewName('');
        setNewSlug('');
        setNewCategory('Restaurant');
        setCustomBusinessType('');
        setNewAddress('');
        setNewPhone('');
        setNewReviewUrl('');
        setNewPlaceId('');
        setNewDescription('');
        setNewLogoUrl('');
        setCreateMissingColumns(null);
        await loadData(true);
        onSelectBusiness(result.business);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCreateError(msg);
    } finally {
      setSavingBusiness(false);
    }
  };

  // Real database metrics (derived strictly from Supabase tables)
  const totalBusinesses = businesses.length;
  const activeCount = businesses.filter((b) => b.is_active).length;
  const subscriptionsMap = new Map<string, Subscription>();
  telemetry.subscriptions.forEach((s) => subscriptionsMap.set(s.business_id, s));
  const estimatedMRR = telemetry.subscriptions.reduce((sum, s) => sum + (s.monthly_price || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Founder Admin Console</h1>
            <span
              className={`text-xs px-2.5 py-0.5 rounded font-medium border ${
                isLiveSupabase
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {isLiveSupabase ? 'Supabase businesses table' : 'Not Connected'}
            </span>
            {realtimeActive && (
              <span className="flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded font-medium border bg-emerald-50 text-emerald-800 border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Realtime Active
              </span>
            )}
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="text-xs text-blue-600 hover:text-blue-800 underline font-mono"
            >
              {showDebug ? 'Hide Query Inspector' : 'Inspect Exact Supabase Query'}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time management for all client and business records stored in your Supabase database.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!user && onOpenAuth && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              Sign In with Supabase →
            </button>
          )}
          <button
            onClick={() => loadData(true)}
            disabled={loading || refreshing}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors shadow-xs disabled:opacity-50"
            title="Refresh database records"
          >
            {refreshing ? 'Refreshing...' : '↻ Refresh'}
          </button>
          <button
            onClick={() => {
              setCreateError(null);
              setShowAddModal(true);
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            + Add New Client
          </button>
        </div>
      </div>

      {/* Live Realtime Notification Banner */}
      {liveNotice && (
        <div className="p-3.5 bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-between shadow-md transition-all">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
            <span>{liveNotice}</span>
            <span className="text-emerald-100 font-normal">
              — Founder Admin Console auto-refreshed via Supabase Realtime!
            </span>
          </div>
          <button
            onClick={() => setLiveNotice(null)}
            className="text-white hover:text-emerald-100 font-bold px-2 py-0.5 rounded text-sm cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* New Client Success Banner */}
      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-emerald-600 font-bold text-base">✓</span>
            <span className="font-medium">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold px-1.5 py-0.5 text-sm cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Action Error / Warning Banner */}
      {actionError && (
        <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-950 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-rose-600 font-bold text-base">⚠️</span>
            <span className="font-medium leading-relaxed">{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-rose-700 hover:text-rose-900 font-bold px-1.5 py-0.5 text-sm cursor-pointer shrink-0"
          >
            ×
          </button>
        </div>
      )}


      {/* Query & RLS Inspector Panel */}
      {showDebug && debugInfo && (
        <div className="p-4 bg-slate-900 text-slate-100 rounded-xl space-y-3 font-mono text-xs border border-slate-800">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="font-bold text-emerald-400">Exact Supabase Query Debug Inspector</span>
            <button
              onClick={() => loadData(true)}
              className="text-[11px] text-blue-400 hover:underline"
            >
              Re-execute Query
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
            <div>
              <span className="text-slate-400">Query Executed:</span>
              <div className="text-white bg-slate-800/80 p-1.5 rounded mt-0.5">{debugInfo.queryExecuted}</div>
            </div>
            <div>
              <span className="text-slate-400">HTTP Status:</span>
              <div className="text-white bg-slate-800/80 p-1.5 rounded mt-0.5">{debugInfo.httpStatus || 200} OK</div>
            </div>
            <div>
              <span className="text-slate-400">Current User ID:</span>
              <div className="text-white bg-slate-800/80 p-1.5 rounded mt-0.5">{debugInfo.currentUserId || 'null (unauthenticated)'}</div>
            </div>
            <div>
              <span className="text-slate-400">Rows Returned:</span>
              <div className="text-white bg-slate-800/80 p-1.5 rounded mt-0.5">{debugInfo.rowCount}</div>
            </div>
          </div>
          <div>
            <span className="text-slate-400">Raw JSON Returned by Supabase Client:</span>
            <pre className="bg-black/50 p-2.5 rounded mt-1 overflow-x-auto text-[10px] max-h-36">
              {JSON.stringify(debugInfo.rawResponse, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Error Message if fetching fails with SQL error */}
      {fetchError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs">Error Fetching Supabase Records:</span>
            <button
              onClick={() => loadData(true)}
              className="text-xs font-semibold underline text-rose-800 hover:text-rose-950"
            >
              Try Again
            </button>
          </div>
          <p className="text-xs font-mono">{fetchError}</p>
        </div>
      )}

      {/* Network Real KPI Metric Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Total Registered Businesses</span>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {loading ? '—' : totalBusinesses}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            {loading ? 'Loading...' : `${activeCount} Active Standees`}
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Real QR Scans</span>
            {!isLiveSupabase && (
              <span className="text-[10px] bg-amber-100 text-amber-800 font-medium px-1.5 py-0.5 rounded">
                Demo Data
              </span>
            )}
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {loading ? '—' : telemetry.totalScans.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            {isLiveSupabase ? 'Recorded in qr_events' : 'Verified QR scans (0 real scans)'}
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Real Intercepted Complaints</span>
          <div className="text-2xl font-bold font-mono tabular-nums text-rose-600 mt-1">
            {loading ? '—' : telemetry.totalComplaints.toLocaleString()}
          </div>
          <span className="text-[11px] text-rose-700 mt-0.5 block font-medium">
            Recorded in complaints
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Subscriptions MRR</span>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 mt-1">
            {loading ? '—' : `$${estimatedMRR.toLocaleString()}`}
          </div>
          <span className="text-[11px] text-emerald-700 mt-0.5 block font-medium">
            {telemetry.subscriptions.length} Subscriptions recorded
          </span>
        </div>
      </div>

      {/* Businesses Table or Loading / Empty States */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">Registered Businesses</h2>
            <span className="text-xs text-slate-400 font-mono">
              (Supabase `businesses` table)
            </span>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {loading ? 'Loading...' : `${businesses.length} Clients`}
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 space-y-3">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
            <div className="font-medium text-slate-700">Fetching client records from Supabase...</div>
            <p className="text-[11px] text-slate-400">Querying public.businesses table</p>
          </div>
        ) : businesses.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-lg">
              🏪
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              No businesses found
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              No client businesses have been added yet. Click &ldquo;+ Add New Client&rdquo; to create your first client.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              {onOpenAuth && (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="px-4 py-2 text-xs font-semibold text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors shadow-xs cursor-pointer"
                >
                  Sign In to Supabase
                </button>
              )}
              <button
                onClick={() => {
                  setCreateError(null);
                  setShowAddModal(true);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                + Add New Client
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-6">Client / Business Name</th>
                  <th className="py-3 px-6">Slug / Standee URL</th>
                  <th className="py-3 px-6">Feedback Submissions</th>
                  <th className="py-3 px-6">Location</th>
                  <th className="py-3 px-6">Subscription</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {businesses.map((b) => {
                  const sub = subscriptionsMap.get(b.id);
                  const subCount =
                    feedbackCounts.allRecords.length > 0
                      ? feedbackCounts.allRecords.filter((rec) => matchFeedbackToBusiness(rec, b)).length
                      : (
                          (b.id ? feedbackCounts.byBusinessId[b.id] : undefined) ??
                          feedbackCounts.byRestaurantName[b.name?.trim()] ??
                          feedbackCounts.byRestaurantName[b.name?.trim()?.toLowerCase()] ??
                          feedbackCounts.byRestaurantName[b.slug?.trim()] ??
                          0
                        );

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-6 font-semibold text-slate-900">
                        <div>{b.name}</div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          {b.category && (
                            <span className="text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                              {b.category}
                            </span>
                          )}
                          {b.place_id && (
                            <span className="text-[10px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded" title={`Google Place ID: ${b.place_id}`}>
                              Place ID: {b.place_id.length > 14 ? `${b.place_id.substring(0, 12)}…` : b.place_id}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-6 font-mono text-slate-500">
                        /r/{b.slug}
                      </td>
                      <td className="py-3.5 px-6">
                        <button
                          type="button"
                          onClick={() => handleOpenInspectFeedback(b)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors cursor-pointer"
                          title={`Inspect ${subCount} feedback records for ${b.name}`}
                        >
                          <span>💬</span>
                          <span className="font-mono font-bold">{subCount}</span>
                          <span className="text-[10px] text-blue-500 font-normal">records</span>
                        </button>
                      </td>
                      <td className="py-3.5 px-6 text-slate-600 truncate max-w-[200px]">
                        {b.address || '—'}
                      </td>
                      <td className="py-3.5 px-6">
                        {sub ? (
                          <span className="capitalize font-medium text-slate-700">
                            {sub.plan} (${sub.monthly_price}/mo)
                          </span>
                        ) : (
                          <span className="text-slate-400">None</span>
                        )}
                      </td>
                      <td className="py-3.5 px-6">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                            b.is_active
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {b.is_active ? 'ACTIVE' : 'PAUSED'}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenInspectFeedback(b)}
                          className="px-2 py-1 text-xs font-semibold text-purple-600 hover:text-purple-800 hover:underline"
                          title="Inspect live feedback records for this client"
                        >
                          Inspect ({subCount})
                        </button>
                        <button
                          onClick={() => onSelectBusiness(b)}
                          className="px-2 py-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          Dashboard
                        </button>
                        <button
                          onClick={() => onSelectBusiness(b)}
                          className="px-2 py-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 hover:underline"
                          title="View live public Google Reviews"
                        >
                          Google Reviews ↗
                        </button>
                        <button
                          onClick={() => onOpenGuestQR(b.slug)}
                          className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 hover:underline"
                        >
                          Guest QR →
                        </button>

                        {/* Deactivate / Activate Action */}
                        <button
                          onClick={() => handleToggleActive(b)}
                          disabled={actionLoadingId === b.id}
                          className={`px-2 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
                            b.is_active
                              ? 'text-amber-700 hover:text-amber-900 hover:underline'
                              : 'text-emerald-700 hover:text-emerald-900 hover:underline'
                          }`}
                          title={b.is_active ? 'Deactivate client standee' : 'Activate client standee'}
                        >
                          {actionLoadingId === b.id ? (
                            'Updating...'
                          ) : b.is_active ? (
                            'Deactivate'
                          ) : (
                            'Activate'
                          )}
                        </button>

                        {/* Delete Action */}
                        <button
                          onClick={() => handleOpenDeleteModal(b)}
                          disabled={actionLoadingId === b.id}
                          className="px-2 py-1 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:underline disabled:opacity-50"
                          title="Inspect dependencies and delete business"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add New Client Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Add New Client</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            {createError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-start gap-2">
                <span className="text-sm shrink-0">⚠️</span>
                <div className="space-y-1 w-full">
                  <span className="font-semibold block">Failed to save client:</span>
                  <span className="font-mono text-[11px] break-all block">{createError}</span>

                  {createMissingColumns && createMissingColumns.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-rose-200 text-slate-800 space-y-1.5">
                      <div className="font-semibold text-rose-900 text-[11px]">
                        Required Schema Migration:
                      </div>
                      <p className="text-[10px] text-slate-600">
                        Run this in your <strong>Supabase Dashboard &gt; SQL Editor</strong> to add the missing column(s):
                      </p>
                      <pre className="p-2 bg-slate-900 text-emerald-400 rounded text-[10px] font-mono overflow-x-auto whitespace-pre-wrap select-all">
                        {createMissingColumns.map((m) => m.migrationSql).join('\n')}
                      </pre>
                      <button
                        type="button"
                        onClick={() => {
                          const sql = createMissingColumns.map((m) => m.migrationSql).join('\n');
                          navigator.clipboard.writeText(sql);
                          setCopyMigrationSuccess(true);
                          setTimeout(() => setCopyMigrationSuccess(false), 2500);
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-rose-300 hover:bg-rose-100 rounded text-rose-900 transition-colors cursor-pointer"
                      >
                        {copyMigrationSuccess ? '✓ Copied Migration SQL!' : 'Copy Migration SQL'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleCreateBusiness} className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Client / Business Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Copper Grill House, Sparkle Salon, City Gym"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Business Category <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={newCategory}
                  onChange={(e) => {
                    setNewCategory(e.target.value);
                    if (createError) setCreateError(null);
                  }}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 text-slate-900"
                >
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Select business type: Restaurant, Temple/Religious Place, Salon, Gym, Clinic, Retail Shop, Hotel, School, or Custom.
                </span>
              </div>

              {newCategory === 'Custom' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Enter Business Type <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={customBusinessType}
                    onChange={(e) => {
                      setCustomBusinessType(e.target.value);
                      if (createError) setCreateError(null);
                    }}
                    placeholder="e.g. Retail Shop, Coaching Institute, Hotel, School..."
                    className="w-full text-xs p-2.5 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-blue-50/20"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Example values: Retail Shop, Coaching Institute, Hotel, School, or any business type.
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Business Slug <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  placeholder="client-unique-slug"
                  className="w-full text-xs font-mono p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                  Standee URL: hereview.com/r/{newSlug || 'slug'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Google Reviews URL <span className="text-rose-500">*</span>
                </label>
                <input
                  type="url"
                  required
                  value={newReviewUrl}
                  onChange={(e) => {
                    const url = e.target.value;
                    setNewReviewUrl(url);
                    // Automatically extract place ID if present in the review URL
                    const match = url.match(/placeid=([A-Za-z0-9_-]+)/i);
                    if (match && match[1] && !newPlaceId) {
                      setNewPlaceId(match[1]);
                    }
                  }}
                  placeholder="https://search.google.com/local/writereview?placeid=..."
                  className="w-full text-xs font-mono p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Direct Google Review popup URL where 4-5 star customers will be redirected.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Google Place ID <span className="text-slate-400 font-normal">(Optional · saved in Supabase businesses.place_id)</span>
                </label>
                <input
                  type="text"
                  value={newPlaceId}
                  onChange={(e) => setNewPlaceId(e.target.value.trim())}
                  placeholder="e.g. ChIJN1t_tDeuEmsRUsoyG83frY4"
                  className="w-full text-xs font-mono p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Used by the secure Supabase Edge Function to fetch live public Google ratings and reviews.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Business Description <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="e.g. Authentic cuisine, family-friendly ambience, fresh ingredients daily."
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Logo URL <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="url"
                  value={newLogoUrl}
                  onChange={(e) => setNewLogoUrl(e.target.value.trim())}
                  placeholder="https://example.com/logo.png"
                  className="w-full text-xs font-mono p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Business Address <span className="text-slate-400 font-normal">(Optional)</span></label>
                <input
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="e.g. 500 Market St, Denver, CO"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone <span className="text-slate-400 font-normal">(Optional)</span></label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="(303) 555-0199"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingBusiness}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {savingBusiness ? 'Saving to Supabase...' : 'Save to Supabase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Dependency Inspection Confirmation Modal */}
      {deleteModalBusiness && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-rose-600 text-lg">🗑️</span>
                <h3 className="text-sm font-bold text-slate-900">
                  Delete Client: {deleteModalBusiness.name}
                </h3>
              </div>
              <button
                onClick={() => setDeleteModalBusiness(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Business info summary */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 font-mono text-slate-700">
              <div><strong>Client Name:</strong> {deleteModalBusiness.name}</div>
              <div><strong>Category:</strong> {deleteModalBusiness.category || 'Restaurant'}</div>
              <div><strong>Standee URL:</strong> /r/{deleteModalBusiness.slug}</div>
              {deleteModalBusiness.address && <div><strong>Address:</strong> {deleteModalBusiness.address}</div>}
            </div>

            {/* Database Deletion Error Banner with Diagnostic Details & SQL Fix */}
            {deleteResultError && (
              <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl space-y-3 text-rose-950 text-xs">
                <div className="flex items-start gap-2.5">
                  <span className="text-rose-600 text-base mt-0.5 font-bold">❌</span>
                  <div className="space-y-1 w-full">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-rose-950 text-xs">
                        {deleteResultError.rlsBlocked
                          ? 'Row-Level Security (RLS) Blocked Deletion'
                          : 'Database Deletion Failed'}
                      </h4>
                      {deleteResultError.errorCode && (
                        <span className="text-[10px] bg-rose-200/80 text-rose-900 px-1.5 py-0.5 rounded font-mono">
                          {deleteResultError.errorCode}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed text-rose-900">
                      {deleteResultError.error}
                    </p>
                    {deleteResultError.errorDetails && (
                      <p className="text-[10px] font-mono text-rose-800 bg-rose-100/70 p-1.5 rounded">
                        Details: {deleteResultError.errorDetails}
                      </p>
                    )}
                  </div>
                </div>

                {deleteResultError.requiredSql && (
                  <div className="bg-white border border-rose-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-800">
                        ⚡ Required Supabase SQL Fix (Run in SQL Editor):
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(deleteResultError.requiredSql!);
                          setCopiedDeleteFixSql(true);
                          setTimeout(() => setCopiedDeleteFixSql(false), 2500);
                        }}
                        className="px-2.5 py-1 text-[10px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 cursor-pointer shadow-xs"
                      >
                        {copiedDeleteFixSql ? '✓ Copied SQL!' : 'Copy SQL Fix'}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-600 leading-relaxed">
                      Supabase Row-Level Security blocks non-owners from deleting records. Run this script in your{' '}
                      <strong>Supabase Dashboard → SQL Editor</strong> to grant DELETE privileges and install the
                      secure Founder deletion function.
                    </p>
                    <pre className="text-[10px] bg-slate-900 text-slate-100 p-2.5 rounded font-mono overflow-x-auto max-h-36 leading-tight select-all">
                      {deleteResultError.requiredSql}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Inspecting State */}
            {inspectingDependencies && (
              <div className="p-6 text-center space-y-2">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-rose-600 border-t-transparent" />
                <p className="text-xs text-slate-600 font-medium">
                  Inspecting foreign-key constraints & related records in Supabase...
                </p>
                <p className="text-[11px] text-slate-400 font-mono">
                  Checking public.reviews_and_feedback table...
                </p>
              </div>
            )}

            {/* Inspection Done: Dependent records found */}
            {!inspectingDependencies && dependencyInspection && dependencyInspection.totalRelatedRecords > 0 && (
              <div className="space-y-3">
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl space-y-2 text-amber-950 text-xs">
                  <div className="flex items-center gap-2 font-bold text-amber-900">
                    <span>⚠️</span>
                    <span>Exclusive Dependent Records Detected</span>
                  </div>
                  <p className="leading-relaxed text-[11px]">
                    "{deleteModalBusiness.name}" has <strong>{dependencyInspection.totalRelatedRecords}</strong> exclusive child record(s) in Supabase that belong solely to this business:
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-0.5">
                    <div className="bg-amber-100/70 p-2.5 rounded text-center">
                      <div className="font-bold text-amber-900 text-base">
                        {dependencyInspection.reviewsAndFeedbackCount || dependencyInspection.feedbackCount || dependencyInspection.totalRelatedRecords}
                      </div>
                      <div className="text-[11px] text-amber-800 font-semibold">Reviews & Feedback Records</div>
                      <div className="text-[10px] text-amber-700">public.reviews_and_feedback</div>
                    </div>
                    <div className="bg-amber-100/70 p-2.5 rounded text-center">
                      <div className="font-bold text-amber-900 text-base">
                        {dependencyInspection.canDelete ? 'Safe' : 'Cascaded'}
                      </div>
                      <div className="text-[11px] text-amber-800 font-semibold">Cascade Status</div>
                      <div className="text-[10px] text-amber-700">Cleaned on deletion</div>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs space-y-2">
                  <div className="font-semibold text-rose-950 flex items-center gap-1.5">
                    <span>Permanent Deletion Warning:</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-rose-900">
                    Deleting this business will permanently remove the record from the Supabase <code>businesses</code> table and purge its exclusive customer reviews from <code>reviews_and_feedback</code>. Unrelated businesses and other customers are strictly preserved. If you only want to pause customer traffic, consider <strong>Deactivate Instead</strong>.
                  </p>

                  <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={deleteConfirmChecked}
                      onChange={(e) => setDeleteConfirmChecked(e.target.checked)}
                      className="mt-0.5 rounded border-rose-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                    <span className="text-[11px] font-semibold text-rose-950">
                      I understand and confirm permanent deletion of "{deleteModalBusiness.name}" (ID: {deleteModalBusiness.id}) and its exclusive records from Supabase.
                    </span>
                  </label>
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteModalBusiness(null)}
                    disabled={deletingBusiness}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDeactivateInsteadFromModal}
                      disabled={deletingBusiness}
                      className="px-3.5 py-2 text-xs font-semibold text-amber-900 bg-amber-100 border border-amber-300 hover:bg-amber-200 rounded-lg transition-colors cursor-pointer shadow-xs"
                      title="Pause public standees without erasing records"
                    >
                      Deactivate Instead (Safer)
                    </button>

                    <button
                      type="button"
                      onClick={handleConfirmPermanentDelete}
                      disabled={!deleteConfirmChecked || deletingBusiness}
                      className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {deletingBusiness ? (
                        <>
                          <div className="inline-block animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                          <span>Deleting from Supabase...</span>
                        </>
                      ) : (
                        'Delete Permanently'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Inspection Done: Clean client (0 dependent records) */}
            {!inspectingDependencies && dependencyInspection && dependencyInspection.totalRelatedRecords === 0 && (
              <div className="space-y-3">
                <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl space-y-1 text-emerald-950 text-xs">
                  <div className="flex items-center gap-2 font-bold text-emerald-900">
                    <span>✓</span>
                    <span>Clean Client: 0 Dependent Records</span>
                  </div>
                  <p className="text-[11px]">
                    No reviews or feedback records exist for this client in <code>reviews_and_feedback</code>. Deletion is completely safe.
                  </p>
                </div>

                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs space-y-2">
                  <p className="font-semibold text-rose-950">
                    Are you sure you want to permanently delete "{deleteModalBusiness.name}"?
                  </p>
                  <p className="text-[11px] text-rose-800">
                    UUID: <code className="font-mono bg-rose-100 px-1 py-0.5 rounded">{deleteModalBusiness.id}</code>
                  </p>
                  <p className="text-[11px] text-rose-700">
                    This will permanently remove the business row from your Supabase <code>businesses</code> table. This action cannot be undone.
                  </p>

                  <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={deleteConfirmChecked}
                      onChange={(e) => setDeleteConfirmChecked(e.target.checked)}
                      className="mt-0.5 rounded border-rose-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                    <span className="text-[11px] font-semibold text-rose-950">
                      I confirm permanent deletion of "{deleteModalBusiness.name}".
                    </span>
                  </label>
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteModalBusiness(null)}
                    disabled={deletingBusiness}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDeactivateInsteadFromModal}
                      disabled={deletingBusiness}
                      className="px-3.5 py-2 text-xs font-semibold text-amber-900 bg-amber-100 border border-amber-300 hover:bg-amber-200 rounded-lg transition-colors cursor-pointer shadow-xs"
                    >
                      Deactivate Instead
                    </button>

                    <button
                      type="button"
                      onClick={handleConfirmPermanentDelete}
                      disabled={!deleteConfirmChecked || deletingBusiness}
                      className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {deletingBusiness ? (
                        <>
                          <div className="inline-block animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                          <span>Deleting from Supabase...</span>
                        </>
                      ) : (
                        'Delete Permanently'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scoped Customer Feedback Inspection Modal for Authorized Founder */}
      {inspectModalBusiness && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-4xl w-full p-6 space-y-5 max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    Client Feedback Inspection: {inspectModalBusiness.name}
                  </h3>
                  <span className="text-xs font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                    {inspectModalRecords.length} records
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Tenant Isolation Verified: Showing records scoped exclusively to &ldquo;{inspectModalBusiness.name}&rdquo;.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectModalBusiness(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl px-2 cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Records List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {inspectModalRecords.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500 space-y-2">
                  <div className="text-2xl">💬</div>
                  <div className="font-semibold text-slate-800">
                    No feedback records exist yet for {inspectModalBusiness.name}
                  </div>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    Submissions through the standee QR code or simulator will appear here immediately via Realtime.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {inspectModalRecords.map((rec) => {
                    const hasRating = typeof rec.rating === 'number' && !isNaN(rec.rating) && rec.rating !== null && rec.rating > 0;
                    const customerName = rec.customer_name?.trim() ? rec.customer_name.trim() : 'Anonymous';
                    const formattedDate = new Date(rec.created_at).toLocaleString([], {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    });

                    return (
                      <div key={rec.id} className="p-4 bg-white hover:bg-slate-50/70 transition-colors text-xs space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {hasRating ? (
                              <span className="font-bold text-amber-500 font-mono tracking-wide">
                                {'★'.repeat(Math.round(rec.rating!))}
                                {'☆'.repeat(5 - Math.round(rec.rating!))}
                                <span className="ml-1 text-slate-700 font-semibold text-xs">
                                  {rec.rating}★
                                </span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                Rating: Not provided
                              </span>
                            )}
                            <span className="font-bold text-slate-900">{customerName}</span>
                            {rec.action_type && (
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${
                                  rec.action_type.includes('google') || (hasRating && rec.rating! >= 4)
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                                }`}
                              >
                                {rec.action_type}
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[11px] text-slate-400">
                            {formattedDate}
                          </span>
                        </div>

                        <div className="text-slate-700 text-xs leading-relaxed">
                          {rec.feedback_text?.trim() ? (
                            <p className="italic bg-slate-50 p-2 rounded border border-slate-100">
                              &ldquo;{rec.feedback_text.trim()}&rdquo;
                            </p>
                          ) : (
                            <span className="text-slate-400 italic">No written feedback</span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-0.5 font-mono">
                          <span>Mobile: <strong className="font-semibold text-slate-700">{rec.mobile_number || 'Not provided'}</strong></span>
                          <span>•</span>
                          <span>Table: <strong className="text-slate-600 font-normal">public.reviews_and_feedback</strong></span>
                          <span>•</span>
                          <span>ID: <code className="text-[10px] bg-slate-100 px-1 py-0.2 rounded text-slate-600">{rec.id.substring(0, 8)}…</code></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer with actions */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setInspectModalBusiness(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => {
                  const b = inspectModalBusiness;
                  setInspectModalBusiness(null);
                  onSelectBusiness(b);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <span>Open Restaurant Dashboard for {inspectModalBusiness.name}</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
