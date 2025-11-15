// pages/auth.tsx
import { useState } from 'react';
import { useRouter } from 'next/router';
// Ensure the path '../components/Auth' correctly points to your Auth component file
// If the file is missing or in a different location, the build will fail
import { Auth } from '../components/Auth';

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/auth/${isLogin ? 'login' : 'register'}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password })
      });

      const data = await response.json();

      if (response.ok) {
        if (typeof window !== 'undefined') {
            localStorage.setItem('user', JSON.stringify(data.user));
        }
        router.push('/');
      } else {
        setError(data.message || 'Authentication failed');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDiscordLogin = () => {
    window.location.href = '/api/auth/discord';
  };

  return (
    <Auth
      isLogin={isLogin}
      setIsLogin={setIsLogin}
      username={username}
      setUsername={setUsername}
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      error={error}
      loading={loading}
      handleSubmit={handleSubmit}
      handleDiscordLogin={handleDiscordLogin}
    />
  );
}
