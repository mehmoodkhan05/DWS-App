import { useState, useEffect } from 'react';
import { requestsAPI } from '../lib/api';

export const useRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const data = await requestsAPI.getAll();
      setRequests(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createRequest = async (requestData) => {
    try {
      await requestsAPI.create(requestData);
      await fetchRequests();
    } catch (err) {
      throw new Error(err.message);
    }
  };

  const updateRequestStatus = async (id, status, adminNotes) => {
    try {
      await requestsAPI.updateStatus(id, status, adminNotes);
      await fetchRequests();
    } catch (err) {
      throw err;
    }
  };

  const deleteRequest = async (id) => {
    try {
      await requestsAPI.delete(id);
      await fetchRequests();
    } catch (err) {
      throw new Error(err.message);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  return {
    requests,
    loading,
    error,
    refetch: fetchRequests,
    createRequest,
    updateRequestStatus,
    deleteRequest
  };
};
