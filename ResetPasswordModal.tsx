import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ isOpen, onClose }) => {
  const { updatePassword, user } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long (कम से कम 6 अक्षर).');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify both fields (दोनों पासवर्ड एक जैसे होने चाहिए).');
      return;
    }

    setLoading(true);
    try {
      const res = await updatePassword(newPassword);
      if (res.success) {
        setSuccess(true);
      } else {
        setErrorMsg(res.error || 'Failed to update password. Recovery link may have expired.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    setSuccess(false);
    setNewPassword('');
    setConfirmPassword('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Set New Password (नया पासवर्ड सेट करें)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {user?.email ? `Account: ${user.email}` : 'Enter your new password below'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          {success ? (
            <div className="text-center space-y-4 py-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl font-bold">
                ✓
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Password Updated Successfully!
                </h3>
                <p className="text-xs text-slate-600">
                  आपका नया पासवर्ड सफलतापूर्वक सेव हो गया है। आप अब नए पासवर्ड से कभी भी लॉगिन कर सकते हैं।
                </p>
              </div>
              <button
                type="button"
                onClick={handleFinish}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs"
              >
                Go to Dashboard (डैशबोर्ड पर जाएं) →
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg space-y-1">
                  <div className="font-semibold">Password Update Error:</div>
                  <div className="font-mono text-[11px]">{errorMsg}</div>
                </div>
              )}

              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-900">
                You were securely redirected via your Supabase recovery link. Set a strong password for your HeReview account.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Password (नया पासवर्ड) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 pr-16"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-500 hover:text-slate-700 font-medium"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm New Password (पासवर्ड दोबारा डालें) <span className="text-rose-500">*</span>
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {newPassword && confirmPassword && (
                <div className="text-[11px] font-medium">
                  {newPassword === confirmPassword ? (
                    <span className="text-emerald-600">✓ Passwords match</span>
                  ) : (
                    <span className="text-rose-600">✗ Passwords do not match</span>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !newPassword || !confirmPassword}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs disabled:opacity-50 mt-2"
              >
                {loading ? 'Updating Password in Supabase...' : 'Update Password (पासवर्ड सेव करें)'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
