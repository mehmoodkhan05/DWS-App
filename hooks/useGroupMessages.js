import { useState, useEffect } from 'react';
import { messagesAPI } from '../lib/api';

export const useGroupMessages = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const data = await messagesAPI.getGroupMessages();
      setMessages(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (content) => {
    try {
      await messagesAPI.sendGroupMessage(content);
      await fetchMessages();
    } catch (err) {
      throw new Error(err.message);
    }
  };

  const markAsRead = async (messageId) => {
    // Group messages don't have read status in the current implementation
    console.log('Mark as read not implemented for group messages');
  };

  useEffect(() => {
    fetchMessages();
    // Poll for new messages every 5 seconds
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, []);

  return {
    messages,
    loading,
    error,
    sendMessage,
    markAsRead,
    refetch: fetchMessages
  };
};
