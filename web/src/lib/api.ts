const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'TENANT' | 'MANAGER';
}

export interface PropertyImage {
  id: number;
  url: string;
  isPrimary: boolean;
  createdAt?: string;
}

export interface Property {
  id: number;
  managerId: number;
  title: string;
  description: string;
  price: number;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  propertyType: 'APARTMENT' | 'HOUSE' | 'STUDIO' | 'VILLA';
  beds: number;
  baths: number;
  sqft: number;
  amenities: string[];
  createdAt: string;
  updatedAt: string;
  images?: PropertyImage[];
  manager?: {
    id: number;
    name: string;
    email: string;
  };
}

export interface Booking {
  id: number;
  propertyId: number;
  tenantId: number;
  startDate: string;
  endDate: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  totalPrice: number;
  message?: string;
  createdAt: string;
  updatedAt: string;
  property?: {
    id: number;
    title: string;
    city: string;
    state?: string;
    address?: string;
    price: number;
    propertyType?: string;
    primaryImage?: string;
  };
  tenant?: {
    id: number;
    name: string;
    email: string;
  };
}

export interface SearchPropertiesResponse {
  properties: Property[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

async function request<T>(endpoint: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg = data.error || (data.details ? JSON.stringify(data.details) : `Request failed with status ${res.status}`);
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  // Auth
  register: (body: { name: string; email: string; password: string; role: 'TENANT' | 'MANAGER' }) =>
    request<{ user: User; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    request<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // Properties
  searchProperties: (params: Record<string, string | number | undefined>) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== '') {
        searchParams.append(key, String(val));
      }
    });
    return request<SearchPropertiesResponse>(`/api/properties?${searchParams.toString()}`);
  },

  getProperty: (id: number) =>
    request<{ property: Property }>(`/api/properties/${id}`),

  createProperty: (body: any, token: string) =>
    request<{ property: Property }>('/api/properties', {
      method: 'POST',
      body: JSON.stringify(body),
    }, token),

  updateProperty: (id: number, body: any, token: string) =>
    request<{ property: Property }>(`/api/properties/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }, token),

  deleteProperty: (id: number, token: string) =>
    request<{ message: string }>(`/api/properties/${id}`, {
      method: 'DELETE',
    }, token),

  uploadPropertyImage: (id: number, file: File, token: string) => {
    const formData = new FormData();
    formData.append('image', file);
    return request<{ image: PropertyImage }>(`/api/properties/${id}/images`, {
      method: 'POST',
      body: formData,
    }, token);
  },

  // Bookings
  createBooking: (body: { propertyId: number; startDate: string; endDate: string; message?: string }, token: string) =>
    request<{ booking: Booking }>('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(body),
    }, token),

  getMyBookings: (token: string) =>
    request<{ bookings: Booking[] }>('/api/bookings/mine', {}, token),

  getManagerBookings: (token: string, status?: string) => {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    return request<{ bookings: Booking[] }>(`/api/manager/bookings${q}`, {}, token);
  },

  updateBookingStatus: (id: number, status: 'APPROVED' | 'REJECTED' | 'CANCELLED', token: string) =>
    request<{ booking: Booking }>(`/api/bookings/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }, token),
};
