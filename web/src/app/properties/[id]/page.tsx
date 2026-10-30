'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Bed,
  Bath,
  Square,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  User,
} from 'lucide-react';
import { api, Property } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import DetailMap from '../../../components/DetailMap';

const AMENITY_LABELS: Record<string, string> = {
  wifi: 'High-speed WiFi',
  parking: 'Reserved Parking',
  gym: 'Fitness Center / Gym',
  pool: 'Swimming Pool',
  air_conditioning: 'Air Conditioning',
  balcony: 'Private Balcony',
  elevator: 'Elevator Access',
  security: '24/7 Security & CCTV',
  power_backup: '100% Power Backup',
  furnished: 'Fully Furnished',
};

export default function PropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, token } = useAuth();
  const propertyId = parseInt(params.id as string, 10);

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string>('');

  // Booking Form State
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [bookingLoading, setBookingLoading] = useState<boolean>(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (isNaN(propertyId)) {
      setError('Invalid property ID');
      setLoading(false);
      return;
    }

    api
      .getProperty(propertyId)
      .then((data) => {
        setProperty(data.property);
        if (data.property.images && data.property.images.length > 0) {
          setSelectedImage(data.property.images[0].url);
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to load property');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [propertyId]);

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-slate-400 gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <span className="text-sm">Loading property details...</span>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center bg-white border border-slate-200 rounded-lg p-8">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Property Not Found</h2>
        <p className="text-sm text-slate-500 mb-4">{error || 'Unable to locate the requested property.'}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Listings
        </Link>
      </div>
    );
  }

  // Calculate booking pricing
  let numDays = 0;
  let totalPrice = 0;
  if (startDate && endDate) {
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e > s) {
      numDays = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
      totalPrice = numDays * property.price;
    }
  }

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !token) {
      router.push('/login');
      return;
    }

    if (!startDate || !endDate) {
      setBookingError('Please select both start and end dates');
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      setBookingError('End date must be after start date');
      return;
    }

    setBookingLoading(true);
    setBookingError(null);

    try {
      await api.createBooking(
        {
          propertyId: property.id,
          startDate,
          endDate,
          message: message.trim() || undefined,
        },
        token
      );
      setBookingSuccess(true);
      setTimeout(() => {
        router.push('/bookings');
      }, 1500);
    } catch (err: any) {
      setBookingError(err.message || 'Failed to submit booking request');
    } finally {
      setBookingLoading(false);
    }
  };

  const images = property.images && property.images.length > 0
    ? property.images
    : [{ id: 0, url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=80', isPrimary: true }];

  const currentDisplayImg = selectedImage || images[0].url;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Search
        </Link>
      </div>

      {/* Main Title & Price Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
              {property.propertyType}
            </span>
            <div className="flex items-center text-xs text-slate-500 gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>{property.address}, {property.city}, {property.state} {property.zipCode}</span>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {property.title}
          </h1>
        </div>

        <div className="text-left md:text-right">
          <div className="text-2xl sm:text-3xl font-bold text-indigo-600">
            ₹{property.price.toLocaleString('en-IN')}
            <span className="text-xs font-normal text-slate-500"> / month</span>
          </div>
        </div>
      </div>

      {/* Image Gallery */}
      <div className="space-y-3">
        <div className="aspect-[16/9] max-h-[480px] w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
          <img
            src={currentDisplayImg}
            alt={property.title}
            className="w-full h-full object-cover"
          />
        </div>

        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((img) => (
              <button
                key={img.id}
                onClick={() => setSelectedImage(img.url)}
                className={`relative w-20 h-16 rounded overflow-hidden border-2 shrink-0 transition ${
                  currentDisplayImg === img.url ? 'border-indigo-600' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <img src={img.url} alt="thumbnail" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid Content: Details on Left, Booking Form on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-8">
          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-white border border-slate-200 text-center">
            <div className="flex flex-col items-center justify-center p-2">
              <Bed className="w-5 h-5 text-indigo-600 mb-1" />
              <span className="text-xs text-slate-500">Bedrooms</span>
              <span className="text-sm font-semibold text-slate-900">{property.beds}</span>
            </div>
            <div className="flex flex-col items-center justify-center p-2 border-x border-slate-100">
              <Bath className="w-5 h-5 text-indigo-600 mb-1" />
              <span className="text-xs text-slate-500">Bathrooms</span>
              <span className="text-sm font-semibold text-slate-900">{property.baths}</span>
            </div>
            <div className="flex flex-col items-center justify-center p-2">
              <Square className="w-5 h-5 text-indigo-600 mb-1" />
              <span className="text-xs text-slate-500">Living Area</span>
              <span className="text-sm font-semibold text-slate-900">{property.sqft} sq ft</span>
            </div>
          </div>

          {/* Description */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-3">About this Property</h2>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {property.description}
            </p>
          </div>

          {/* Amenities */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Amenities & Features</h2>
            {property.amenities && property.amenities.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {property.amenities.map((amenity) => (
                  <div key={amenity} className="flex items-center gap-2 text-xs text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{AMENITY_LABELS[amenity] || amenity}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No specific amenities listed.</p>
            )}
          </div>

          {/* Map Location */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Neighborhood & Location</h2>
            <p className="text-xs text-slate-500 mb-4">
              {property.address}, {property.city}, {property.state}
            </p>
            <DetailMap
              latitude={property.latitude}
              longitude={property.longitude}
              title={property.title}
            />
          </div>

          {/* Host / Manager Information */}
          {property.manager && (
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Managed by {property.manager.name}</h3>
                <p className="text-xs text-slate-500">{property.manager.email}</p>
                <span className="inline-block mt-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                  Verified Property Manager
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (Booking Form Card) */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm sticky top-24">
            <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              Request a Booking
            </h3>

            {bookingSuccess ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-md p-4 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-emerald-900">Booking Requested</h4>
                <p className="text-xs text-emerald-700 mt-1">
                  Your request has been submitted to the manager. Redirecting to your bookings...
                </p>
              </div>
            ) : user?.role === 'MANAGER' ? (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-xs text-amber-800">
                You are currently signed in as a Property Manager. Please sign in with a Tenant account to request bookings.
              </div>
            ) : (
              <form onSubmit={handleBookingSubmit} className="space-y-4">
                {bookingError && (
                  <div className="bg-rose-50 border border-rose-200 rounded-md p-3 text-xs text-rose-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>{bookingError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Check-in Date
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Check-out Date
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Note for Host (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Tell the host about your stay plans..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {numDays > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-md p-3 space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Rate</span>
                      <span>₹{property.price.toLocaleString('en-IN')} / night</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Duration</span>
                      <span>{numDays} {numDays === 1 ? 'night' : 'nights'}</span>
                    </div>
                    <div className="border-t border-slate-200 pt-1.5 flex justify-between font-semibold text-slate-900 text-sm">
                      <span>Total Estimated</span>
                      <span>₹{totalPrice.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={bookingLoading}
                  className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm disabled:opacity-50 transition flex items-center justify-center gap-2"
                >
                  {bookingLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {user ? 'Submit Booking Request' : 'Sign In to Request Booking'}
                </button>

                <p className="text-[11px] text-slate-400 text-center">
                  You will not be charged until the manager approves your reservation.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
