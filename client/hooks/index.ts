import { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';

// Custom hook for managing authentication state
export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = (userData) => {
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  return { user, loading, login, logout };
};

// Custom hook for API calls
export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = async (url, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Request failed');
      }

      setLoading(false);
      return data;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  };

  return { loading, error, request };
};

// Custom hook for real-time messaging
export const useMessaging = () => {
  const [socket, setSocket] = useState<any>(null);
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const newSocket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000');
    
    newSocket.on('connect', () => {
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    newSocket.on('newMessage', (message) => {
      setMessages(prev => [...prev, message]);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const sendMessage = useCallback((content, channelId, userId, username) => {
    if (socket) {
      socket.emit('sendMessage', {
        content,
        channelId,
        userId,
        username
      });
    }
  }, [socket]);

  const joinChannel = useCallback((channelId) => {
    if (socket) {
      socket.emit('joinChannel', channelId);
    }
  }, [socket]);

  const leaveChannel = useCallback((channelId) => {
    if (socket) {
      socket.emit('leaveChannel', channelId);
    }
  }, [socket]);

  return { 
    socket, 
    messages, 
    setMessages, 
    connected, 
    sendMessage, 
    joinChannel, 
    leaveChannel 
  };
};

// Custom hook for server management
export const useServers = () => {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(false);
  const { request } = useApi();

  const loadServers = async (userId) => {
    setLoading(true);
    try {
      const data = await request(`/api/users/${userId}/servers`);
      setServers(data.servers);
    } catch (error) {
      console.error('Error loading servers:', error);
    } finally {
      setLoading(false);
    }
  };

  const createServer = async (name, ownerId) => {
    setLoading(true);
    try {
      const data = await request('/api/servers', {
        method: 'POST',
        body: JSON.stringify({ name, ownerId })
      });
      setServers(prev => [...prev, data.server]);
      return data.server;
    } catch (error) {
      console.error('Error creating server:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { servers, loading, loadServers, createServer };
};

// Custom hook for channel management
export const useChannels = () => {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const { request } = useApi();

  const loadChannels = async (serverId) => {
    setLoading(true);
    try {
      const data = await request(`/api/servers/${serverId}/channels`);
      setChannels(data.channels);
    } catch (error) {
      console.error('Error loading channels:', error);
    } finally {
      setLoading(false);
    }
  };

  const createChannel = async (name, serverId) => {
    setLoading(true);
    try {
      const data = await request('/api/channels', {
        method: 'POST',
        body: JSON.stringify({ name, serverId })
      });
      setChannels(prev => [...prev, data.channel]);
      return data.channel;
    } catch (error) {
      console.error('Error creating channel:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { channels, loading, loadChannels, createChannel };
};
