'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { LayoutGrid, Map, Loader2 } from 'lucide-react';
import { api, Property } from '../lib/api';
import PropertyCard from '../components/PropertyCard';
import FilterSidebar, { FilterState } from '../components/FilterSidebar';
import PropertyMap from '../components/PropertyMap';

const initialFilters: FilterState = {
  city: '',
  minPrice: '',
  maxPrice: '',
  beds: '',
  type: '',
  amenities: [],
  availableFrom: '',
  availableTo: '',
  sort: 'created_desc',
};

export default function SearchPage() {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [properties, setProperties] = useState<Property[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [showMap, setShowMap] = useState<boolean>(false);

  const fetchProperties = useCallback(async (currentFilters: FilterState, pageNum: number) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: pageNum,
        limit: 12,
        sort: currentFilters.sort,
      };

      if (currentFilters.city) params.city = currentFilters.city;
      if (currentFilters.minPrice) params.minPrice = Number(currentFilters.minPrice);
      if (currentFilters.maxPrice) params.maxPrice = Number(currentFilters.maxPrice);
      if (currentFilters.beds) params.beds = Number(currentFilters.beds);
      if (currentFilters.type) params.type = currentFilters.type;
      if (currentFilters.amenities.length > 0) params.amenities = currentFilters.amenities.join(',');
      if (currentFilters.availableFrom) params.availableFrom = currentFilters.availableFrom;
      if (currentFilters.availableTo) params.availableTo = currentFilters.availableTo;

      const data = await api.searchProperties(params);
      setProperties(data.properties);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error('Failed to fetch properties:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProperties(filters, page);
  }, [fetchProperties, page]);

  const handleFilterChange = (updated: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...updated }));
  };

  const handleApplyFilters = () => {
    setPage(1);
    fetchProperties(filters, 1);
  };

  const handleResetFilters = () => {
    setFilters(initialFilters);
    setPage(1);
    fetchProperties(initialFilters, 1);
  };

  return (
    <div className="space-y-6">
      {/* Search Header Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Find Your Next Home
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Over {total > 0 ? total.toLocaleString() : '5,000+'} verified residential properties available across India.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMap(!showMap)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md border transition ${
              showMap
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {showMap ? <LayoutGrid className="w-4 h-4" /> : <Map className="w-4 h-4" />}
            <span>{showMap ? 'Show Grid Only' : 'Show Map View'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Filter Sidebar */}
        <div className="lg:col-span-1">
          <FilterSidebar
            filters={filters}
            onChange={handleFilterChange}
            onApply={handleApplyFilters}
            onReset={handleResetFilters}
          />
        </div>

        {/* Right Content Area */}
        <div className="lg:col-span-3 space-y-6">
          {showMap && (
            <div className="h-[480px]">
              <PropertyMap properties={properties} />
            </div>
          )}

          {/* Results section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-medium text-slate-500">
                Showing {properties.length} of {total.toLocaleString()} listings (Page {page} of {totalPages})
              </span>
            </div>

            {loading ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                <span className="text-sm font-medium">Loading listings...</span>
              </div>
            ) : properties.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
                <h3 className="text-base font-semibold text-slate-900 mb-1">No properties found</h3>
                <p className="text-sm text-slate-500 mb-4">
                  Try broadening your search criteria or resetting filters.
                </p>
                <button
                  onClick={handleResetFilters}
                  className="px-4 py-2 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded transition"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {properties.map((property) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Previous
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                    let pageNum = idx + 1;
                    if (totalPages > 5 && page > 3) {
                      pageNum = page - 2 + idx;
                      if (pageNum > totalPages) pageNum = totalPages - (4 - idx);
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-8 h-8 text-xs font-medium rounded border transition ${
                          page === pageNum
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
