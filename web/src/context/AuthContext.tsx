'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, api } from '../lib/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: 'TENANT' | 'MANAGER') => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('nestfinder_token');
      const storedUser = localStorage.getItem('nestfinder_user');
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch {
      // Ignore storage parse error
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.login({ email, password });
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('nestfinder_token', data.token);
    localStorage.setItem('nestfinder_user', JSON.stringify(data.user));
  };

  const register = async (name: string, email: string, password: string, role: 'TENANT' | 'MANAGER') => {
    const data = await api.register({ name, email, password, role });
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('nestfinder_token', data.token);
    localStorage.setItem('nestfinder_user', JSON.stringify(data.user));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('nestfinder_token');
    localStorage.removeItem('nestfinder_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
