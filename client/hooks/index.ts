// client/hooks/index.ts
import { useState, useEffect } from 'react';

// Define a type for the user data structure
// Adjust the properties based on your actual user object structure
interface UserData {
  id: string;
  username: string;
  staff?: boolean; // Optional property
  accountType: string;
  [key: string]: any; // Allow other properties if needed
}

// Custom hook for managing authentication state
export const useAuth = () => {
  const [user, setUser] = useState<UserData | null>(null); // Use the type here
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null; // Check for window
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse user from localStorage", e);
        // Optionally clear corrupted data
        if (typeof window !== 'undefined') {
           localStorage.removeItem('user');
        }
      }
    }
    setLoading(false);
  }, []);

  // Add type annotation to userData parameter
  const login = (userData: UserData) => {
    if (typeof window !== 'undefined') { // Check for window
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    }
  };

  const logout = () => {
    if (typeof window !== 'undefined') { // Check for window
      localStorage.removeItem('user');
      setUser(null);
    }
  };

  return { user, loading, login, logout };
};

// ... rest of your hooks remain the same ...

// Custom hook for API calls
export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null); // Add type

  const request = async (url: string, options: RequestInit = {}) => { // Add types
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
    } catch (err: any) { // Add type
      const errorMessage = err.message || 'Request failed';
      setError(errorMessage);
      setLoading(false);
      throw new Error(errorMessage); // Re-throw for caller handling
    }
  };

  return { loading, error, request };
};

// Custom hook for real-time messaging
export const useMessaging = () => {
  const [socket, setSocket] = useState<any>(null); // You might want to type this properly
  const [messages, setMessages] = useState<any[]>([]); // You might want to type messages

  useEffect(() => {
    // In a real implementation, this would connect to Socket.io
    // For now, we'll simulate the connection
    // Note: This logic might not work directly in a server-side render
    if (typeof window !== 'undefined' && typeof window.location !== 'undefined') {
        const mockSocket = {
          on: () => {},
          emit: () => {},
          disconnect: () => {}
        };

        setSocket(mockSocket);

        return () => {
          if (mockSocket.disconnect) {
            mockSocket.disconnect();
          }
        };
    }
  }, []);

  return { socket, messages, setMessages };
};
