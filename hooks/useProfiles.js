import { useState, useEffect } from 'react';
import { profilesAPI } from '../lib/api';

export const useProfiles = () => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await profilesAPI.getAll();
      setProfiles(data);
    } catch (err) {
      console.error('Error in fetchProfiles:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (id, updates) => {
    try {
      await profilesAPI.update(id, updates);
      await fetchProfiles();
    } catch (err) {
      throw new Error(err.message);
    }
  };

  const updateProfileAdmin = async (id, updates) => {
    try {
      await profilesAPI.update(id, updates);
      await fetchProfiles();
    } catch (err) {
      throw new Error(err.message);
    }
  };

  const createProfile = async (profileData) => {
    try {
      const { password, ...profileWithoutPassword } = profileData;
      const newProfile = await profilesAPI.create({
        ...profileWithoutPassword,
        password: password || Math.random().toString(36).slice(-8)
      });
      await fetchProfiles();
      return newProfile;
    } catch (err) {
      throw new Error(err.message || 'Failed to create profile');
    }
  };

  const toggleActiveStatus = async (id, isActive) => {
    try {
      await profilesAPI.toggleActive(id);
      await fetchProfiles();
    } catch (err) {
      throw new Error(err.message);
    }
  };

  const deleteProfile = async (id, removeAuthUser = true) => {
    try {
      await profilesAPI.delete(id);
      await fetchProfiles();
    } catch (err) {
      throw new Error(err.message || 'Failed to delete profile');
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  return {
    profiles,
    loading,
    error,
    refetch: fetchProfiles,
    updateProfile,
    updateProfileAdmin,
    toggleActiveStatus,
    createProfile,
    deleteProfile
  };
};
