import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PropertyCard from '../components/PropertyCard';
import { Property } from '../lib/api';

const mockProperty: Property = {
  id: 101,
  managerId: 1,
  title: 'Contemporary 2BHK in Indiranagar',
  description: 'Well-ventilated flat close to parks and cafes.',
  price: 38000,
  address: '100 Feet Rd',
  city: 'Bengaluru',
  state: 'Karnataka',
  zipCode: '560038',
  latitude: 12.9716,
  longitude: 77.5946,
  propertyType: 'APARTMENT',
  beds: 2,
  baths: 2,
  sqft: 1150,
  amenities: ['wifi', 'parking'],
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  images: [{ id: 1, url: 'https://example.com/image.jpg', isPrimary: true }],
};

describe('PropertyCard', () => {
  it('renders property title and formatted price', () => {
    render(<PropertyCard property={mockProperty} />);

    expect(screen.getByText('Contemporary 2BHK in Indiranagar')).toBeInTheDocument();
    expect(screen.getByText(/38,000/)).toBeInTheDocument();
    expect(screen.getByText(/Bengaluru, Karnataka/)).toBeInTheDocument();
    expect(screen.getByText('2 Beds')).toBeInTheDocument();
    expect(screen.getByText('2 Baths')).toBeInTheDocument();
    expect(screen.getByText('1150 sq ft')).toBeInTheDocument();
    expect(screen.getByText('Apartment')).toBeInTheDocument();
  });

  it('provides a link to the detail page', () => {
    render(<PropertyCard property={mockProperty} />);

    const link = screen.getByRole('link', { name: /View Details/i });
    expect(link).toHaveAttribute('href', '/properties/101');
  });
});
