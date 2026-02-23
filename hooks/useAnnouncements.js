import { useState, useEffect } from 'react';
import { announcementsAPI } from '../lib/api';

export const useAnnouncements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const data = await announcementsAPI.getAll();
      setAnnouncements(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createAnnouncement = async (announcementData) => {
    try {
      await announcementsAPI.create(announcementData);
      await fetchAnnouncements();
    } catch (err) {
      throw new Error(err.message);
    }
  };

  const updateAnnouncement = async (id, updates) => {
    try {
      await announcementsAPI.update(id, updates);
      await fetchAnnouncements();
    } catch (err) {
      throw new Error(err.message);
    }
  };

  const deleteAnnouncement = async (id) => {
    try {
      await announcementsAPI.delete(id);
      await fetchAnnouncements();
    } catch (err) {
      throw new Error(err.message);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  return {
    announcements,
    loading,
    error,
    refetch: fetchAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement
  };
};
