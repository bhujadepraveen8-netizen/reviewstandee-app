import React, { useState, useEffect } from 'react';
import { Business } from '../types';
import {
  fetchBusinessBySlug,
  fetchAllBusinesses,
  logQREvent,
  submitFeedback,
  submitComplaint,
  SANDBOX_BUSINESSES,
} from '../lib/dataService';

interface PublicQRLandingProps {
  initialSlug?: string;
  tableNumber?: string;
  onExitPreview?: () => void;
  isGenuineQRScan?: boolean;
}

export const PublicQRLanding: React.FC<PublicQRLandingProps> = ({
  initialSlug = 'bella-vista',
  tableNumber,
  onExitPreview,
  isGenuineQRScan = false,
}) => {
  const [selectedSlug, setSelectedSlug] = useState(initialSlug);

  useEffect(() => {
    if (initialSlug) {
      setSelectedSlug(initialSlug);
    }
  }, [initialSlug]);

  const [business, setBusiness] = useState<Business | null>(null);
  const [availableBusinesses, setAvailableBusinesses] = useState<Business[]>(SANDBOX_BUSINESSES);
  const [loading, setLoading] = useState(true);

  // Category awareness: only restaurants use table numbers by default
  const isRestaurant = (business?.category || '').toLowerCase() === 'restaurant';
  // Use provided tableNumber, or default to '12' only if the business is a restaurant
  const effectiveTableNumber = isRestaurant ? (tableNumber || '12') : undefined;

  // Flow state: 'home' | 'rating' | 'private_feedback' | 'success_google' | 'success_private'
  const [activeView, setActiveView] = useState<'home' | 'rating' | 'private_feedback' | 'success_google' | 'success_private'>('home');

  // Rating flow state
  const [rating, setRating] = useState<number>(5);
  const [ratingComment, setRatingComment] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [submitRatingError, setSubmitRatingError] = useState<string | null>(null);

  // Private feedback flow state
  const [complaintCategory, setComplaintCategory] = useState<'Food Quality' | 'Wait Time' | 'Service' | 'Cleanliness' | 'Billing' | 'Staff Behavior' | 'Other'>('Service');
  const [complaintMessage, setComplaintMessage] = useState('');
  const [complaintName, setComplaintName] = useState('');
  const [complaintPhone, setComplaintPhone] = useState('');
  const [complaintEmail, setComplaintEmail] = useState('');
  const [submittingComplaint, setSubmittingComplaint] = useState(false);
  const [submitComplaintError, setSubmitComplaintError] = useState<string | null>(null);
  const [qrScanError, setQrScanError] = useState<string | null>(null);
  const [qrScanLogged, setQrScanLogged] = useState(false);

  // Load all available businesses for the simulator selector
  useEffect(() => {
    let isMounted = true;
    const loadAll = async () => {
      try {
        const res = await fetchAllBusinesses();
        if (isMounted && res.businesses && res.businesses.length > 0) {
          const map = new Map<string, Business>();
          res.businesses.forEach((b) => map.set(b.slug, b));
          SANDBOX_BUSINESSES.forEach((b) => {
            if (!map.has(b.slug)) map.set(b.slug, b);
          });
          setAvailableBusinesses(Array.from(map.values()));
        }
      } catch {
        // keep sandbox default
      }
    };
    loadAll();
    return () => {
      isMounted = false;
    };
  }, []);

  // 1. Load business & log QR scan event ONLY for authentic QR landing route (not previews or simulator)
  useEffect(() => {
    let isMounted = true;
    const loadBusiness = async () => {
      setLoading(true);
      setQrScanError(null);
      setQrScanLogged(false);
      setSubmitRatingError(null);
      const b = await fetchBusinessBySlug(selectedSlug);
      if (isMounted) {
        setBusiness(b);
        setLoading(false);
        if (b) {
          // Requirement 5: Count only genuine QR landing-page visits recorded by the actual QR landing-page route.
          // Do not count dashboard previews, admin page visits, simulated guest sessions, or button clicks as QR scans.
          if (isGenuineQRScan && selectedSlug === initialSlug) {
            // Deduplicate per browser session so refreshing does not inflate scan metrics
            const sessionKey = `hereview_scanned_${b.id}`;
            const alreadyScanned = sessionStorage.getItem(sessionKey);
            if (!alreadyScanned) {
              const bizIsRest = (b.category || '').toLowerCase() === 'restaurant';
              const scanTable = bizIsRest ? (tableNumber || '12') : undefined;
              const qrRes = await logQREvent(b.id, 'scan', scanTable);
              if (isMounted) {
                if (!qrRes.success && qrRes.error) {
                  console.warn('Supabase qr_events insert warning:', qrRes.error);
                  setQrScanError(qrRes.error);
                  setQrScanLogged(false);
                } else if (qrRes.success) {
                  sessionStorage.setItem(sessionKey, new Date().toISOString());
                  setQrScanLogged(true);
                  setQrScanError(null);
                }
              }
            } else {
              setQrScanLogged(true);
            }
          }
        }
      }
    };
    loadBusiness();
    return () => {
      isMounted = false;
    };
  }, [selectedSlug, tableNumber, isGenuineQRScan, initialSlug]);

  // 2. Submit rating & comment to feedback table
  const handleRatingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) return;

    setSubmittingRating(true);
    setSubmitRatingError(null);

    try {
      const res = await submitFeedback({
        business_id: business.id,
        restaurant_name: business.name,
        client_id: business.slug || business.id,
        rating,
        comment: ratingComment,
        customer_name: customerName,
        customer_contact: customerContact,
        table_number: effectiveTableNumber,
        action_type: rating >= 4 ? 'positive_google' : 'complaint',
      });

      // 4. Handle Supabase insert errors and show clear error messages instead of falsely showing success
      if (!res.success) {
        setSubmitRatingError(
          res.error || 'Failed to save rating to Supabase database. Please check connection and permissions.'
        );
        setSubmittingRating(false);
        return;
      }

      // 5. Keep existing Google Reviews button behavior for 4-5 stars and private feedback behavior for 1-3 stars
      if (rating >= 4) {
        // High rating! Route to Google Reviews
        setActiveView('success_google');
      } else {
        // Intercepted negative review! Route to private resolution confirmation
        setActiveView('success_private');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSubmitRatingError(msg);
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleComplaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business || !complaintMessage) return;

    setSubmittingComplaint(true);
    setSubmitComplaintError(null);
    try {
      const res = await submitComplaint({
        business_id: business.id,
        restaurant_name: business.name,
        category: complaintCategory,
        message: complaintMessage,
        customer_name: complaintName,
        customer_phone: complaintPhone,
        customer_email: complaintEmail,
        table_number: effectiveTableNumber,
      });

      if (!res.success) {
        setSubmitComplaintError(res.error || 'Failed to transmit message to the database.');
        setSubmittingComplaint(false);
        return;
      }

      setActiveView('success_private');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSubmitComplaintError(msg);
    } finally {
      setSubmittingComplaint(false);
    }
  };

  const copyAndOpenGoogle = () => {
    if (!business) return;
    if (ratingComment) {
      navigator.clipboard.writeText(ratingComment);
    }
    window.open(business.google_review_url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-start p-4 sm:p-6">
      {/* Simulation Bar (lets tester switch slug & table without modifying URL) */}
      <div className="w-full max-w-md mb-4 bg-white border border-slate-200 rounded-lg p-2.5 shadow-xs space-y-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-semibold text-slate-700">QR Simulator:</span>
            <select
              value={selectedSlug}
              onChange={(e) => {
                setSelectedSlug(e.target.value);
                setActiveView('home');
              }}
              className="font-mono text-xs border border-slate-300 rounded px-2 py-0.5 bg-slate-50 text-slate-800"
            >
              {availableBusinesses.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name} (/r/{b.slug})
                </option>
              ))}
            </select>
          </div>
          {onExitPreview && (
            <button
              onClick={onExitPreview}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 whitespace-nowrap shrink-0"
            >
              Exit Guest View
            </button>
          )}
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
          {isGenuineQRScan ? (
            <span className="text-emerald-700 font-medium flex items-center gap-1">
              <span>●</span> Live Customer QR Scan (Recorded)
            </span>
          ) : (
            <span className="text-amber-700 font-medium flex items-center gap-1">
              <span>👁️</span> Preview Mode (Scan metrics not counted)
            </span>
          )}
          {qrScanLogged && isGenuineQRScan && (
            <span className="text-[10px] text-emerald-600 font-mono">Logged to qr_events</span>
          )}
        </div>
      </div>

      {/* Main Guest Mobile Card */}
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden transition-all">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs">Loading business details...</div>
        ) : !business ? (
          <div className="p-8 text-center space-y-3">
            <h3 className="text-base font-bold text-slate-900">Business Not Found</h3>
            <p className="text-xs text-slate-500">The QR slug "{selectedSlug}" is not registered.</p>
          </div>
        ) : (
          <div>
            {/* Top Business Banner */}
            <div className="bg-slate-900 text-white p-6 text-center relative">
              <div className="w-14 h-14 mx-auto rounded-full bg-blue-600 flex items-center justify-center text-xl font-bold mb-3 shadow-md border-2 border-white/20">
                {business.name.slice(0, 1)}
              </div>
              <h1 className="text-xl font-bold tracking-tight">{business.name}</h1>
              {business.address && (
                <p className="text-xs text-slate-300 mt-1">{business.address}</p>
              )}
              <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
                {isRestaurant && effectiveTableNumber && (
                  <span className="bg-white/10 text-white text-[11px] font-mono px-2.5 py-0.5 rounded-full border border-white/15">
                    Table #{effectiveTableNumber}
                  </span>
                )}
                {business.category && (
                  <span className="bg-white/10 text-slate-300 text-[10px] font-medium px-2 py-0.5 rounded border border-white/10">
                    {business.category}
                  </span>
                )}
                <span className="bg-white/10 text-slate-300 text-[10px] font-mono px-2 py-0.5 rounded border border-white/10">
                  ID: {business.id.slice(0, 8)}...
                </span>
              </div>
            </div>

            {/* Supabase QR Scan Live Status Banner (hidden on success screen) */}
            {qrScanLogged && activeView !== 'success_private' && (
              <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-2 text-center text-[11px] font-medium text-emerald-800 flex items-center justify-center gap-1.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>QR scan event saved to Supabase (qr_events table)</span>
              </div>
            )}

            {qrScanError && activeView !== 'success_private' && (
              <div className="bg-amber-50 border-b border-amber-200 p-3 text-xs text-amber-900 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <span>⚠️</span>
                  <span>Supabase qr_events Notice</span>
                </div>
                <div className="text-[11px] text-amber-800 break-words font-mono bg-white/70 p-1.5 rounded border border-amber-100">
                  {qrScanError}
                </div>
                <div className="text-[10px] text-amber-700">
                  Public diner devices require an RLS INSERT policy on <code className="font-mono bg-amber-100 px-1 rounded">qr_events</code>.
                </div>
              </div>
            )}

            {/* View 1: Home Choice Screen */}
            {activeView === 'home' && (
              <div className="p-6 space-y-6">
                <div className="text-center space-y-1">
                  <h2 className="text-base font-bold text-slate-900">How was your visit today?</h2>
                  <p className="text-xs text-slate-500">
                    Your feedback helps our team maintain the highest dining standards.
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Option 1: Rate Your Experience */}
                  <button
                    onClick={() => setActiveView('rating')}
                    className="w-full p-4 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-300 text-left transition-all shadow-xs group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-blue-950">Rate Your Experience</span>
                      <div className="flex text-amber-500 text-sm">★★★★★</div>
                    </div>
                    <p className="text-xs text-blue-800/80 mt-1">
                      Give us a 1 to 5 star rating and share your thoughts.
                    </p>
                  </button>

                  {/* Option 2: Share Private Feedback */}
                  <button
                    onClick={() => setActiveView('private_feedback')}
                    className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 text-left transition-all shadow-xs group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900">Share Private Feedback</span>
                      <span className="text-xs font-mono text-slate-400">Direct to Manager</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Have a private suggestion, complaint, or service note? Speak directly to our manager.
                    </p>
                  </button>
                </div>

                <div className="text-center pt-2">
                  <p className="text-[11px] text-slate-400 font-mono">
                    Instant scan verified · Powered by HeReview
                  </p>
                </div>
              </div>
            )}

            {/* View 2: Star Rating Flow */}
            {activeView === 'rating' && (
              <form onSubmit={handleRatingSubmit} className="p-6 space-y-5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActiveView('home')}
                    className="text-xs text-slate-500 hover:text-slate-800 font-medium"
                  >
                    ← Back
                  </button>
                  <span className="text-xs font-semibold text-slate-700">Rate Your Experience</span>
                </div>

                {/* Clear Supabase Insert Error Notice */}
                {submitRatingError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-rose-950">
                      <span className="text-sm">❌</span>
                      <span>Supabase Error: Rating Not Saved</span>
                    </div>
                    <div className="text-[11px] text-rose-800 break-words font-mono bg-white/70 p-2 rounded border border-rose-100">
                      {submitRatingError}
                    </div>
                    <div className="text-[10px] text-rose-700 leading-relaxed">
                      Your rating could not be inserted into the <code className="font-mono font-semibold">feedback</code> table. If your Supabase database has Row Level Security (RLS) active, ensure an INSERT policy is granted to public diners, or verify the client exists in <code className="font-mono font-semibold">businesses</code>.
                    </div>
                  </div>
                )}

                <div className="text-center space-y-2 py-2">
                  <label className="block text-xs text-slate-600 font-medium">
                    Tap a star to rate:
                  </label>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className={`text-3xl p-1 transition-transform hover:scale-125 focus:outline-hidden ${
                          star <= rating ? 'text-amber-500' : 'text-slate-200'
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <div className="text-xs font-bold text-slate-800">
                    {rating === 5 && 'Outstanding! (5/5)'}
                    {rating === 4 && 'Great Experience! (4/5)'}
                    {rating === 3 && 'Average / Neutral (3/5)'}
                    {rating === 2 && 'Disappointing (2/5)'}
                    {rating === 1 && 'Poor Experience (1/5)'}
                  </div>

                  {rating <= 3 && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 text-left mt-2">
                      <span className="font-semibold">Notice:</span> Since your experience wasn't ideal, your feedback will be sent directly and privately to business leadership so we can resolve it immediately without public exposure.
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      What made your experience stand out? (Optional)
                    </label>
                    <textarea
                      rows={3}
                      value={ratingComment}
                      onChange={(e) => setRatingComment(e.target.value)}
                      placeholder={
                        rating >= 4
                          ? "What dishes or service did you love? We'll help you copy this to Google!"
                          : "Please let us know what went wrong so we can make it right..."
                      }
                      className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Your Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Alex"
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Contact Phone / Email (Optional, for manager follow-up)
                    </label>
                    <input
                      type="text"
                      value={customerContact}
                      onChange={(e) => setCustomerContact(e.target.value)}
                      placeholder="e.g. 555-0199 or name@example.com"
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submittingRating}
                  className="w-full py-3 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  {submittingRating ? 'Saving to Database...' : rating >= 4 ? 'Continue to Google Reviews →' : 'Submit Private Feedback'}
                </button>
              </form>
            )}

            {/* View 3: Private Feedback / Complaint Form */}
            {activeView === 'private_feedback' && (
              <form onSubmit={handleComplaintSubmit} className="p-6 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActiveView('home')}
                    className="text-xs text-slate-500 hover:text-slate-800 font-medium"
                  >
                    ← Back
                  </button>
                  <span className="text-xs font-semibold text-slate-700">Manager Private Channel</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-xs text-slate-600">
                  This message is sent exclusively to the General Manager and will not be posted publicly.
                </div>

                {submitComplaintError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-rose-950">
                      <span className="text-sm">❌</span>
                      <span>Supabase Error: Message Not Saved</span>
                    </div>
                    <div className="text-[11px] text-rose-800 break-words font-mono bg-white/70 p-2 rounded border border-rose-100">
                      {submitComplaintError}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Issue Category</label>
                  <select
                    value={complaintCategory}
                    onChange={(e) => setComplaintCategory(e.target.value as any)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="Service">Service & Hospitality</option>
                    <option value="Food Quality">Food Quality & Taste</option>
                    <option value="Wait Time">Wait Time & Delays</option>
                    <option value="Cleanliness">Cleanliness & Ambiance</option>
                    <option value="Billing">Billing & Check Error</option>
                    <option value="Staff Behavior">Staff Behavior</option>
                    <option value="Other">Other Suggestion</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Describe what happened <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={complaintMessage}
                    onChange={(e) => setComplaintMessage(e.target.value)}
                    placeholder="Please tell us what went wrong so we can fix it immediately..."
                    className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Your Name</label>
                    <input
                      type="text"
                      value={complaintName}
                      onChange={(e) => setComplaintName(e.target.value)}
                      placeholder="Your name"
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={complaintPhone}
                      onChange={(e) => setComplaintPhone(e.target.value)}
                      placeholder="(555) 000-0000"
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    value={complaintEmail}
                    onChange={(e) => setComplaintEmail(e.target.value)}
                    placeholder="guest@example.com"
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingComplaint || !complaintMessage.trim()}
                  className="w-full py-3 px-4 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  {submittingComplaint ? 'Transmitting...' : 'Send to General Manager'}
                </button>
              </form>
            )}

            {/* View 4: Success - Positive 4-5 Stars (Prompt to Google Reviews) */}
            {activeView === 'success_google' && (
              <div className="p-6 text-center space-y-5">
                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl font-bold">
                  ✓
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900">Thank you for dining with us!</h3>
                  <p className="text-xs text-slate-600">
                    Your {rating}-star rating has been recorded. Could you take 10 seconds to post this on our official Google Business profile? It means the world to our small team!
                  </p>
                </div>

                {ratingComment && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-left text-xs text-slate-700 space-y-1">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Your Review Draft:</div>
                    <div className="italic font-serif">"{ratingComment}"</div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={copyAndOpenGoogle}
                  className="w-full py-3.5 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-md flex items-center justify-center gap-2"
                >
                  <span>★</span>
                  <span>{ratingComment ? 'Copy Text & Open Google Reviews' : 'Open Google Reviews'}</span>
                </button>

                <div>
                  <button
                    type="button"
                    onClick={() => setActiveView('home')}
                    className="text-xs text-slate-500 hover:text-slate-800 underline"
                  >
                    Done / Return to Standee Home
                  </button>
                </div>
              </div>
            )}

            {/* View 5: Success - Private Intercepted Feedback */}
            {activeView === 'success_private' && (
              <div className="p-6 text-center space-y-5">
                <div className="w-14 h-14 mx-auto rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl font-bold">
                  ✉
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900">Feedback Received Privately</h3>
                  <p className="text-xs text-slate-600">
                    Thank you for letting us know. Your notes have been transmitted directly to our on-duty manager for review. We apologize for any inconvenience caused today.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 font-mono">
                  {isRestaurant && effectiveTableNumber
                    ? `Reference: Incident logged for Table #${effectiveTableNumber}`
                    : `Reference: Incident logged for ${business.name}`}
                </div>

                <button
                  type="button"
                  onClick={() => setActiveView('home')}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors"
                >
                  Back to Main Screen
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
