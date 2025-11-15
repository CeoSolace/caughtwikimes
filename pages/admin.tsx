// pages/admin.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function AdminPanel() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null); // You might want to define a proper type
  const [isAdmin, setIsAdmin] = useState(false);
  const [reports, setReports] = useState<any[]>([]); // You might want to define a proper type
  const [users, setUsers] = useState<any[]>([]); // You might want to define a proper type
  const [servers, setServers] = useState<any[]>([]); // You might want to define a proper type
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('reports');

  useEffect(() => {
    const storedUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (!storedUser) {
      router.push('/auth');
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);

      // Check if user is admin
      if (parsedUser.staff || parsedUser.username === 'ceosolace') {
        setIsAdmin(true);
        loadAdminData();
      } else {
        router.push('/');
      }
    } catch (error) {
      console.error('Error parsing user data:', error);
      router.push('/auth');
    }
  }, [router]);

  const loadAdminData = async () => {
    try {
      // Load reports
      const reportsRes = await fetch('/api/admin/reports');
      if (reportsRes.ok) {
        const reportsData = await reportsRes.json();
        setReports(reportsData.reports);
      }

      // Load users
      const usersRes = await fetch('/api/admin/users');
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users);
      }

      // Load servers
      const serversRes = await fetch('/api/admin/servers');
      if (serversRes.ok) {
        const serversData = await serversRes.json();
        setServers(serversData.servers);
      }
    } catch (error) {
      console.error('Error loading admin data', error);
    } finally {
      setLoading(false);
    }
  };

  // Add explicit types to the resolveReport function parameters
  const resolveReport = async (reportId: string, action: 'approve' | 'reject') => {
    try {
      const response = await fetch(`/api/admin/reports/${reportId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action })
      });

      if (response.ok) {
        loadAdminData(); // Refresh data
      }
    } catch (error) {
      console.error('Error resolving report:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        Loading admin panel...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        Access denied. Admin privileges required.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>

      <div className="flex space-x-4 mb-6">
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 rounded ${activeTab === 'reports' ? 'bg-blue-600' : 'bg-gray-800'}`}
        >
          Reports ({reports.length})
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded ${activeTab === 'users' ? 'bg-blue-600' : 'bg-gray-800'}`}
        >
          Users ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('servers')}
          className={`px-4 py-2 rounded ${activeTab === 'servers' ? 'bg-blue-600' : 'bg-gray-800'}`}
        >
          Servers ({servers.length})
        </button>
      </div>

      {activeTab === 'reports' && (
        <div className="bg-gray-800 p-4 rounded">
          <h2 className="text-xl font-bold mb-4">Reports</h2>
          <div className="space-y-4">
            {reports.map((report: any) => ( // You might want to define a proper type for report
              <div key={report._id} className="bg-gray-700 p-4 rounded border-l-4 border-yellow-500">
                <div className="flex justify-between items-start">
                  <div>
                    <p><strong>Reporter:</strong> {report.reporterId}</p>
                    <p><strong>Target:</strong> {report.targetId}</p>
                    <p><strong>Reason:</strong> {report.reason}</p>
                    <p><strong>Type:</strong> {report.type}</p>
                    <p><strong>Status:</strong> {report.status}</p>
                    {report.evidence && (
                      <p><strong>Evidence:</strong> {report.evidence}</p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => resolveReport(report._id, 'approve')}
                      className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => resolveReport(report._id, 'reject')}
                      className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-gray-800 p-4 rounded">
          <h2 className="text-xl font-bold mb-4">Users</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left p-2">ID</th>
                  <th className="text-left p-2">Username</th>
                  <th className="text-left p-2">Email</th>
                  <th className="text-left p-2">Account Type</th>
                  <th className="text-left p-2">Staff</th>
                  <th className="text-left p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user: any) => ( // You might want to define a proper type for user
                  <tr key={user._id} className="border-b border-gray-700">
                    <td className="p-2">{user._id}</td>
                    <td className="p-2">{user.username}</td>
                    <td className="p-2">{user.email}</td>
                    <td className="p-2">{user.accountType}</td>
                    <td className="p-2">{user.staff ? 'Yes' : 'No'}</td>
                    <td className="p-2">{user.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'servers' && (
        <div className="bg-gray-800 p-4 rounded">
          <h2 className="text-xl font-bold mb-4">Servers</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left p-2">ID</th>
                  <th className="text-left p-2">Name</th>
                  <th className="text-left p-2">Owner</th>
                  <th className="text-left p-2">Boosts</th>
                  <th className="text-left p-2">Members</th>
                </tr>
              </thead>
              <tbody>
                {servers.map((server: any) => ( // You might want to define a proper type for server
                  <tr key={server._id} className="border-b border-gray-700">
                    <td className="p-2">{server._id}</td>
                    <td className="p-2">{server.name}</td>
                    <td className="p-2">{server.ownerId}</td>
                    <td className="p-2">{server.boosts || 0}</td>
                    <td className="p-2">{server.memberCount || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
