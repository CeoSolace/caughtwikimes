interface AuthProps {
  isLogin: boolean;
  setIsLogin: (value: boolean) => void;
  username: string;
  setUsername: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  error: string;
  loading: boolean;
  handleSubmit: (e: React.FormEvent) => void;
  handleDiscordLogin: () => void;
}

export const Auth = ({
  isLogin,
  setIsLogin,
  username,
  setUsername,
  email,
  setEmail,
  password,
  setPassword,
  error,
  loading,
  handleSubmit,
  handleDiscordLogin
}: AuthProps) => {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-800 p-8 rounded-lg border border-gray-700">
        <h1 className="text-3xl font-bold mb-6 text-center">
          {isLogin ? 'Login to CaughtWiki' : 'Create Account'}
        </h1>
        
        {error && (
          <div className="bg-red-900 text-red-100 p-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-300 mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          {!isLogin && (
            <div className="mb-4">
              <label className="block text-gray-300 mb-2">Email (Optional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          
          <div className="mb-6">
            <label className="block text-gray-300 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded font-medium disabled:opacity-50"
          >
            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
          </button>
        </form>
        
        <div className="mt-6">
          <button
            onClick={handleDiscordLogin}
            className="w-full bg-purple-600 hover:bg-purple-700 py-3 rounded font-medium"
          >
            Continue with Discord
          </button>
        </div>
        
        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-400 hover:text-blue-300"
          >
            {isLogin 
              ? "Don't have an account? Register" 
              : "Already have an account? Login"}
          </button>
        </div>
        
        <div className="mt-6 text-center text-sm text-gray-400">
          <p>Temporary accounts: Username only, no verification required</p>
          <p>Permanent accounts: Discord OAuth required</p>
        </div>
      </div>
    </div>
  );
};
