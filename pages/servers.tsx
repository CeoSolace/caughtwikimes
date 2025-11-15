import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function ServerManagement() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [servers, setServers] = useState([]);
  const [newServerName, setNewServerName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [boosts, setBoosts] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/auth');
      return;
    }
    
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);
    
    if (parsedUser.accountType === 'temporary') {
      setError('Permanent account required to create servers');
      return;
    }
    
    loadServers(parsedUser.id);
  }, []);

  const loadServers = async (userId) => {
    try {
      const response = await fetch(`/api/users/${userId}/servers`);
      if (response.ok) {
        const data = await response.json();
        setServers(data.servers);
        
        // Load boost counts for each server
        data.servers.forEach(server => {
          loadBoosts(server._id);
        });
      }
    } catch (error) {
      console.error('Error loading servers:', error);
    }
  };

  const loadBoosts = async (serverId) => {
    try {
      const response = await fetch(`/api/servers/${serverId}/boosts`);
      if (response.ok) {
        const data = await response.json();
        setBoosts(prev => ({
          ...prev,
          [serverId]: data.totalBoosts
        }));
      }
    } catch (error) {
      console.error('Error loading boosts:', error);
    }
  };

  const createServer = async (e) => {
    e.preventDefault();
    if (!newServerName.trim()) return;
    
    setIsCreating(true);
    try {
      const response = await fetch('/api/servers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newServerName,
          ownerId: user.id
        })
      });

      const data = await response.json();
      if (response.ok) {
        setServers([...servers, data.server]);
        setNewServerName('');
      } else {
        setError(data.message || 'Failed to create server');
      }
    } catch (error) {
      setError('Network error occurred');
    } finally {
      setIsCreating(false);
    }
  };

  const boostServer = async (serverId) => {
    if (boosts[serverId] >= 20) {
      setError('Maximum boosts (20) reached for this server');
      return;
    }

    try {
      const response = await fetch('/api/boosts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serverId,
          userId: user.id
        })
      });

      if (response.ok) {
        loadBoosts(serverId);
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to boost server');
      }
    } catch (error) {
      setError('Network error occurred');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-3xl font-bold mb-6">Server Management</h1>
      
      {error && (
        <div className="bg-red-600 text-white p-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {user?.accountType === 'permanent' ? (
        <>
          <form onSubmit={createServer} className="mb-6">
            <div className="flex gap-3">
              <input
                type="text"
                value={newServerName}
                onChange={(e) => setNewServerName(e.target.value)}
                placeholder="New server name"
                className="flex-1 p-3 bg-gray-800 rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={isCreating}
                className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded font-medium disabled:opacity-50"
              >
                {isCreating ? 'Creating...' : 'Create Server'}
              </button>
            </div>
          </form>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {servers.map(server => (
              <div key={server._id} className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <h3 className="font-bold text-lg mb-2">{server.name}</h3>
                <p className="text-gray-400 text-sm mb-3">
                  Owner: {server.ownerId === user.id ? 'You' : server.ownerId}
                </p>
                <div className="flex justify-between items-center">
                  <span className="text-yellow-400 font-medium">
                    Boosts: {boosts[server._id] || 0}/20
                  </span>
                  <button
                    onClick={() => boostServer(server._id)}
                    className="bg-yellow-600 hover:bg-yellow-700 px-3 py-1 rounded text-sm"
                  >
                    Boost (£5)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="bg-yellow-900 text-yellow-100 p-4 rounded mb-4">
          <p>Permanent account required to create and manage servers.</p>
          <button
            onClick={() => router.push('/auth')}
            className="mt-2 bg-yellow-700 hover:bg-yellow-600 px-4 py-2 rounded"
          >
            Link Discord Account
          </button>
        </div>
      )}
    </div>
  );
}
