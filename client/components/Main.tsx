import { useState, useEffect } from 'react';
import io from 'socket.io-client';

interface User {
  id: string;
  username: string;
  email?: string;
  staff?: boolean;
  accountType: string;
}

interface Server {
  _id: string;
  name: string;
  ownerId: string;
}

interface Channel {
  _id: string;
  name: string;
  serverId: string;
}

interface Message {
  _id: string;
  content: string;
  userId: string;
  username: string;
  timestamp: string;
  staff?: boolean;
}

interface MainProps {
  user: User | null;
  servers: Server[];
  activeServer: string | null;
  channels: Channel[];
  messages: Message[];
  newMessage: string;
  setNewMessage: (value: string) => void;
  isTemporary: boolean;
  loadServerChannels: (serverId: string) => void;
  loadChannelMessages: (channelId: string) => void;
  sendMessage: () => void;
}

export const Main = ({
  user,
  servers,
  activeServer,
  channels,
  messages,
  newMessage,
  setNewMessage,
  isTemporary,
  loadServerChannels,
  loadChannelMessages,
  sendMessage
}: MainProps) => {
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [socket, setSocket] = useState<any>(null);

  useEffect(() => {
    // Initialize Socket.io connection
    const newSocket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000');
    setSocket(newSocket);

    // Listen for new messages
    newSocket.on('newMessage', (message: Message) => {
      // Update messages state to include new message
      // In a real implementation, this would update the messages array
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    window.location.href = '/auth';
  };

  const handleSendMessage = () => {
    if (socket && activeChannel && newMessage.trim()) {
      socket.emit('sendMessage', {
        content: newMessage,
        channelId: activeChannel,
        userId: user?.id,
        username: user?.username
      });
      setNewMessage('');
    } else {
      sendMessage(); // Fallback to API call
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Server sidebar */}
      <div className="w-20 bg-gray-800 flex flex-col items-center py-3 space-y-4">
        <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center font-bold">
          CW
        </div>
        {servers.map(server => (
          <button
            key={server._id}
            onClick={() => loadServerChannels(server._id)}
            className={`w-12 h-12 rounded-full ${
              activeServer === server._id ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
            } flex items-center justify-center font-bold`}
          >
            {server.name.charAt(0)}
          </button>
        ))}
        <button
          onClick={() => window.location.href = '/servers'}
          className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-2xl"
        >
          +
        </button>
      </div>

      {/* Channel sidebar */}
      <div className="w-60 bg-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-600">
          {activeServer ? servers.find(s => s._id === activeServer)?.name : 'Select a server'}
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="p-2">
            <h3 className="text-xs uppercase text-gray-400 mb-2">Text Channels</h3>
            {channels.map(channel => (
              <button
                key={channel._id}
                onClick={() => {
                  loadChannelMessages(channel._id);
                  setActiveChannel(channel._id);
                }}
                className={`block w-full text-left p-2 rounded mb-1 ${
                  activeChannel === channel._id ? 'bg-gray-600' : 'hover:bg-gray-600'
                }`}
              >
                # {channel.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Chat header */}
        <div className="h-14 bg-gray-800 border-b border-gray-700 flex items-center px-4">
          {activeChannel 
            ? `#${channels.find(c => c._id === activeChannel)?.name}` 
            : 'Select a channel'}
          <div className="ml-auto flex items-center space-x-4">
            <span className="text-sm text-gray-400">
              {user?.staff && (
                <span className="bg-red-600 text-white px-2 py-1 rounded text-xs mr-2">
                  STAFF
                </span>
              )}
              {user?.username} {isTemporary && '(Temporary)'}
            </span>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map(message => (
            <div key={message._id} className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                {message.username.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex items-baseline space-x-2">
                  <span className="font-medium">
                    {message.username}
                    {message.staff && (
                      <span className="ml-2 bg-red-600 text-white px-2 py-0.5 rounded text-xs">
                        STAFF
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-gray-100 mt-1">{message.content}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Message input */}
        <div className="p-4 bg-gray-800 border-t border-gray-700">
          <div className="flex space-x-3">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={activeChannel ? "Message this channel..." : "Select a channel to start chatting"}
              disabled={!activeChannel}
              className="flex-1 p-3 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSendMessage}
              disabled={!activeChannel || !newMessage.trim()}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded font-medium disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
