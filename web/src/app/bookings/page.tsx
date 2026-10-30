'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calendar, MapPin, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { api, Booking } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

export default function TenantBookingsPage() {
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'TENANT')) {
      router.push('/login');
      return;
    }

    if (token) {
      loadBookings();
    }
  }, [user, token, authLoading, router]);

  const loadBookings = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.getMyBookings(token);
      setBookings(data.bookings);
    } catch (err: any) {
      setError(err.message || 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (id: number) => {
    if (!token) return;
    if (!confirm('Are you sure you want to cancel this booking request?')) return;

    setCancellingId(id);
    try {
      await api.updateBookingStatus(id, 'CANCELLED', token);
      await loadBookings();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel booking');
    } finally {
      setCancellingId(null);
    }
  };

  const statusStyles: Record<string, { bg: string; text: string; border: string }> = {
    PENDING: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
    APPROVED: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
    REJECTED: { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200' },
    CANCELLED: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
  };

  if (authLoading || loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-slate-400 gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <span className="text-sm">Loading your reservations...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-indigo-600" />
            My Bookings
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track reservation requests, approval statuses, and cancellation policies.
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded transition"
        >
          <span>Find More Rentals</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {bookings.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900 mb-1">No bookings yet</h3>
          <p className="text-xs text-slate-500 mb-5">
            You have not requested any property bookings. Explore our listings to find your next home.
          </p>
          <Link
            href="/"
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-sm transition"
          >
            Explore Available Properties
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => {
            const style = statusStyles[b.status] || statusStyles.CANCELLED;
            const imgUrl = b.property?.primaryImage || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=80';

            return (
              <div
                key={b.id}
                className="bg-white border border-slate-200 rounded-lg overflow-hidden p-5 shadow-sm flex flex-col sm:flex-row gap-5 items-start justify-between"
              >
                <div className="flex gap-4 items-start w-full sm:w-auto">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-md overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                    <img src={imgUrl} alt={b.property?.title || 'Property'} className="w-full h-full object-cover" />
                  </div>

                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-[11px] font-bold rounded border ${style.bg} ${style.text} ${style.border}`}>
                        {b.status}
                      </span>
                      <span className="text-xs text-slate-400">Ref #{b.id}</span>
                    </div>

                    <h3 className="text-sm font-semibold text-slate-900">
                      {b.property ? (
                        <Link href={`/properties/${b.property.id}`} className="hover:text-indigo-600 transition">
                          {b.property.title}
                        </Link>
                      ) : (
                        'Property Listing'
                      )}
                    </h3>

                    {b.property?.city && (
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{b.property.city}</span>
                      </div>
                    )}

                    <div className="text-xs text-slate-600 pt-1">
                      <span className="font-medium text-slate-900">Dates: </span>
                      {b.startDate} to {b.endDate}
                    </div>

                    {b.message && (
                      <div className="text-xs text-slate-500 italic">
                        &quot;{b.message}&quot;
                      </div>
                    )}
                  </div>
                </div>

                <div className="w-full sm:w-auto text-left sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 flex sm:flex-col justify-between items-end gap-2">
                  <div>
                    <span className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                      Total Estimated
                    </span>
                    <span className="text-lg font-bold text-slate-900">
                      ₹{b.totalPrice.toLocaleString('en-IN')}
                    </span>
                  </div>

                  {b.status === 'PENDING' && (
                    <button
                      type="button"
                      disabled={cancellingId === b.id}
                      onClick={() => handleCancelBooking(b.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-rose-600 border border-rose-200 hover:bg-rose-50 rounded transition disabled:opacity-50"
                    >
                      {cancellingId === b.id ? 'Cancelling...' : 'Cancel Request'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
