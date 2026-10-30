import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FilterSidebar, { FilterState } from '../components/FilterSidebar';
import { api } from '../lib/api';

const defaultFilters: FilterState = {
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

describe('FilterSidebar & Search Query Building', () => {
  it('triggers onChange when selecting city and entering price range', () => {
    const onChange = vi.fn();
    const onApply = vi.fn();
    const onReset = vi.fn();

    render(
      <FilterSidebar
        filters={defaultFilters}
        onChange={onChange}
        onApply={onApply}
        onReset={onReset}
      />
    );

    const citySelect = screen.getByLabelText(/City/i);
    fireEvent.change(citySelect, { target: { value: 'Mumbai' } });
    expect(onChange).toHaveBeenCalledWith({ city: 'Mumbai' });

    const minPriceInput = screen.getByPlaceholderText('Min');
    fireEvent.change(minPriceInput, { target: { value: '25000' } });
    expect(onChange).toHaveBeenCalledWith({ minPrice: '25000' });

    const applyButton = screen.getByRole('button', { name: /Apply Filters/i });
    fireEvent.click(applyButton);
    expect(onApply).toHaveBeenCalled();

    const resetButton = screen.getByRole('button', { name: /Reset/i });
    fireEvent.click(resetButton);
    expect(onReset).toHaveBeenCalled();
  });

  it('builds the correct query string in api.searchProperties', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            properties: [],
            total: 0,
            page: 1,
            limit: 20,
            totalPages: 1,
          }),
      } as any)
    );

    await api.searchProperties({
      city: 'Bengaluru',
      minPrice: 20000,
      maxPrice: 50000,
      beds: 2,
      type: 'APARTMENT',
      amenities: 'wifi,parking',
      availableFrom: '2026-11-01',
      availableTo: '2026-11-10',
      sort: 'price_asc',
      page: 1,
      limit: 12,
    });

    expect(fetchSpy).toHaveBeenCalled();
    const calledUrl = fetchSpy.mock.calls[0][0] as string;

    expect(calledUrl).toContain('city=Bengaluru');
    expect(calledUrl).toContain('minPrice=20000');
    expect(calledUrl).toContain('maxPrice=50000');
    expect(calledUrl).toContain('beds=2');
    expect(calledUrl).toContain('type=APARTMENT');
    expect(calledUrl).toContain('amenities=wifi%2Cparking');
    expect(calledUrl).toContain('availableFrom=2026-11-01');
    expect(calledUrl).toContain('availableTo=2026-11-10');
    expect(calledUrl).toContain('sort=price_asc');

    fetchSpy.mockRestore();
  });
});
