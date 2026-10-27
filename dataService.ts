import { getSupabase } from './supabaseClient';
import { Business, Profile, QREvent, Feedback, Complaint, Subscription, DashboardStats, GooglePlaceDetails, ReviewFeedbackRecord } from '../types';
import { FOUNDER_DELETE_RLS_FIX_SQL } from './sqlMigration';

// Initial seed businesses for local sandbox when Supabase is not yet initialized
export const SANDBOX_BUSINESSES: Business[] = [
  {
    id: 'b1111111-1111-1111-1111-111111111111',
    owner_id: 'u1111111-1111-1111-1111-111111111111',
    name: 'Bella Vista Bistro',
    slug: 'bella-vista',
    category: 'Restaurant',
    address: '428 Downtown Blvd, Seattle, WA',
    phone: '(206) 555-0192',
    google_review_url: 'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4',
    place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
    accent_color: '#2563EB',
    is_active: true,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'b2222222-2222-2222-2222-222222222222',
    owner_id: 'u2222222-2222-2222-2222-222222222222',
    name: 'Artisan Woodfire Pizza',
    slug: 'artisan-woodfire',
    category: 'Restaurant',
    address: '109 Artisan Way, Austin, TX',
    phone: '(512) 555-4811',
    google_review_url: 'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY5',
    place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY5',
    accent_color: '#D97706',
    is_active: true,
    created_at: new Date(Date.now() - 45 * 86400000).toISOString(),
  },
  {
    id: 'b3333333-3333-3333-3333-333333333333',
    owner_id: 'u3333333-3333-3333-3333-333333333333',
    name: 'Sakura Japanese Dining',
    slug: 'sakura-dining',
    category: 'Restaurant',
    address: '77 Ocean Ave, San Francisco, CA',
    phone: '(415) 555-8392',
    google_review_url: 'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY6',
    place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY6',
    accent_color: '#059669',
    is_active: true,
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
];

export const SANDBOX_SUBSCRIPTIONS: Subscription[] = [
  {
    id: 's1',
    business_id: 'b1111111-1111-1111-1111-111111111111',
    plan: 'pro',
    status: 'active',
    period_start: new Date(Date.now() - 15 * 86400000).toISOString(),
    period_end: new Date(Date.now() + 15 * 86400000).toISOString(),
    monthly_price: 79.00,
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
  {
    id: 's2',
    business_id: 'b2222222-2222-2222-2222-222222222222',
    plan: 'starter',
    status: 'active',
    period_start: new Date(Date.now() - 25 * 86400000).toISOString(),
    period_end: new Date(Date.now() + 5 * 86400000).toISOString(),
    monthly_price: 49.00,
    created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
  },
  {
    id: 's3',
    business_id: 'b3333333-3333-3333-3333-333333333333',
    plan: 'enterprise',
    status: 'active',
    period_start: new Date(Date.now() - 10 * 86400000).toISOString(),
    period_end: new Date(Date.now() + 20 * 86400000).toISOString(),
    monthly_price: 149.00,
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
];

// Local storage backed fallback arrays for sandbox demo mode
const LOCAL_FEEDBACK_KEY = 'reviewstandee_local_feedback';
const LOCAL_COMPLAINTS_KEY = 'reviewstandee_local_complaints';
const LOCAL_QR_KEY = 'reviewstandee_local_qr_events';
const LOCAL_BUSINESSES_KEY = 'reviewstandee_local_businesses';

function getLocalItem<T>(key: string, defaultValue: T): T {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setLocalItem<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

// Initial sandbox feedback
const INITIAL_SANDBOX_FEEDBACK: Feedback[] = [
  {
    id: 'f1',
    business_id: 'b1111111-1111-1111-1111-111111111111',
    rating: 5,
    comment: 'The handmade pasta was sensational! Our server Marcus was attentive and kind.',
    customer_name: 'Elena Rostova',
    customer_contact: 'elena@example.com',
    table_number: '12',
    is_positive: true,
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: 'f2',
    business_id: 'b1111111-1111-1111-1111-111111111111',
    rating: 5,
    comment: 'Best tiramisu in the city. Fast service, very clean ambiance.',
    customer_name: 'David Chen',
    table_number: '4',
    is_positive: true,
    created_at: new Date(Date.now() - 8 * 3600000).toISOString(),
  },
  {
    id: 'f3',
    business_id: 'b1111111-1111-1111-1111-111111111111',
    rating: 4,
    comment: 'Great wine selection. Salmon was cooked to perfection.',
    customer_name: 'Sarah Jenkins',
    table_number: '7',
    is_positive: true,
    created_at: new Date(Date.now() - 22 * 3600000).toISOString(),
  },
  {
    id: 'f4',
    business_id: 'b1111111-1111-1111-1111-111111111111',
    rating: 2,
    comment: 'Took 45 minutes for our main courses to arrive. Table was wobbly.',
    customer_name: 'James Miller',
    customer_contact: '(206) 555-8821',
    table_number: '9',
    is_positive: false,
    created_at: new Date(Date.now() - 36 * 3600000).toISOString(),
  },
  {
    id: 'f5',
    business_id: 'b1111111-1111-1111-1111-111111111111',
    rating: 5,
    comment: 'Fantastic date night spot. Will definitely bring our family next time.',
    customer_name: 'Sophia Patel',
    table_number: '14',
    is_positive: true,
    created_at: new Date(Date.now() - 48 * 3600000).toISOString(),
  },
];

const INITIAL_SANDBOX_COMPLAINTS: Complaint[] = [
  {
    id: 'c1',
    business_id: 'b1111111-1111-1111-1111-111111111111',
    category: 'Wait Time',
    message: 'Main dishes arrived after 45 minutes. Our drinks had run dry for 20 minutes before a waiter passed by.',
    customer_name: 'James Miller',
    customer_phone: '(206) 555-8821',
    customer_email: 'jmiller@example.com',
    table_number: '9',
    status: 'investigating',
    manager_notes: 'Spoke with Head Chef; kitchen was understaffed that Friday shift. Left voicemail for guest offering $30 dessert voucher.',
    created_at: new Date(Date.now() - 36 * 3600000).toISOString(),
  },
  {
    id: 'c2',
    business_id: 'b1111111-1111-1111-1111-111111111111',
    category: 'Billing',
    message: 'We were billed for an extra bottle of sparkling water that was never brought to our table.',
    customer_name: 'Amanda Brooks',
    customer_phone: '(206) 555-3210',
    table_number: '3',
    status: 'resolved',
    manager_notes: 'Refunded $8.50 charge directly and sent apology email.',
    created_at: new Date(Date.now() - 72 * 3600000).toISOString(),
  },
];

// --- PUBLIC FACING FUNCTIONS ---

export function normalizeBusinessRow(data: any): Business {
  return {
    ...data,
    name: data.name || data.business_name || 'Business',
    category: data.category || 'Restaurant',
    is_active: data.active ?? data.is_active ?? true,
    place_id: data.place_id || data.google_place_id || undefined,
  } as Business;
}

export async function fetchBusinessByIdOrSlug(idOrSlug: string): Promise<Business | null> {
  const clean = (idOrSlug || '').trim();
  if (!clean) return null;

  const client = getSupabase();
  if (client) {
    try {
      // 1. Try slug exact / case-insensitive
      const { data: bySlug } = await client
        .from('businesses')
        .select('*')
        .ilike('slug', clean)
        .maybeSingle();

      if (bySlug) {
        return normalizeBusinessRow(bySlug);
      }

      // 2. Try UUID id exact
      if (/^[0-9a-f-]{36}$/i.test(clean)) {
        const { data: byId } = await client
          .from('businesses')
          .select('*')
          .eq('id', clean)
          .maybeSingle();

        if (byId) {
          return normalizeBusinessRow(byId);
        }
      }

      // 3. Try name case-insensitive
      const { data: byName } = await client
        .from('businesses')
        .select('*')
        .ilike('name', clean)
        .maybeSingle();

      if (byName) {
        return normalizeBusinessRow(byName);
      }
    } catch (err) {
      console.warn('fetchBusinessByIdOrSlug notice:', err);
    }
  }

  // Fallback to local sandbox business
  const sandbox = SANDBOX_BUSINESSES.find(
    (b) =>
      b.slug.toLowerCase() === clean.toLowerCase() ||
      b.id === clean ||
      b.name.toLowerCase() === clean.toLowerCase()
  );
  if (sandbox) return sandbox;

  const localList = getLocalItem<Business[]>(LOCAL_BUSINESSES_KEY, []);
  const localFound = localList.find(
    (b) =>
      b.slug.toLowerCase() === clean.toLowerCase() ||
      b.id === clean ||
      b.name.toLowerCase() === clean.toLowerCase()
  );
  if (localFound) return localFound;

  return null;
}

export async function fetchBusinessBySlug(slug: string): Promise<Business | null> {
  const found = await fetchBusinessByIdOrSlug(slug);
  return found || SANDBOX_BUSINESSES[0] || null;
}


export async function logQREvent(
  businessId: string,
  eventType: 'scan' | 'view',
  tableNumber?: string
): Promise<{ success: boolean; error?: string }> {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
  const client = getSupabase();

  if (client) {
    try {
      // Supabase qr_events schema columns: id, business_id, event_type, created_at
      const payload: Record<string, any> = {
        business_id: businessId,
        event_type: eventType,
      };
      const { error } = await client.from('qr_events').insert(payload);
      if (!error) {
        return { success: true };
      }
      console.warn('Supabase qr_event insert error:', error.message);
      return { success: false, error: error.message };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('Supabase qr_event insert exception:', msg);
      return { success: false, error: msg };
    }
  }

  // Fallback to local sandbox only when Supabase client is not configured
  const events = getLocalItem<QREvent[]>(LOCAL_QR_KEY, []);
  events.push({
    id: 'qr_' + Date.now(),
    business_id: businessId,
    event_type: eventType,
    table_number: tableNumber,
    user_agent: userAgent,
    created_at: new Date().toISOString(),
  });
  setLocalItem(LOCAL_QR_KEY, events);
  return { success: true };
}

export async function submitFeedback(
  feedback: {
    business_id: string;
    client_id?: string;
    restaurant_name?: string;
    rating: number;
    comment?: string;
    customer_name?: string;
    customer_contact?: string;
    table_number?: string;
    action_type?: string;
  }
): Promise<{ success: boolean; id?: string; error?: string }> {
  const isPositive = feedback.rating >= 4;
  const client = getSupabase();

  if (client) {
    try {
      // 1. Target verified live table: public.reviews_and_feedback
      // Columns: restaurant_name, customer_name, mobile_number, action_type, rating, feedback_text
      const effectiveRestaurantName = feedback.restaurant_name || feedback.client_id || 'Restaurant';
      const defaultActionType = isPositive ? 'positive_google' : 'complaint';

      // Primary payload attempting business_id foreign key if migrated
      const fullRfPayload: Record<string, any> = {
        restaurant_name: effectiveRestaurantName,
        customer_name: feedback.customer_name?.trim() || null,
        mobile_number: feedback.customer_contact?.trim() || null,
        action_type: feedback.action_type || defaultActionType,
        rating: feedback.rating,
        feedback_text: feedback.comment?.trim() || null,
        business_id: feedback.business_id,
      };

      let { error: rfErr } = await client
        .from('reviews_and_feedback')
        .insert(fullRfPayload);

      // If business_id is not a column yet (PGRST204 or 42703), retry without business_id
      if (rfErr && (rfErr.message?.includes('business_id') || rfErr.code === '42703' || (rfErr as any).hint?.includes('business_id'))) {
        const minimalRfPayload = { ...fullRfPayload };
        delete minimalRfPayload.business_id;
        const retryRes = await client.from('reviews_and_feedback').insert(minimalRfPayload);
        rfErr = retryRes.error;
      }

      if (!rfErr) {
        return { success: true };
      }

      // If reviews_and_feedback failed or does not exist, also attempt legacy feedback table
      const legacyPayload: Record<string, any> = {
        business_id: feedback.business_id,
        rating: feedback.rating,
        comment: feedback.comment || null,
      };
      if (feedback.client_id) legacyPayload.client_id = feedback.client_id;
      if (feedback.customer_name) legacyPayload.customer_name = feedback.customer_name;
      if (feedback.customer_contact) legacyPayload.customer_contact = feedback.customer_contact;
      if (feedback.table_number) legacyPayload.table_number = feedback.table_number;

      const { error: legErr } = await client.from('feedback').insert(legacyPayload);
      if (!legErr) {
        return { success: true };
      }

      console.warn('Supabase feedback insert error:', rfErr?.message || legErr?.message);
      return { success: false, error: rfErr?.message || legErr?.message };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('Supabase feedback insert exception:', msg);
      return { success: false, error: msg };
    }
  }

  // Fallback to local sandbox only when Supabase client is not configured
  const list = getLocalItem<Feedback[]>(LOCAL_FEEDBACK_KEY, INITIAL_SANDBOX_FEEDBACK);
  const newId = 'fb_' + Date.now();
  list.unshift({
    business_id: feedback.business_id,
    rating: feedback.rating,
    comment: feedback.comment,
    customer_name: feedback.customer_name,
    customer_contact: feedback.customer_contact,
    table_number: feedback.table_number,
    id: newId,
    is_positive: isPositive,
    created_at: new Date().toISOString(),
  });
  setLocalItem(LOCAL_FEEDBACK_KEY, list);
  return { success: true, id: newId };
}

export async function submitComplaint(
  complaint: Omit<Complaint, 'id' | 'created_at' | 'status'> & { restaurant_name?: string }
): Promise<{ success: boolean; id?: string; error?: string }> {
  const client = getSupabase();

  if (client) {
    try {
      const complaintText = complaint.issue || complaint.message || '';
      const effectiveRestaurantName = complaint.restaurant_name || 'Restaurant';

      // Insert into public.reviews_and_feedback
      const fullRfPayload: Record<string, any> = {
        restaurant_name: effectiveRestaurantName,
        customer_name: complaint.customer_name?.trim() || null,
        mobile_number: (complaint.customer_phone || complaint.customer_email)?.trim() || null,
        action_type: 'complaint',
        rating: null, // Null rating does not count as stars
        feedback_text: complaintText.trim() || null,
        business_id: complaint.business_id,
      };

      let { error: rfErr } = await client.from('reviews_and_feedback').insert(fullRfPayload);
      if (rfErr && (rfErr.message?.includes('business_id') || rfErr.code === '42703')) {
        const minimalRfPayload = { ...fullRfPayload };
        delete minimalRfPayload.business_id;
        const retryRes = await client.from('reviews_and_feedback').insert(minimalRfPayload);
        rfErr = retryRes.error;
      }

      if (!rfErr) {
        return { success: true };
      }

      // Legacy complaints fallback
      const payload: Record<string, any> = {
        business_id: complaint.business_id,
        issue: complaintText,
        status: 'new',
      };
      const { error } = await client.from('complaints').insert(payload);
      if (!error) return { success: true };

      console.warn('Supabase complaint insert error:', rfErr?.message || error?.message);
      return { success: false, error: rfErr?.message || error?.message };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('Supabase complaint insert exception:', msg);
      return { success: false, error: msg };
    }
  }

  // Local fallback only when Supabase client is not configured
  const list = getLocalItem<Complaint[]>(LOCAL_COMPLAINTS_KEY, INITIAL_SANDBOX_COMPLAINTS);
  const newId = 'comp_' + Date.now();
  list.unshift({
    ...complaint,
    id: newId,
    status: 'new',
    created_at: new Date().toISOString(),
  });
  setLocalItem(LOCAL_COMPLAINTS_KEY, list);
  return { success: true, id: newId };
}

// Exported helper: strictly matches a review/feedback record to a business with tenant isolation
export function matchFeedbackToBusiness(rec: ReviewFeedbackRecord | any, b: Business): boolean {
  if (rec.business_id) {
    return rec.business_id === b.id;
  }
  const recName = (rec.restaurant_name || '').trim().toLowerCase();
  const targetName = (b.name || '').trim().toLowerCase();
  const targetSlug = (b.slug || '').trim().toLowerCase();
  const targetSlugSpaced = targetSlug.replace(/-/g, ' ');
  if (!recName) return false;
  return (
    recName === targetName ||
    recName === targetSlug ||
    recName === targetSlugSpaced ||
    recName.replace(/\s+/g, '') === targetName.replace(/\s+/g, '')
  );
}

// --- RESTAURANT OWNER QUERIES (TENANT ISOLATED) ---

export async function fetchBusinessStats(business: Business | string): Promise<{
  stats: DashboardStats;
  recentFeedback: Feedback[];
  feedbackRecords: ReviewFeedbackRecord[];
  complaints: Complaint[];
  isLiveSupabase: boolean;
  hasBusinessIdColumn: boolean;
  error?: string | null;
}> {
  // Resolve business object if string (id or slug or name) was provided
  let targetBiz: Business | null = null;
  if (typeof business === 'string') {
    targetBiz = await fetchBusinessByIdOrSlug(business);
  } else if (business && typeof business === 'object') {
    targetBiz = business;
  }

  const businessId = targetBiz?.id || (typeof business === 'string' && /^[0-9a-f-]{36}$/i.test(business) ? business : '');
  const businessName = targetBiz?.name || (targetBiz as any)?.business_name || (typeof business === 'string' ? business : '');
  const businessSlug = targetBiz?.slug || '';
  const client = getSupabase();

  if (client) {
    try {
      // 1. Fetch real QR scans count from Supabase qr_events table (if available)
      let totalScans = 0;
      if (businessId) {
        try {
          const { count: scanCount, error: scanErr } = await client
            .from('qr_events')
            .select('*', { count: 'exact', head: true })
            .eq('business_id', businessId)
            .eq('event_type', 'scan');

          if (!scanErr && typeof scanCount === 'number') {
            totalScans = scanCount;
          }
        } catch {
          totalScans = 0;
        }
      }

      // 2. Fetch feedback records from public.reviews_and_feedback
      const recordsMap = new Map<string, ReviewFeedbackRecord>();
      let hasBusinessIdCol = false;
      let queryError: string | null = null;

      // Candidate search names for case-insensitive matching
      const candidateNames = new Set<string>();
      if (businessName && businessName.trim()) candidateNames.add(businessName.trim());
      if (businessSlug && businessSlug.trim()) {
        candidateNames.add(businessSlug.trim());
        candidateNames.add(businessSlug.trim().replace(/-/g, ' '));
      }

      // Attempt A: Try query by business_id if column exists and ID is present
      if (businessId) {
        try {
          const { data: byIdData, error: byIdErr } = await client
            .from('reviews_and_feedback')
            .select('*')
            .eq('business_id', businessId)
            .order('created_at', { ascending: false });

          if (!byIdErr && byIdData) {
            hasBusinessIdCol = true;
            byIdData.forEach((row: any) => recordsMap.set(row.id, row as ReviewFeedbackRecord));
          } else if (byIdErr && (byIdErr.code === '42703' || byIdErr.message?.includes('business_id'))) {
            hasBusinessIdCol = false;
          } else if (byIdErr) {
            queryError = byIdErr.message;
          }
        } catch {
          hasBusinessIdCol = false;
        }
      }

      // Attempt B: Case-insensitive match across candidate names
      for (const candidate of candidateNames) {
        try {
          const { data: byNameData, error: byNameErr } = await client
            .from('reviews_and_feedback')
            .select('*')
            .ilike('restaurant_name', candidate)
            .order('created_at', { ascending: false });

          if (!byNameErr && byNameData) {
            queryError = null;
            byNameData.forEach((row: any) => {
              // Tenant isolation guard: never include records that explicitly belong to a different business ID
              if (row.business_id && businessId && row.business_id !== businessId) {
                return;
              }
              if (!recordsMap.has(row.id)) {
                recordsMap.set(row.id, row as ReviewFeedbackRecord);
              }
            });
          } else if (byNameErr) {
            queryError = queryError || byNameErr.message;
          }
        } catch (e: any) {
          queryError = queryError || e?.message;
        }
      }

      let rawRecords = Array.from(recordsMap.values());

      // Attempt C: If still 0 and legacy `feedback` table exists, fallback
      if (rawRecords.length === 0 && businessId) {
        try {
          const { data: legacyData, error: legErr } = await client
            .from('feedback')
            .select('*')
            .eq('business_id', businessId)
            .order('created_at', { ascending: false });

          if (!legErr && legacyData && legacyData.length > 0) {
            rawRecords = legacyData.map((f: any) => ({
              id: f.id,
              created_at: f.created_at,
              restaurant_name: businessName,
              customer_name: f.customer_name || null,
              mobile_number: f.customer_contact || null,
              action_type: (f.rating ?? 5) >= 4 ? 'positive_google' : 'complaint',
              rating: typeof f.rating === 'number' ? f.rating : null,
              feedback_text: f.comment || null,
              business_id: f.business_id || businessId,
            }));
          }
        } catch {
          // Ignore
        }
      }

      // 3. Calculate metrics strictly adhering to requirements:
      // Total Submissions: actual count of feedback/review records for selected business
      const totalSubmissions = rawRecords.length;

      // Filter only valid, non-null numerical ratings
      const validRatingsRecords = rawRecords.filter(
        (r) => typeof r.rating === 'number' && !isNaN(r.rating) && r.rating !== null && r.rating > 0
      );
      const totalRatings = validRatingsRecords.length;

      const sumRatings = validRatingsRecords.reduce((sum, r) => sum + Number(r.rating), 0);
      const averageRating = totalRatings > 0 ? Number((sumRatings / totalRatings).toFixed(2)) : 0;

      // Google Reviews (4-5★) and Intercepted (1-3★):
      // Calculate using actual ratings and app's existing action_type logic.
      // Do not count null ratings as stars.
      let positive = 0;
      let negative = 0;
      const ratingsBreakdown: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

      rawRecords.forEach((r) => {
        if (typeof r.rating === 'number' && !isNaN(r.rating) && r.rating !== null && r.rating > 0) {
          const rounded = Math.min(5, Math.max(1, Math.round(r.rating)));
          ratingsBreakdown[rounded] = (ratingsBreakdown[rounded] || 0) + 1;
          if (r.rating >= 4) {
            positive++;
          } else {
            negative++;
          }
        } else if (r.action_type === 'complaint' || r.action_type === 'intercepted') {
          negative++;
        } else if (r.action_type === 'positive_google') {
          positive++;
        }
      });

      const interceptRate = (positive + negative) > 0 ? (negative / (positive + negative)) * 100 : 0;

      // Converted representations for components expecting Feedback[] or Complaint[]
      const convertedFeedback: Feedback[] = rawRecords.map((r) => ({
        id: r.id,
        business_id: r.business_id || businessId,
        rating: typeof r.rating === 'number' && !isNaN(r.rating) ? r.rating : 5,
        comment: r.feedback_text || undefined,
        customer_name: r.customer_name || undefined,
        customer_contact: r.mobile_number || undefined,
        is_positive: (r.rating ?? 5) >= 4,
        created_at: r.created_at,
      }));

      const convertedComplaints: Complaint[] = rawRecords
        .filter((r) => (r.rating !== null && typeof r.rating === 'number' && r.rating < 4) || r.action_type === 'complaint')
        .map((r) => ({
          id: r.id,
          business_id: r.business_id || businessId,
          category: 'Service',
          message: r.feedback_text || `Review rating: ${r.rating}★`,
          issue: r.feedback_text || `Review rating: ${r.rating}★`,
          customer_name: r.customer_name || undefined,
          customer_phone: r.mobile_number || undefined,
          status: 'new' as const,
          created_at: r.created_at,
        }));

      return {
        stats: {
          totalScans,
          totalRatings,
          totalSubmissions,
          averageRating,
          positiveFeedbackCount: positive,
          negativeFeedbackCount: negative,
          interceptRate,
          ratingsBreakdown,
        },
        recentFeedback: convertedFeedback,
        feedbackRecords: rawRecords,
        complaints: convertedComplaints,
        isLiveSupabase: true,
        hasBusinessIdColumn: hasBusinessIdCol,
        error: queryError,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('Supabase fetchBusinessStats error:', msg);
    }
  }

  // Local sandbox data (only when Supabase client is not configured)
  const localFeedback = getLocalItem<Feedback[]>(LOCAL_FEEDBACK_KEY, INITIAL_SANDBOX_FEEDBACK)
    .filter((f) => f.business_id === businessId);
  const localComplaints = getLocalItem<Complaint[]>(LOCAL_COMPLAINTS_KEY, INITIAL_SANDBOX_COMPLAINTS)
    .filter((c) => c.business_id === businessId);
  const localScans = getLocalItem<QREvent[]>(LOCAL_QR_KEY, [])
    .filter((e) => e.business_id === businessId && e.event_type === 'scan');

  const totalScans = localScans.length;
  const totalRatings = localFeedback.length;
  let sumRating = 0;
  let positive = 0;
  let negative = 0;
  const ratingsBreakdown: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  localFeedback.forEach((f) => {
    sumRating += f.rating;
    ratingsBreakdown[f.rating] = (ratingsBreakdown[f.rating] || 0) + 1;
    if (f.rating >= 4) positive++;
    else negative++;
  });

  const averageRating = totalRatings > 0 ? sumRating / totalRatings : 0;
  const interceptRate = (positive + negative) > 0 ? (negative / (positive + negative)) * 100 : 0;

  const mockRecords: ReviewFeedbackRecord[] = localFeedback.map((f) => ({
    id: f.id,
    created_at: f.created_at,
    restaurant_name: businessName || 'Local Business',
    customer_name: f.customer_name || null,
    mobile_number: f.customer_contact || null,
    action_type: f.is_positive ? 'positive_google' : 'complaint',
    rating: f.rating,
    feedback_text: f.comment || null,
    business_id: f.business_id,
  }));

  return {
    stats: {
      totalScans,
      totalRatings,
      totalSubmissions: localFeedback.length,
      averageRating,
      positiveFeedbackCount: positive,
      negativeFeedbackCount: negative,
      interceptRate,
      ratingsBreakdown,
    },
    recentFeedback: localFeedback,
    feedbackRecords: mockRecords,
    complaints: localComplaints,
    isLiveSupabase: false,
    hasBusinessIdColumn: false,
  };
}

export async function fetchBusinessFeedbackCounts(): Promise<{
  byBusinessId: Record<string, number>;
  byRestaurantName: Record<string, number>;
  allRecords: ReviewFeedbackRecord[];
}> {
  const client = getSupabase();
  if (!client) return { byBusinessId: {}, byRestaurantName: {}, allRecords: [] };

  try {
    const { data, error } = await client
      .from('reviews_and_feedback')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      return { byBusinessId: {}, byRestaurantName: {}, allRecords: [] };
    }

    const byBusinessId: Record<string, number> = {};
    const byRestaurantName: Record<string, number> = {};

    (data as ReviewFeedbackRecord[]).forEach((row) => {
      if (row.business_id) {
        byBusinessId[row.business_id] = (byBusinessId[row.business_id] || 0) + 1;
      }
      if (row.restaurant_name) {
        const exact = row.restaurant_name.trim();
        const lower = exact.toLowerCase();
        const slugForm = lower.replace(/\s+/g, '-');
        const spacedSlug = lower.replace(/-/g, ' ');

        byRestaurantName[exact] = (byRestaurantName[exact] || 0) + 1;
        if (exact !== lower) {
          byRestaurantName[lower] = (byRestaurantName[lower] || 0) + 1;
        }
        byRestaurantName[slugForm] = (byRestaurantName[slugForm] || 0) + 1;
        byRestaurantName[spacedSlug] = (byRestaurantName[spacedSlug] || 0) + 1;
      }
    });

    return {
      byBusinessId,
      byRestaurantName,
      allRecords: data as ReviewFeedbackRecord[],
    };
  } catch {
    return { byBusinessId: {}, byRestaurantName: {}, allRecords: [] };
  }
}


export async function updateComplaintStatus(
  complaintId: string,
  newStatus: 'new' | 'investigating' | 'resolved',
  notes?: string
): Promise<boolean> {
  const client = getSupabase();
  if (client) {
    try {
      const updatePayload: { status: 'new' | 'investigating' | 'resolved'; manager_notes?: string } = { status: newStatus };
      if (notes !== undefined) updatePayload.manager_notes = notes;
      const { error } = await client
        .from('complaints')
        .update(updatePayload)
        .eq('id', complaintId);
      if (!error) return true;
    } catch {
      // fallback
    }
  }

  const list = getLocalItem<Complaint[]>(LOCAL_COMPLAINTS_KEY, INITIAL_SANDBOX_COMPLAINTS);
  const idx = list.findIndex((c) => c.id === complaintId);
  if (idx !== -1) {
    list[idx].status = newStatus;
    if (notes !== undefined) list[idx].manager_notes = notes;
    setLocalItem(LOCAL_COMPLAINTS_KEY, list);
    return true;
  }
  return false;
}

// --- FOUNDER ADMIN QUERIES ---

export interface FetchBusinessesResult {
  businesses: Business[];
  isLiveSupabase: boolean;
  error: string | null;
  authWarning: {
    isAuthorized: boolean;
    status: 'ok' | 'unauthenticated' | 'unauthorized_rls';
    message: string;
    currentUserEmail?: string | null;
    currentUserId?: string | null;
  } | null;
  debugInfo: {
    queryExecuted: string;
    rowCount: number;
    rawResponse: any;
    httpStatus?: number;
    currentUserEmail: string | null;
    currentUserId: string | null;
  };
}

export interface PlatformTelemetry {
  totalScans: number;
  totalRatings: number;
  totalComplaints: number;
  subscriptions: Subscription[];
}

export async function fetchAllBusinesses(): Promise<FetchBusinessesResult> {
  const client = getSupabase();
  if (!client) {
    return {
      businesses: [],
      isLiveSupabase: false,
      error: 'Supabase client is not configured. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
      authWarning: null,
      debugInfo: {
        queryExecuted: 'None',
        rowCount: 0,
        rawResponse: null,
        currentUserEmail: null,
        currentUserId: null,
      },
    };
  }

  let currentUserEmail: string | null = null;
  let currentUserId: string | null = null;

  try {
    const { data: sessionData } = await client.auth.getSession();
    if (sessionData?.session?.user) {
      currentUserEmail = sessionData.session.user.email || null;
      currentUserId = sessionData.session.user.id || null;
    }
  } catch {
    // Ignore session read error
  }

  try {
    // Attempt with order by created_at, fallback to plain select if column doesn't exist
    let queryRes = await client.from('businesses').select('*').order('created_at', { ascending: false });
    if (queryRes.error && queryRes.error.message.includes('created_at')) {
      queryRes = await client.from('businesses').select('*');
    }

    if (queryRes.error) {
      return {
        businesses: [],
        isLiveSupabase: false,
        error: queryRes.error.message || 'Failed to query businesses table in Supabase.',
        authWarning: null,
        debugInfo: {
          queryExecuted: "supabase.from('businesses').select('*')",
          rowCount: 0,
          rawResponse: queryRes.error,
          httpStatus: queryRes.status,
          currentUserEmail,
          currentUserId,
        },
      };
    }

    const rawRows = (queryRes.data as any[]) || [];
    if (rawRows.length > 0) {
      const detectedCols = new Set<string>();
      Object.keys(rawRows[0]).forEach((k) => detectedCols.add(k.toLowerCase()));
      cachedBusinessesSchema = {
        existingColumns: detectedCols,
        hasName: detectedCols.has('name'),
        hasBusinessName: detectedCols.has('business_name'),
        hasActive: detectedCols.has('active'),
        hasIsActive: detectedCols.has('is_active'),
        hasCategory: detectedCols.has('category'),
        hasAddress: detectedCols.has('address'),
        hasPhone: detectedCols.has('phone'),
        hasPlaceId: detectedCols.has('place_id'),
        hasGooglePlaceId: detectedCols.has('google_place_id'),
        hasDescription: detectedCols.has('description'),
        hasLogoUrl: detectedCols.has('logo_url'),
        hasOwnerId: detectedCols.has('owner_id'),
        hasAccentColor: detectedCols.has('accent_color'),
      };
    }

    const rows: Business[] = rawRows.map((r) => ({
      ...r,
      name: r.name || r.business_name || 'Unnamed Business',
      category: r.category || 'Restaurant',
      is_active: r.is_active ?? r.active ?? true,
      place_id: r.place_id || r.google_place_id || undefined,
      description: r.description || undefined,
      logo_url: r.logo_url || undefined,
    }));

    // Merge with any locally added clients so newly added businesses appear in Founder Admin list
    const localBusinesses = getLocalItem<Business[]>(LOCAL_BUSINESSES_KEY, []);
    const mergedMap = new Map<string, Business>();
    rows.forEach((b) => mergedMap.set(b.id || b.slug, b));
    localBusinesses.forEach((b) => {
      const key = b.id || b.slug;
      if (!mergedMap.has(key) && !rows.some((r) => r.slug === b.slug)) {
        mergedMap.set(key, b);
      }
    });
    const finalBusinesses = Array.from(mergedMap.values());

    return {
      businesses: finalBusinesses,
      isLiveSupabase: true,
      error: null,
      authWarning: null,
      debugInfo: {
        queryExecuted: "supabase.from('businesses').select('*')",
        rowCount: finalBusinesses.length,
        rawResponse: queryRes.data,
        httpStatus: queryRes.status,
        currentUserEmail,
        currentUserId,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      businesses: [],
      isLiveSupabase: false,
      error: msg,
      authWarning: null,
      debugInfo: {
        queryExecuted: "supabase.from('businesses').select('*')",
        rowCount: 0,
        rawResponse: null,
        currentUserEmail,
        currentUserId,
      },
    };
  }
}

export async function fetchPlatformTelemetry(): Promise<PlatformTelemetry> {
  const client = getSupabase();
  if (!client) {
    return {
      totalScans: 0,
      totalRatings: 0,
      totalComplaints: 0,
      subscriptions: [],
    };
  }

  try {
    const [scansRes, rfRes, subsRes] = await Promise.all([
      client.from('qr_events').select('*', { count: 'exact', head: true }).eq('event_type', 'scan'),
      client.from('reviews_and_feedback').select('id, rating, action_type'),
      client.from('subscriptions').select('*'),
    ]);

    let totalRatings = 0;
    let totalComplaints = 0;
    if (rfRes.data) {
      rfRes.data.forEach((row: any) => {
        if (typeof row.rating === 'number' && !isNaN(row.rating) && row.rating > 0) {
          totalRatings++;
          if (row.rating < 4) totalComplaints++;
        } else if (row.action_type === 'complaint' || row.action_type === 'intercepted') {
          totalComplaints++;
        }
      });
    }

    return {
      totalScans: scansRes.count ?? 0,
      totalRatings: totalRatings || (rfRes.data?.length ?? 0),
      totalComplaints,
      subscriptions: (subsRes.data as Subscription[]) || [],
    };
  } catch {
    return {
      totalScans: 0,
      totalRatings: 0,
      totalComplaints: 0,
      subscriptions: [],
    };
  }
}

export interface BusinessesSchemaReport {
  existingColumns: Set<string>;
  hasName: boolean;
  hasBusinessName: boolean;
  hasActive: boolean;
  hasIsActive: boolean;
  hasCategory: boolean;
  hasAddress: boolean;
  hasPhone: boolean;
  hasPlaceId: boolean;
  hasGooglePlaceId: boolean;
  hasDescription: boolean;
  hasLogoUrl: boolean;
  hasOwnerId: boolean;
  hasAccentColor: boolean;
}

let cachedBusinessesSchema: BusinessesSchemaReport | null = null;

export async function inspectBusinessesSchema(force = false): Promise<BusinessesSchemaReport> {
  if (!force && cachedBusinessesSchema) {
    return cachedBusinessesSchema;
  }

  const client = getSupabase();
  const existingColumns = new Set<string>();

  if (!client) {
    const defaultReport: BusinessesSchemaReport = {
      existingColumns: new Set(['id', 'name', 'business_name', 'slug', 'category', 'google_review_url', 'is_active', 'created_at']),
      hasName: true,
      hasBusinessName: true,
      hasActive: false,
      hasIsActive: true,
      hasCategory: true,
      hasAddress: true,
      hasPhone: true,
      hasPlaceId: true,
      hasGooglePlaceId: false,
      hasDescription: true,
      hasLogoUrl: true,
      hasOwnerId: true,
      hasAccentColor: true,
    };
    return defaultReport;
  }

  try {
    // 1. First probe by selecting 1 row to get full column list if rows exist
    const { data: sampleRows, error: sampleError } = await client
      .from('businesses')
      .select('*')
      .limit(1);

    if (!sampleError && sampleRows && sampleRows.length > 0) {
      Object.keys(sampleRows[0]).forEach((k) => existingColumns.add(k.toLowerCase()));
    } else {
      // 2. If table is empty or error, probe candidate columns via limit(0)
      const candidateColumns = [
        'id',
        'name',
        'business_name',
        'slug',
        'category',
        'google_review_url',
        'active',
        'is_active',
        'address',
        'phone',
        'place_id',
        'google_place_id',
        'description',
        'logo_url',
        'owner_id',
        'accent_color',
        'created_at',
      ];

      await Promise.all(
        candidateColumns.map(async (col) => {
          try {
            const { error } = await client.from('businesses').select(col).limit(0);
            if (!error) {
              existingColumns.add(col.toLowerCase());
            }
          } catch {
            // column does not exist
          }
        })
      );
    }
  } catch (err) {
    console.warn('Businesses schema inspection notice:', err);
  }

  const report: BusinessesSchemaReport = {
    existingColumns,
    hasName: existingColumns.has('name'),
    hasBusinessName: existingColumns.has('business_name'),
    hasActive: existingColumns.has('active'),
    hasIsActive: existingColumns.has('is_active'),
    hasCategory: existingColumns.has('category'),
    hasAddress: existingColumns.has('address'),
    hasPhone: existingColumns.has('phone'),
    hasPlaceId: existingColumns.has('place_id'),
    hasGooglePlaceId: existingColumns.has('google_place_id'),
    hasDescription: existingColumns.has('description'),
    hasLogoUrl: existingColumns.has('logo_url'),
    hasOwnerId: existingColumns.has('owner_id'),
    hasAccentColor: existingColumns.has('accent_color'),
  };

  cachedBusinessesSchema = report;
  return report;
}

export interface MissingColumnDetail {
  column: string;
  field: string;
  userValue: string;
  isRequired: boolean;
  migrationSql: string;
}

export interface CreateBusinessResult {
  success: boolean;
  business?: Business;
  error?: string;
  missingColumns?: MissingColumnDetail[];
  notice?: string;
}

export async function createBusiness(
  businessData: Omit<Business, 'id' | 'created_at'>
): Promise<CreateBusinessResult> {
  const client = getSupabase();
  if (!client) {
    return { success: false, error: 'Supabase client is not initialized.' };
  }

  try {
    const slug = businessData.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const category = businessData.category?.trim() || 'Restaurant';

    // 1. Inspect actual Supabase businesses schema before generating insert query
    const schema = await inspectBusinessesSchema(true);
    const missingColumns: MissingColumnDetail[] = [];
    const payload: Record<string, any> = {};

    const clientName = businessData.name.trim();

    // Explicitly send both name and business_name with the client's name value to prevent NOT NULL constraint errors
    payload.name = clientName;
    payload.business_name = clientName;

    // Check if both name and business_name are confirmed missing from schema
    if (
      schema.existingColumns.size > 0 &&
      !schema.existingColumns.has('name') &&
      !schema.existingColumns.has('business_name')
    ) {
      missingColumns.push({
        column: 'name',
        field: 'Business Name',
        userValue: clientName,
        isRequired: true,
        migrationSql: 'ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS name TEXT NOT NULL;',
      });
    }

    // Map: Slug (Required)
    if (schema.existingColumns.size > 0 && !schema.existingColumns.has('slug')) {
      missingColumns.push({
        column: 'slug',
        field: 'Business Slug',
        userValue: slug,
        isRequired: true,
        migrationSql: 'ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE NOT NULL;',
      });
    } else {
      payload.slug = slug;
    }

    // Map: Google Review URL (Required)
    if (schema.existingColumns.size > 0 && !schema.existingColumns.has('google_review_url')) {
      missingColumns.push({
        column: 'google_review_url',
        field: 'Google Review URL',
        userValue: businessData.google_review_url,
        isRequired: true,
        migrationSql: 'ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS google_review_url TEXT NOT NULL;',
      });
    } else {
      payload.google_review_url = businessData.google_review_url.trim();
    }

    // Map: Category (Optional / Defaultable)
    if (category) {
      if (schema.hasCategory) {
        payload.category = category;
      } else {
        missingColumns.push({
          column: 'category',
          field: 'Category',
          userValue: category,
          isRequired: false,
          migrationSql: "ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Restaurant';",
        });
      }
    }

    // Map: Active status (Requirement 3: Never include active if it doesn't exist; use is_active if it exists)
    if (schema.hasIsActive) {
      payload.is_active = true;
    } else if (schema.hasActive) {
      payload.active = true;
    }
    // Note: If neither active nor is_active exists in the schema, neither is included in the insert payload!

    // Map: Google Place ID
    if (businessData.place_id && businessData.place_id.trim()) {
      const pId = businessData.place_id.trim();
      if (schema.hasPlaceId) {
        payload.place_id = pId;
      } else if (schema.hasGooglePlaceId) {
        payload.google_place_id = pId;
      } else {
        missingColumns.push({
          column: 'place_id',
          field: 'Google Place ID',
          userValue: pId,
          isRequired: false,
          migrationSql: 'ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS place_id TEXT;',
        });
      }
    }

    // Map: Address
    if (businessData.address && businessData.address.trim()) {
      const addr = businessData.address.trim();
      if (schema.hasAddress) {
        payload.address = addr;
      } else {
        missingColumns.push({
          column: 'address',
          field: 'Address',
          userValue: addr,
          isRequired: false,
          migrationSql: 'ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS address TEXT;',
        });
      }
    }

    // Map: Contact Phone
    if (businessData.phone && businessData.phone.trim()) {
      const ph = businessData.phone.trim();
      if (schema.hasPhone) {
        payload.phone = ph;
      } else {
        missingColumns.push({
          column: 'phone',
          field: 'Contact Phone',
          userValue: ph,
          isRequired: false,
          migrationSql: 'ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS phone TEXT;',
        });
      }
    }

    // Map: Description
    if (businessData.description && businessData.description.trim()) {
      const desc = businessData.description.trim();
      if (schema.hasDescription) {
        payload.description = desc;
      } else {
        missingColumns.push({
          column: 'description',
          field: 'Description',
          userValue: desc,
          isRequired: false,
          migrationSql: 'ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS description TEXT;',
        });
      }
    }

    // Map: Logo URL
    if (businessData.logo_url && businessData.logo_url.trim()) {
      const logo = businessData.logo_url.trim();
      if (schema.hasLogoUrl) {
        payload.logo_url = logo;
      } else {
        missingColumns.push({
          column: 'logo_url',
          field: 'Logo URL',
          userValue: logo,
          isRequired: false,
          migrationSql: 'ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS logo_url TEXT;',
        });
      }
    }

    // Map: Owner ID
    if (businessData.owner_id && businessData.owner_id.trim() && schema.hasOwnerId) {
      payload.owner_id = businessData.owner_id.trim();
    }

    // Map: Accent Color
    if (businessData.accent_color && schema.hasAccentColor) {
      payload.accent_color = businessData.accent_color;
    }

    // Check if any REQUIRED column is missing from Supabase
    const requiredMissing = missingColumns.filter((m) => m.isRequired);
    if (requiredMissing.length > 0) {
      return {
        success: false,
        error: `Cannot save client: Required database column(s) ${requiredMissing.map((m) => `'${m.column}'`).join(', ')} missing in Supabase. Run the proposed migration in your SQL editor.`,
        missingColumns,
      };
    }

    // 2. Perform insert into Supabase businesses table
    let insertRes = await client
      .from('businesses')
      .insert(payload)
      .select('*')
      .maybeSingle();

    // 3. Adaptive recovery if Supabase schema cache flags an unrecognized column
    while (
      insertRes.error &&
      (insertRes.error.code === 'PGRST204' ||
        insertRes.error.message.includes('column') ||
        insertRes.error.message.includes('schema cache'))
    ) {
      const match = insertRes.error.message.match(/Could not find the '([^']+)' column/i);
      const badCol = match ? match[1] : null;
      if (badCol && badCol in payload) {
        console.warn(`Adaptive recovery: removing unrecognized column '${badCol}' from payload and retrying`);
        delete payload[badCol];
        if (!missingColumns.some((m) => m.column === badCol)) {
          missingColumns.push({
            column: badCol,
            field: badCol,
            userValue: '',
            isRequired: false,
            migrationSql: `ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS ${badCol} TEXT;`,
          });
        }
        insertRes = await client
          .from('businesses')
          .insert(payload)
          .select('*')
          .maybeSingle();
      } else {
        break;
      }
    }

    const { data, error } = insertRes;

    if (error) {
      console.error('Supabase businesses insert error:', error.message);
      let userFriendlyError = error.message;
      if (
        error.code === '23505' ||
        error.message.toLowerCase().includes('duplicate') ||
        error.message.toLowerCase().includes('unique')
      ) {
        userFriendlyError = `A business with the unique slug "${slug}" already exists. Please choose a different slug.`;
      } else if (
        error.code === '23502' ||
        error.message.toLowerCase().includes('not-null')
      ) {
        userFriendlyError = `Required database column missing: ${error.message}`;
      } else if (
        error.code === '23514' ||
        error.message.toLowerCase().includes('check constraint') ||
        error.message.toLowerCase().includes('violates check constraint')
      ) {
        userFriendlyError = `The category "${category}" violates an existing database check constraint. Run the safe schema migration in Supabase Setup to enable all business types. (${error.message})`;
      } else if (
        error.code === '42501' ||
        error.message.toLowerCase().includes('row-level security')
      ) {
        userFriendlyError = `Supabase Row-Level Security: You need to be signed in as an authorized admin/founder to register businesses in the live database. (${error.message})`;
      } else if (error.code === 'PGRST204') {
        userFriendlyError = `Schema mismatch: ${error.message}. Only database-supported columns are included.`;
      }
      return { success: false, error: userFriendlyError, missingColumns };
    }

    // 4. Verify Supabase confirmed the saved row
    if (!data || !data.id) {
      return {
        success: false,
        error: 'Supabase did not return the saved business confirmation row.',
        missingColumns,
      };
    }

    const createdBiz: Business = {
      id: data.id,
      owner_id: data.owner_id || businessData.owner_id || '',
      name: data.name || data.business_name || businessData.name,
      slug: data.slug || slug,
      category: data.category || category,
      address: data.address || businessData.address,
      phone: data.phone || businessData.phone,
      google_review_url: data.google_review_url || businessData.google_review_url,
      place_id: data.place_id || data.google_place_id || businessData.place_id || undefined,
      description: data.description || businessData.description,
      logo_url: data.logo_url || businessData.logo_url,
      accent_color: data.accent_color || businessData.accent_color || '#2563EB',
      is_active: data.is_active ?? data.active ?? true,
      created_at: data.created_at || new Date().toISOString(),
    };

    // Cache locally for instant UI reflection and merge
    const list = getLocalItem<Business[]>(LOCAL_BUSINESSES_KEY, []);
    const filtered = list.filter((b) => b.id !== createdBiz.id && b.slug !== createdBiz.slug);
    filtered.unshift(createdBiz);
    setLocalItem(LOCAL_BUSINESSES_KEY, filtered);

    let notice: string | undefined;
    if (missingColumns.length > 0) {
      notice = `Client saved to Supabase! Note: The column(s) ${missingColumns.map((m) => `'${m.column}'`).join(', ')} do not exist in public.businesses yet. To store these fields in the future, run the suggested safe migration.`;
    }

    return {
      success: true,
      business: createdBiz,
      missingColumns: missingColumns.length > 0 ? missingColumns : undefined,
      notice,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Failed to create business:', msg);
    return { success: false, error: msg };
  }
}

export async function updateBusinessStatus(
  businessId: string,
  active: boolean
): Promise<{ success: boolean; error?: string; migrationSql?: string }> {
  const client = getSupabase();

  if (client) {
    try {
      const schema = await inspectBusinessesSchema();
      let updatePayload: Record<string, any> = {};

      if (schema.hasIsActive) {
        // Use is_active only
        updatePayload = { is_active: active };
      } else if (schema.hasActive) {
        // Use active only
        updatePayload = { active: active };
      } else {
        // Neither column exists in the schema
        return {
          success: false,
          error: "Neither 'is_active' nor 'active' column exists in your Supabase 'businesses' table. Run the migration to add 'is_active'.",
          migrationSql: "ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;",
        };
      }

      let { error } = await client
        .from('businesses')
        .update(updatePayload)
        .eq('id', businessId);

      // Adaptive retry if schema differs
      if (error && (error.code === 'PGRST204' || error.message.includes('column'))) {
        if ('is_active' in updatePayload) {
          const res = await client.from('businesses').update({ active }).eq('id', businessId);
          error = res.error;
        } else if ('active' in updatePayload) {
          const res = await client.from('businesses').update({ is_active: active }).eq('id', businessId);
          error = res.error;
        }
      }

      if (error) {
        console.error('Failed to update business active status in Supabase:', error.message);
        return { success: false, error: error.message };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  // Update in local storage cache
  const localList = getLocalItem<Business[]>(LOCAL_BUSINESSES_KEY, []);
  const idx = localList.findIndex((b) => b.id === businessId);
  if (idx !== -1) {
    localList[idx].is_active = active;
    setLocalItem(LOCAL_BUSINESSES_KEY, localList);
  }

  return { success: true };
}

export interface BusinessDependencyInspection {
  canDelete: boolean;
  reviewsAndFeedbackCount: number;
  feedbackCount: number;
  complaintsCount: number;
  scansCount: number;
  subscriptionsCount: number;
  linkedProfilesCount: number;
  totalRelatedRecords: number;
  error?: string;
}

export async function checkBusinessDependencies(
  businessId: string
): Promise<BusinessDependencyInspection> {
  const client = getSupabase();
  let reviewsAndFeedbackCount = 0;
  let feedbackCount = 0;
  let complaintsCount = 0;
  let scansCount = 0;
  let subscriptionsCount = 0;
  let linkedProfilesCount = 0;

  if (client) {
    // 1. Inspect actual Supabase table: public.reviews_and_feedback
    try {
      const { count: revCount, error: revErr } = await client
        .from('reviews_and_feedback')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId);

      if (!revErr && revCount !== null) {
        reviewsAndFeedbackCount = revCount;
      }
    } catch {
      // Safe non-blocking
    }

    // 2. Defensive check for legacy feedback table if it exists in parallel
    try {
      const { count: fbCount, error: fbErr } = await client
        .from('feedback')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId);

      if (!fbErr && fbCount !== null) {
        feedbackCount = fbCount;
      }
    } catch {
      // Ignored if table does not exist
    }
  }

  // Also check local sandbox caches for demo mode
  const localFeedback = getLocalItem<Feedback[]>(LOCAL_FEEDBACK_KEY, []).filter((f) => f.business_id === businessId);
  const localComplaints = getLocalItem<Complaint[]>(LOCAL_COMPLAINTS_KEY, []).filter((c) => c.business_id === businessId);
  const localScans = getLocalItem<QREvent[]>(LOCAL_QR_KEY, []).filter((e) => e.business_id === businessId);

  feedbackCount = Math.max(feedbackCount, localFeedback.length);
  complaintsCount = Math.max(complaintsCount, localComplaints.length);
  scansCount = Math.max(scansCount, localScans.length);

  const totalRelatedRecords = reviewsAndFeedbackCount + feedbackCount + complaintsCount + scansCount + subscriptionsCount;
  const canDelete = totalRelatedRecords === 0;

  return {
    canDelete,
    reviewsAndFeedbackCount,
    feedbackCount,
    complaintsCount,
    scansCount,
    subscriptionsCount,
    linkedProfilesCount,
    totalRelatedRecords,
  };
}

export interface DeleteBusinessResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  errorDetails?: string;
  rlsBlocked?: boolean;
  requiredSql?: string;
  details?: {
    reviewsAndFeedbackDeleted: number;
    feedbackDeleted: number;
    complaintsDeleted: number;
    scansDeleted: number;
    subscriptionsDeleted: number;
    profilesUnlinked: number;
    serverMethod: 'rpc_transaction' | 'rest_cascade' | 'local_sandbox';
  };
}

function cleanLocalCachesForBusiness(businessId: string) {
  const localBusinesses = getLocalItem<Business[]>(LOCAL_BUSINESSES_KEY, []);
  setLocalItem(LOCAL_BUSINESSES_KEY, localBusinesses.filter((b) => b.id !== businessId));

  const localFeedback = getLocalItem<Feedback[]>(LOCAL_FEEDBACK_KEY, []);
  setLocalItem(LOCAL_FEEDBACK_KEY, localFeedback.filter((f) => f.business_id !== businessId));

  const localComplaints = getLocalItem<Complaint[]>(LOCAL_COMPLAINTS_KEY, []);
  setLocalItem(LOCAL_COMPLAINTS_KEY, localComplaints.filter((c) => c.business_id !== businessId));

  const localQR = getLocalItem<QREvent[]>(LOCAL_QR_KEY, []);
  setLocalItem(LOCAL_QR_KEY, localQR.filter((e) => e.business_id !== businessId));
}

export async function deleteBusinessPermanently(
  businessId: string,
  options: { cleanExclusiveRecords?: boolean } = { cleanExclusiveRecords: true }
): Promise<DeleteBusinessResult> {
  const client = getSupabase();

  if (client) {
    try {
      // 1. Verify user session
      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData?.session?.user) {
        return {
          success: false,
          error: 'Authentication required: You must be signed in with an authorized Supabase Founder account to delete a business.',
          errorCode: 'UNAUTHENTICATED',
        };
      }

      const currentUser = sessionData.session.user;
      const currentUserId = currentUser.id;
      const currentUserEmail = currentUser.email || '';

      // 2. Check if the business exists in Supabase
      const { data: existingBiz, error: fetchErr } = await client
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .maybeSingle();

      if (fetchErr) {
        console.warn('Supabase business pre-delete lookup notice:', fetchErr.message);
      }

      // If business does not exist in Supabase at all, clean local cache and return success
      if (!existingBiz && !fetchErr) {
        cleanLocalCachesForBusiness(businessId);
        return {
          success: true,
          details: {
            reviewsAndFeedbackDeleted: 0,
            feedbackDeleted: 0,
            complaintsDeleted: 0,
            scansDeleted: 0,
            subscriptionsDeleted: 0,
            profilesUnlinked: 0,
            serverMethod: 'local_sandbox',
          },
        };
      }

      // 3. Attempt secure server-side transactional RPC delete_business_permanently
      let rpcSucceeded = false;
      let rpcResult: any = null;

      try {
        const { data, error } = await client.rpc('delete_business_permanently', {
          p_business_id: businessId,
        });

        if (!error && data?.success) {
          rpcSucceeded = true;
          rpcResult = data;
        } else if (error) {
          console.warn('RPC delete_business_permanently notice:', error.message);
          if (error.message.includes('Unauthorized') || error.code === '42501') {
            return {
              success: false,
              rlsBlocked: true,
              error: `Supabase RPC Authorization Denied: ${error.message}`,
              errorCode: error.code || '42501',
              errorDetails: error.details,
              requiredSql: FOUNDER_DELETE_RLS_FIX_SQL,
            };
          }
        }
      } catch (rpcEx: any) {
        console.warn('RPC call exception, continuing to direct REST cascade:', rpcEx);
      }

      if (rpcSucceeded) {
        cleanLocalCachesForBusiness(businessId);

        // Verification query: confirm that business UUID no longer exists in Supabase
        const { data: verifyRow } = await client
          .from('businesses')
          .select('id')
          .eq('id', businessId)
          .maybeSingle();

        if (verifyRow) {
          return {
            success: false,
            error: 'Database verification failed: The business record was not deleted from Supabase despite RPC execution.',
            errorCode: 'VERIFY_FAILED',
          };
        }

        return {
          success: true,
          details: {
            reviewsAndFeedbackDeleted: rpcResult?.reviews_and_feedback_deleted ?? 0,
            feedbackDeleted: 0,
            complaintsDeleted: 0,
            scansDeleted: 0,
            subscriptionsDeleted: 0,
            profilesUnlinked: 0,
            serverMethod: 'rpc_transaction',
          },
        };
      }

      // 4. Fallback: Cascading execution via Supabase REST API under caller RLS credentials
      let reviewsAndFeedbackDeleted = 0;
      let feedbackDeleted = 0;

      if (options.cleanExclusiveRecords !== false) {
        // Clean dependent records belonging solely to this business from public.reviews_and_feedback
        try {
          const { data: delRev, error: revErr } = await client
            .from('reviews_and_feedback')
            .delete()
            .eq('business_id', businessId)
            .select('id');

          if (!revErr && delRev) {
            reviewsAndFeedbackDeleted = delRev.length;
          }
        } catch (revEx) {
          console.warn('reviews_and_feedback delete notice:', revEx);
        }

        // Also clean legacy feedback if present
        try {
          const { data: delFb } = await client
            .from('feedback')
            .delete()
            .eq('business_id', businessId)
            .select('id');
          if (delFb) {
            feedbackDeleted = delFb.length;
          }
        } catch {
          // Ignored if table does not exist
        }
      }

      // 5. Delete the business row itself from public.businesses using .select('*') to verify affected rows
      const { data: deletedRows, error: bizDeleteError } = await client
        .from('businesses')
        .delete()
        .eq('id', businessId)
        .select('*');

      if (bizDeleteError) {
        console.error('Supabase businesses DELETE error:', bizDeleteError);
        let userMessage = bizDeleteError.message;
        const isRls =
          bizDeleteError.code === '42501' ||
          bizDeleteError.message.toLowerCase().includes('permission') ||
          bizDeleteError.message.toLowerCase().includes('row-level security');

        if (bizDeleteError.code === '23503' || bizDeleteError.message.includes('foreign key')) {
          userMessage = `Foreign-key constraint prevented deletion: ${bizDeleteError.message}. Dependent records in 'reviews_and_feedback' still reference this business. Run the updated deletion script in Supabase SQL editor.`;
        } else if (isRls) {
          userMessage = `Row-Level Security (RLS) or permission denied: Authenticated role lacks DELETE privilege or RLS policy on 'public.businesses'.`;
        }

        return {
          success: false,
          error: userMessage,
          errorCode: bizDeleteError.code,
          errorDetails: bizDeleteError.details || bizDeleteError.hint,
          rlsBlocked: isRls,
          requiredSql: FOUNDER_DELETE_RLS_FIX_SQL,
        };
      }

      // If PostgREST returned 200/204 with 0 deleted rows, RLS silently filtered out the DELETE operation
      if (!deletedRows || deletedRows.length === 0) {
        // Check if the row still exists in Supabase
        const { data: stillExists } = await client
          .from('businesses')
          .select('id, name, owner_id')
          .eq('id', businessId)
          .maybeSingle();

        if (stillExists) {
          const ownerInfo = stillExists.owner_id ? `owner_id: ${stillExists.owner_id}` : 'owner_id is NULL';
          return {
            success: false,
            rlsBlocked: true,
            errorCode: 'RLS_DELETE_REJECTED_0_ROWS',
            error: `Row-Level Security (RLS) Policy Denied Deletion: Supabase executed the DELETE query, but 0 rows were affected. Your current user (${currentUserEmail}, UID: ${currentUserId}) is not permitted to delete this business (${stillExists.name || businessId}, ${ownerInfo}) under current RLS policies.`,
            errorDetails: `Target business UUID: ${businessId}. Current auth.uid(): ${currentUserId}. Table RLS requires a matching owner_id or founder email/role policy.`,
            requiredSql: FOUNDER_DELETE_RLS_FIX_SQL,
          };
        }
      }

      // 6. Verification query: check that business UUID no longer exists in Supabase
      const { data: checkRow } = await client
        .from('businesses')
        .select('id')
        .eq('id', businessId)
        .maybeSingle();

      if (checkRow) {
        return {
          success: false,
          rlsBlocked: true,
          errorCode: 'VERIFICATION_STILL_EXISTS',
          error: 'Verification failed: Supabase still returned the business row after DELETE. Please apply the Founder DELETE RLS policy in Supabase SQL editor.',
          requiredSql: FOUNDER_DELETE_RLS_FIX_SQL,
        };
      }

      // Clear local caches
      cleanLocalCachesForBusiness(businessId);

      return {
        success: true,
        details: {
          reviewsAndFeedbackDeleted,
          feedbackDeleted,
          complaintsDeleted: 0,
          scansDeleted: 0,
          subscriptionsDeleted: 0,
          profilesUnlinked: 0,
          serverMethod: 'rest_cascade',
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg, errorCode: 'EXCEPTION' };
    }
  }

  // Local sandbox mode deletion
  cleanLocalCachesForBusiness(businessId);
  return {
    success: true,
    details: {
      reviewsAndFeedbackDeleted: 0,
      feedbackDeleted: 0,
      complaintsDeleted: 0,
      scansDeleted: 0,
      subscriptionsDeleted: 0,
      profilesUnlinked: 0,
      serverMethod: 'local_sandbox',
    },
  };
}

export async function deleteBusiness(
  businessId: string
): Promise<{ success: boolean; error?: string }> {
  return deleteBusinessPermanently(businessId, { cleanExclusiveRecords: true });
}

// --- GOOGLE PLACES API (NEW) VIA SUPABASE EDGE FUNCTION ---

export interface FetchGoogleReviewsResult {
  data: GooglePlaceDetails | null;
  error: string | null;
  code?: string;
  source: 'google_places_api' | 'none';
}

export async function fetchGooglePlaceReviews(params: {
  businessId?: string;
  placeId?: string;
  googleReviewUrl?: string;
}): Promise<FetchGoogleReviewsResult> {
  const client = getSupabase();
  if (!client) {
    return {
      data: null,
      error: 'Supabase client is not configured. Please connect to Supabase to fetch live Google Reviews.',
      code: 'NO_SUPABASE_CLIENT',
      source: 'none',
    };
  }

  // Resolve effective place ID if provided or present in URL
  let effectivePlaceId = params.placeId?.trim() || '';
  if (!effectivePlaceId && params.googleReviewUrl) {
    const match = params.googleReviewUrl.match(/placeid=([A-Za-z0-9_-]+)/i);
    if (match && match[1]) {
      effectivePlaceId = match[1];
    }
  }

  try {
    const { data, error } = await client.functions.invoke('get-google-reviews', {
      body: {
        placeId: effectivePlaceId || undefined,
        businessId: params.businessId || undefined,
      },
    });

    if (error) {
      const errorMsg = error.message || String(error);
      if (
        errorMsg.includes('404') ||
        errorMsg.includes('Failed to send a request to the Edge Function') ||
        errorMsg.includes('relay error') ||
        errorMsg.includes('Function not found')
      ) {
        return {
          data: null,
          error:
            'The "get-google-reviews" Supabase Edge Function is not deployed yet. Run: supabase functions deploy get-google-reviews',
          code: 'FUNCTION_NOT_DEPLOYED',
          source: 'none',
        };
      }

      return {
        data: null,
        error: errorMsg,
        code: 'INVOKE_ERROR',
        source: 'none',
      };
    }

    if (data?.error) {
      return {
        data: null,
        error: data.error,
        code: data.code || 'API_ERROR',
        source: 'none',
      };
    }

    return {
      data: data as GooglePlaceDetails,
      error: null,
      source: 'google_places_api',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      data: null,
      error: msg,
      code: 'NETWORK_EXCEPTION',
      source: 'none',
    };
  }
}

