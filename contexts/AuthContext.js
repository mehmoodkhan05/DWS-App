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
      console.log('Starting login...');
      const response = await authAPI.login(email, password);
      console.log('Login API response:', response);
      
      // Handle different response structures
      // API might return { user: {...}, token: "..." } or { ...userData, token: "..." }
      const userData = response.user || response;
      const token = response.token;
      
      console.log('Extracted userData:', userData);
      console.log('Extracted token:', token ? 'Token exists' : 'No token');
      
      if (!token) {
        throw new Error('No token received from server');
      }
      
      // Check if userData is valid (not empty object and not null)
      if (!userData || (typeof userData === 'object' && Object.keys(userData).length === 0 && !userData.id)) {
        // If no user data in response, fetch it using getMe
        console.log('No user data in login response, fetching profile...');
        const profileData = await authAPI.getMe();
        console.log('Fetched profile data:', profileData);
        setUser(profileData);
        setProfile(profileData);
      } else {
        setUser(userData);
        setProfile(userData);
      }
      
      // Token is already saved by authAPI.login, but verify it
      const savedToken = await getToken();
      if (!savedToken) {
        await setToken(token);
      }
      
      // Update session with token
      const finalToken = savedToken || token;
      setSession({ token: finalToken });
      
      console.log('Login successful, user set:', !!userData);
      console.log('Session set:', !!finalToken);
      
      return {};
    } catch (error) {
      console.error('Login error:', error);
      // Clear any partial state on error
      setUser(null);
      setProfile(null);
      setSession(null);
      return { error: error.message || 'Login failed' };
    } finally {
      setLoading(false);
      console.log('Login loading set to false');
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

  const isAuthenticated = !!user && !!session;
  
  // Debug logging for authentication state
  useEffect(() => {
    console.log('Auth state changed:', {
      hasUser: !!user,
      hasSession: !!session,
      isAuthenticated,
      loading,
    });
  }, [user, session, isAuthenticated, loading]);

  const refreshProfile = async () => {
    try {
      await fetchUserProfile();
    } catch (error) {
      console.error('Error refreshing profile:', error);
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
    isAuthenticated,
    refreshProfile,
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
