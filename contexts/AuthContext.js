import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, setToken, removeToken, getToken } from '../lib/api';

export const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing token on mount
    const checkAuth = async () => {
      const token = await getToken();
      if (token) {
        await fetchUserProfile();
      } else {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const profileData = await authAPI.getMe();
      setUser(profileData);
      setProfile(profileData);
      const token = await getToken();
      setSession(token ? { token } : null);
    } catch (error) {
      console.error('Error fetching profile:', error);
      await removeToken();
      setUser(null);
      setProfile(null);
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      setLoading(true);
      const { user: userData, token } = await authAPI.login(email, password);
      setUser(userData);
      setProfile(userData);
      setSession({ token });
      return {};
    } catch (error) {
      return { error: error.message || 'Login failed' };
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email, password, fullName, role = 'employee') => {
    try {
      setLoading(true);
      const { user: userData, token } = await authAPI.register(email, password, fullName, role);
      setUser(userData);
      setProfile(userData);
      setSession({ token });
      return {};
    } catch (error) {
      return { error: error.message || 'Registration failed' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
      setUser(null);
      setProfile(null);
      setSession(null);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const value = {
    user,
    profile,
    session,
    login,
    signup,
    logout,
    loading,
    isAuthenticated: !!user && !!session,
    isAdmin: profile?.role === 'admin',
    isManager: profile?.role === 'manager',
    isEmployee: profile?.role === 'employee',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
