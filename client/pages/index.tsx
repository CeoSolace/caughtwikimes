import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Main } from '../components/Main';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [servers, setServers] = useState([]);
  const [activeServer, setActiveServer] = useState(null);
  const [channels, setChannels] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTemporary, setIsTemporary] = useState(false);

  useEffect(() => {
    // Check if user exists in localStorage
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/auth');
      return;
    }
    
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);
    setIsTemporary(parsedUser.accountType === 'temporary');
    
    // Load user servers
    loadServers(parsedUser.id);
  }, []);

  const loadServers = async (userId) => {
    try {
      const response = await fetch(`/api/users/${userId}/servers`);
      if (response.ok) {
        const data = await response.json();
        setServers(data.servers);
      }
    } catch (error) {
      console.error('Error loading servers:', error);
    }
  };

  const loadServerChannels = async (serverId) => {
    try {
      const response = await fetch(`/api/servers/${serverId}/channels`);
      if (response.ok) {
        const data = await response.json();
        setChannels(data.channels);
        setActiveServer(serverId);
      }
    } catch (error) {
      console.error('Error loading channels:', error);
    }
  };

  const loadChannelMessages = async (channelId) => {
    try {
      const response = await fetch(`/api/channels/${channelId}/messages`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeServer) return;

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newMessage,
          channelId: activeServer,
          userId: user.id
        })
      });

      if (response.ok) {
        setNewMessage('');
        // Reload messages to show new one
        loadChannelMessages(activeServer);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <Main 
      user={user}
      servers={servers}
      activeServer={activeServer}
      channels={channels}
      messages={messages}
      newMessage={newMessage}
      setNewMessage={setNewMessage}
      isTemporary={isTemporary}
      loadServerChannels={loadServerChannels}
      loadChannelMessages={loadChannelMessages}
      sendMessage={sendMessage}
    />
  );
}
