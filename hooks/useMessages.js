import { useState, useEffect } from 'react';
import { messagesAPI } from '../lib/api';

export const useMessages = (recipientId) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const data = await messagesAPI.getAll(recipientId);
      setMessages(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (recipientId, content) => {
    try {
      await messagesAPI.send(recipientId, content);
      await fetchMessages();
    } catch (err) {
      throw new Error(err.message);
    }
  };

  const markAsRead = async (messageId) => {
    try {
      await messagesAPI.markAsRead(messageId);
      await fetchMessages();
    } catch (err) {
      throw new Error(err.message);
    }
  };

  useEffect(() => {
    fetchMessages();
    // Poll for new messages every 5 seconds
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [recipientId]);

  return {
    messages,
    loading,
    error,
    sendMessage,
    markAsRead,
    refetch: fetchMessages
  };
};
