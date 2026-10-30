import React from 'react';
import Link from 'next/link';
import { Bed, Bath, Square, MapPin } from 'lucide-react';
import { Property } from '../lib/api';

interface PropertyCardProps {
  property: Property;
}

export default function PropertyCard({ property }: PropertyCardProps) {
  const primaryImage =
    property.images && property.images.length > 0
      ? property.images[0].url
      : 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop&q=80';

  const typeLabels: Record<string, string> = {
    APARTMENT: 'Apartment',
    HOUSE: 'House',
    STUDIO: 'Studio',
    VILLA: 'Villa',
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col">
      <div className="relative aspect-[16/10] bg-slate-100 overflow-hidden">
        {/* Using standard img for reliable client-side rendering with varying external domains */}
        <img
          src={primaryImage}
          alt={property.title}
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          loading="lazy"
        />
        <div className="absolute top-2.5 left-2.5">
          <span className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-900/80 text-white backdrop-blur-sm">
            {typeLabels[property.propertyType] || property.propertyType}
          </span>
        </div>
        <div className="absolute bottom-2.5 right-2.5">
          <span className="px-2.5 py-1 text-sm font-bold rounded bg-indigo-600 text-white shadow">
            ₹{property.price.toLocaleString('en-IN')}{' '}
            <span className="text-xs font-normal">/ mo</span>
          </span>
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center text-xs text-slate-500 mb-1 gap-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">
              {property.city}, {property.state}
            </span>
          </div>

          <h3 className="font-semibold text-slate-900 line-clamp-1 text-base hover:text-indigo-600 transition">
            <Link href={`/properties/${property.id}`}>{property.title}</Link>
          </h3>

          <p className="text-xs text-slate-500 line-clamp-2 mt-1 mb-3">
            {property.description}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-slate-600 border-t border-slate-100 pt-3 mb-3">
            <div className="flex items-center gap-1">
              <Bed className="w-3.5 h-3.5 text-slate-400" />
              <span>{property.beds} {property.beds === 1 ? 'Bed' : 'Beds'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Bath className="w-3.5 h-3.5 text-slate-400" />
              <span>{property.baths} {property.baths === 1 ? 'Bath' : 'Baths'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Square className="w-3.5 h-3.5 text-slate-400" />
              <span>{property.sqft} sq ft</span>
            </div>
          </div>

          <Link
            href={`/properties/${property.id}`}
            className="block w-full text-center py-2 px-3 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded transition"
          >
            View Details
          </Link>
        </div>
      </div>
    </div>
  );
}
