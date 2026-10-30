'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  CalendarCheck,
  Plus,
  Trash2,
  Edit2,
  Upload,
  Check,
  X,
  Loader2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { api, Property, Booking } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

const AMENITY_OPTIONS = [
  'wifi',
  'parking',
  'gym',
  'pool',
  'air_conditioning',
  'balcony',
  'elevator',
  'security',
  'power_backup',
  'furnished',
];

export default function ManagerDashboard() {
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<'listings' | 'bookings'>('listings');
  const [properties, setProperties] = useState<Property[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modal / Form state for Create / Edit Property
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPropertyId, setEditingPropertyId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    address: '',
    city: 'Bengaluru',
    state: 'Karnataka',
    zipCode: '560001',
    latitude: '12.9716',
    longitude: '77.5946',
    propertyType: 'APARTMENT',
    beds: '2',
    baths: '2',
    sqft: '1000',
    amenities: ['wifi', 'parking'] as string[],
  });
  const [formImageFile, setFormImageFile] = useState<File | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setActionError(null);
    try {
      const [propData, bookData] = await Promise.all([
        api.searchProperties({ limit: 100 }),
        api.getManagerBookings(token, statusFilter || undefined),
      ]);
      // Filter properties owned by this manager
      if (user) {
        setProperties(propData.properties.filter((p) => p.managerId === user.id));
      }
      setBookings(bookData.bookings);
    } catch (err: any) {
      setActionError(err.message || 'Failed to load manager dashboard data');
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, user]);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'MANAGER')) {
      router.push('/login');
      return;
    }

    if (token) {
      loadData();
    }
  }, [user, token, authLoading, router, loadData]);

  const handleOpenCreateModal = () => {
    setEditingPropertyId(null);
    setFormData({
      title: '',
      description: '',
      price: '',
      address: '',
      city: 'Bengaluru',
      state: 'Karnataka',
      zipCode: '560001',
      latitude: '12.9716',
      longitude: '77.5946',
      propertyType: 'APARTMENT',
      beds: '2',
      baths: '2',
      sqft: '1000',
      amenities: ['wifi', 'parking'],
    });
    setFormImageFile(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (prop: Property) => {
    setEditingPropertyId(prop.id);
    setFormData({
      title: prop.title,
      description: prop.description,
      price: String(prop.price),
      address: prop.address,
      city: prop.city,
      state: prop.state,
      zipCode: prop.zipCode,
      latitude: String(prop.latitude),
      longitude: String(prop.longitude),
      propertyType: prop.propertyType,
      beds: String(prop.beds),
      baths: String(prop.baths),
      sqft: String(prop.sqft),
      amenities: prop.amenities || [],
    });
    setFormImageFile(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleDeleteProperty = async (id: number) => {
    if (!token) return;
    if (!confirm('Are you sure you want to permanently delete this listing?')) return;

    try {
      await api.deleteProperty(id, token);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete property');
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setFormSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        price: Number(formData.price),
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zipCode: formData.zipCode,
        latitude: Number(formData.latitude),
        longitude: Number(formData.longitude),
        propertyType: formData.propertyType,
        beds: parseInt(formData.beds, 10),
        baths: parseInt(formData.baths, 10),
        sqft: parseInt(formData.sqft, 10),
        amenities: formData.amenities,
      };

      let propId = editingPropertyId;

      if (editingPropertyId) {
        await api.updateProperty(editingPropertyId, payload, token);
      } else {
        const res = await api.createProperty(payload, token);
        propId = res.property.id;
      }

      if (propId && formImageFile) {
        await api.uploadPropertyImage(propId, formImageFile, token);
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save property listing');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleUpdateBookingStatus = async (id: number, status: 'APPROVED' | 'REJECTED') => {
    if (!token) return;
    setActionError(null);

    try {
      await api.updateBookingStatus(id, status, token);
      await loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update booking status');
    }
  };

  const toggleFormAmenity = (amenity: string) => {
    setFormData((prev) => {
      const exists = prev.amenities.includes(amenity);
      return {
        ...prev,
        amenities: exists
          ? prev.amenities.filter((a) => a !== amenity)
          : [...prev.amenities, amenity],
      };
    });
  };

  if (authLoading || loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-slate-400 gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <span className="text-sm">Loading manager dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-600" />
            Manager Portal
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage your rental listings and review incoming tenant reservations.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Listing</span>
        </button>
      </div>

      {actionError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('listings')}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-semibold border-b-2 transition ${
            activeTab === 'listings'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>My Listings ({properties.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('bookings')}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-semibold border-b-2 transition ${
            activeTab === 'bookings'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <CalendarCheck className="w-4 h-4" />
          <span>Incoming Bookings ({bookings.length})</span>
        </button>
      </div>

      {/* Tab 1: Listings */}
      {activeTab === 'listings' && (
        <div className="space-y-4">
          {properties.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
              <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-900 mb-1">No listings created yet</h3>
              <p className="text-xs text-slate-500 mb-4">
                Click &quot;Add New Listing&quot; to publish your first property rental on NestFinder.
              </p>
              <button
                onClick={handleOpenCreateModal}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-sm transition"
              >
                Create Listing Now
              </button>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="p-3.5">Property</th>
                    <th className="p-3.5">City</th>
                    <th className="p-3.5">Price</th>
                    <th className="p-3.5">Specs</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {properties.map((prop) => (
                    <tr key={prop.id} className="hover:bg-slate-50 transition">
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-900">{prop.title}</div>
                        <div className="text-[11px] text-slate-400">{prop.address}</div>
                      </td>
                      <td className="p-3.5">{prop.city}</td>
                      <td className="p-3.5 font-semibold text-indigo-600">
                        ₹{prop.price.toLocaleString('en-IN')}/mo
                      </td>
                      <td className="p-3.5">
                        {prop.beds} Beds · {prop.baths} Baths · {prop.propertyType}
                      </td>
                      <td className="p-3.5 text-right space-x-2">
                        <Link
                          href={`/properties/${prop.id}`}
                          className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 p-1 rounded hover:bg-slate-100"
                          title="View detail page"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleOpenEditModal(prop)}
                          className="text-indigo-600 hover:text-indigo-800 p-1 rounded hover:bg-indigo-50"
                          title="Edit listing"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProperty(prop.id)}
                          className="text-rose-600 hover:text-rose-800 p-1 rounded hover:bg-rose-50"
                          title="Delete listing"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Incoming Bookings */}
      {activeTab === 'bookings' && (
        <div className="space-y-4">
          {/* Status Filter */}
          <div className="flex items-center gap-2 pb-2">
            <span className="text-xs text-slate-500 font-medium">Filter by Status:</span>
            {['', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 text-xs font-semibold rounded border transition ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {st === '' ? 'All' : st}
              </button>
            ))}
          </div>

          {bookings.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-xs text-slate-500">
              No booking requests found for the selected filter.
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map((b) => (
                <div
                  key={b.id}
                  className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 text-[11px] font-bold rounded border ${
                          b.status === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : b.status === 'PENDING'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                      >
                        {b.status}
                      </span>
                      <span className="text-xs font-semibold text-slate-900">
                        {b.property?.title || `Property #${b.propertyId}`}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600">
                      <span className="font-medium text-slate-900">Tenant: </span>
                      {b.tenant?.name || 'Tenant'} ({b.tenant?.email})
                    </div>

                    <div className="text-xs text-slate-500">
                      <span className="font-medium text-slate-700">Dates: </span>
                      {b.startDate} to {b.endDate}
                    </div>

                    {b.message && (
                      <div className="text-xs text-slate-500 italic mt-1">
                        &quot;{b.message}&quot;
                      </div>
                    )}
                  </div>

                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-3">
                    <div className="text-right">
                      <span className="block text-[11px] text-slate-400 uppercase font-semibold">Total</span>
                      <span className="text-base font-bold text-slate-900">
                        ₹{b.totalPrice.toLocaleString('en-IN')}
                      </span>
                    </div>

                    {b.status === 'PENDING' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdateBookingStatus(b.id, 'APPROVED')}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded transition"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleUpdateBookingStatus(b.id, 'REJECTED')}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded transition"
                        >
                          <X className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal for Creating / Editing Property */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg border border-slate-200 max-w-2xl w-full p-6 shadow-xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-base font-bold text-slate-900">
                {editingPropertyId ? 'Edit Property Listing' : 'Create New Property Listing'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Modern 2 BHK Flat in Indiranagar"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed description of features, neighborhood, transit..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Monthly Rent (₹)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Property Type
                  </label>
                  <select
                    value={formData.propertyType}
                    onChange={(e) => setFormData({ ...formData, propertyType: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="APARTMENT">Apartment</option>
                    <option value="HOUSE">House</option>
                    <option value="STUDIO">Studio</option>
                    <option value="VILLA">Villa</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Bedrooms
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={formData.beds}
                    onChange={(e) => setFormData({ ...formData, beds: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Bathrooms
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={formData.baths}
                    onChange={(e) => setFormData({ ...formData, baths: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Sqft Area
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formData.sqft}
                    onChange={(e) => setFormData({ ...formData, sqft: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. 42 Main Road"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Zip Code
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.zipCode}
                    onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Select Amenities
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {AMENITY_OPTIONS.map((am) => (
                    <label key={am} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.amenities.includes(am)}
                        onChange={() => toggleFormAmenity(am)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="capitalize">{am.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Upload Primary Image (Optional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFormImageFile(e.target.files ? e.target.files[0] : null)}
                    className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold border border-slate-200 text-slate-700 rounded hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {formSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingPropertyId ? 'Save Changes' : 'Publish Listing'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
