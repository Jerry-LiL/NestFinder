'use client';

import React from 'react';
import { Filter, RotateCcw } from 'lucide-react';

export interface FilterState {
  city: string;
  minPrice: string;
  maxPrice: string;
  beds: string;
  type: string;
  amenities: string[];
  availableFrom: string;
  availableTo: string;
  sort: string;
}

interface FilterSidebarProps {
  filters: FilterState;
  onChange: (updated: Partial<FilterState>) => void;
  onApply: () => void;
  onReset: () => void;
}

const CITIES = [
  'All Cities',
  'Bengaluru',
  'Mumbai',
  'Delhi',
  'Hyderabad',
  'Pune',
  'Chennai',
  'Kolkata',
  'Ahmedabad',
  'Jaipur',
  'Goa',
];

const PROPERTY_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'APARTMENT', label: 'Apartment' },
  { value: 'HOUSE', label: 'House' },
  { value: 'STUDIO', label: 'Studio' },
  { value: 'VILLA', label: 'Villa' },
];

const AMENITY_OPTIONS = [
  { id: 'wifi', label: 'WiFi' },
  { id: 'parking', label: 'Parking' },
  { id: 'gym', label: 'Gym' },
  { id: 'pool', label: 'Swimming Pool' },
  { id: 'air_conditioning', label: 'Air Conditioning' },
  { id: 'balcony', label: 'Balcony' },
  { id: 'elevator', label: 'Elevator' },
  { id: 'security', label: '24/7 Security' },
  { id: 'power_backup', label: 'Power Backup' },
  { id: 'furnished', label: 'Furnished' },
];

export default function FilterSidebar({
  filters,
  onChange,
  onApply,
  onReset,
}: FilterSidebarProps) {
  const toggleAmenity = (id: string) => {
    const next = filters.amenities.includes(id)
      ? filters.amenities.filter((item) => item !== id)
      : [...filters.amenities, id];
    onChange({ amenities: next });
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-indigo-600" />
          <h2 className="font-semibold text-slate-900 text-sm">Search Filters</h2>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
      </div>

      {/* City */}
      <div>
        <label htmlFor="filter-city" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
          City
        </label>
        <select
          id="filter-city"
          value={filters.city}
          onChange={(e) => onChange({ city: e.target.value === 'All Cities' ? '' : e.target.value })}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {CITIES.map((c) => (
            <option key={c} value={c === 'All Cities' ? '' : c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Price Range */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
          Monthly Rent (₹)
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <input
              type="number"
              placeholder="Min"
              value={filters.minPrice}
              onChange={(e) => onChange({ minPrice: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <input
              type="number"
              placeholder="Max"
              value={filters.maxPrice}
              onChange={(e) => onChange({ maxPrice: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Bedrooms */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
          Min Bedrooms
        </label>
        <div className="grid grid-cols-5 gap-1">
          {['', '1', '2', '3', '4'].map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => onChange({ beds: val })}
              className={`py-1.5 text-xs font-medium rounded border transition ${
                filters.beds === val
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {val === '' ? 'Any' : `${val}+`}
            </button>
          ))}
        </div>
      </div>

      {/* Property Type */}
      <div>
        <label htmlFor="filter-type" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
          Property Type
        </label>
        <select
          id="filter-type"
          value={filters.type}
          onChange={(e) => onChange({ type: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {PROPERTY_TYPES.map((pt) => (
            <option key={pt.value} value={pt.value}>
              {pt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Availability Dates */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
          Available Dates
        </label>
        <div className="space-y-2">
          <div>
            <span className="text-xs text-slate-500">From</span>
            <input
              type="date"
              value={filters.availableFrom}
              onChange={(e) => onChange({ availableFrom: e.target.value })}
              className="w-full mt-1 px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <span className="text-xs text-slate-500">To</span>
            <input
              type="date"
              value={filters.availableTo}
              onChange={(e) => onChange({ availableTo: e.target.value })}
              className="w-full mt-1 px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Amenities */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
          Amenities
        </label>
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {AMENITY_OPTIONS.map((a) => (
            <label key={a.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.amenities.includes(a.id)}
                onChange={() => toggleAmenity(a.id)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>{a.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Sort */}
      <div>
        <label htmlFor="filter-sort" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
          Sort By
        </label>
        <select
          id="filter-sort"
          value={filters.sort}
          onChange={(e) => onChange({ sort: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="created_desc">Newest Listings</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="beds_desc">Most Bedrooms</option>
        </select>
      </div>

      <button
        type="button"
        onClick={onApply}
        className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm transition"
      >
        Apply Filters
      </button>
    </div>
  );
}
