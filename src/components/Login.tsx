import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { LoginCredentials } from '../types';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock, Mail, PhoneCall } from 'lucide-react';
import Logo from './Logo';

const Login: React.FC = () => {
  const { login } = useAuth();
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await login(credentials);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setCredentials((current) => ({
      ...current,
      [name]: value
    }));
  };

  return (
    <main className="grid min-h-screen grid-cols-1 bg-gray-50 lg:grid-cols-[minmax(420px,0.8fr)_1fr]">
      <section className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-9 flex items-center gap-3">
            <Logo />
            <div>
              <h1 className="text-xl font-extrabold text-gray-950">Brit CRM</h1>
              <p className="text-sm font-semibold text-gray-500">Brit Institute CRM</p>
            </div>
          </div>

          <div className="mb-8">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-extrabold uppercase text-blue-700">
              <PhoneCall className="h-3.5 w-3.5" />
              Phone Calling Active
            </div>
            <h2 className="text-4xl font-extrabold leading-tight text-gray-950">Sign in to your CRM workspace</h2>
            <p className="mt-3 text-sm text-gray-600">
              Access leads, calls, reminders, reports, and team workflows from one secure dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                <div className="flex gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 text-rose-600" />
                  <p className="text-sm font-semibold text-rose-700">{error}</p>
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="form-input pl-10"
                  placeholder="agent@company.com"
                  value={credentials.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="form-input pl-10 pr-10"
                  placeholder="Enter password"
                  value={credentials.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-700"
                  onClick={() => setShowPassword((current) => !current)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="btn btn-primary btn-lg w-full">
              {isLoading ? (
                <>
                  <div className="loading-spinner border-white/30 border-t-white" />
                  Signing in
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </section>

      <section className="login-hero hidden min-h-screen items-center justify-center p-10 text-white lg:flex">
        <div className="max-w-xl">
          <div className="mb-8 inline-flex rounded-full border border-white/30 bg-white/15 px-4 py-2 text-sm font-bold backdrop-blur">
            Enterprise-ready CRM operations
          </div>
          <h2 className="text-5xl font-extrabold leading-tight">Built for high-volume calling teams</h2>
          <div className="mt-8 grid grid-cols-2 gap-4">
            {[
              'Live queue visibility',
              'Lead and call timelines',
              'Agent performance',
              'Future Zoom and AI slots'
            ].map((item) => (
              <div key={item} className="rounded-lg border border-white/25 bg-white/15 p-4 backdrop-blur">
                <CheckCircle2 className="mb-3 h-5 w-5" />
                <p className="text-sm font-bold">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
};

export default Login;
