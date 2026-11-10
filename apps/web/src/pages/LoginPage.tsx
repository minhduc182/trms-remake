import React, { useState } from 'react';
import { Bus, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { gqlRequest, setLoggedInUser } from '../lib/graphql';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu');
      return;
    }

    setLoading(true);
    try {
      const res = await gqlRequest<{
        login: {
          token: string;
          username: string;
          fullName: string;
          isAdmin: boolean;
        };
      }>(
        `mutation Login($username: String!, $password: String!) {
          login(username: $username, password: $password) {
            token
            username
            fullName
            isAdmin
          }
        }`,
        { username: cleanUser, password },
      );

      if (res.login?.username) {
        setLoggedInUser(res.login.username);
        onLoginSuccess();
      }
    } catch (err: any) {
      setError(err?.message || 'Sai tên đăng nhập hoặc mật khẩu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f0fdf9] via-[#f8fafc] to-[#e6f7f2] p-4 font-sans">
      <div className="w-full max-w-[420px] bg-white rounded-[14px] shadow-xl border border-[#e5e7eb] overflow-hidden">
        {/* Top Brand Banner */}
        <div className="bg-[#00897b] px-7 py-6 text-white flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-[10px] bg-white/15 backdrop-blur flex items-center justify-center shrink-0 border border-white/25">
            <Bus className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-[18px] font-bold tracking-tight leading-snug">
              Hệ thống Quản lý Vận chuyển
            </h1>
            <p className="text-[12px] text-white/85">
              TRMS Platform — Meiko Electronics Vietnam
            </p>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-7 space-y-5">
          <div>
            <h2 className="text-[16px] font-bold text-[#111827]">Đăng nhập hệ thống</h2>
            <p className="text-[12px] text-[#6b7280] mt-0.5">
              Nhập thông tin tài khoản quản trị hoặc nhân viên để tiếp tục
            </p>
          </div>

          {error && (
            <div
              data-testid="login-error"
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-[8px] bg-[#fef2f2] border border-[#fecaca] text-[#dc2626] text-[13px]"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">
                Tên đăng nhập
              </label>
              <div className="relative flex items-center">
                <User className="w-4 h-4 text-[#9ca3af] absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  data-testid="login-username"
                  autoFocus
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nhập tên đăng nhập..."
                  className="w-full h-[40px] pl-10 pr-3.5 rounded-[8px] border border-[#d1d5db] text-[13px] text-[#111827] focus:outline-none focus:border-[#00897b] focus:ring-2 focus:ring-[#00897b]/15 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">
                Mật khẩu
              </label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-[#9ca3af] absolute left-3.5 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  data-testid="login-password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu..."
                  className="w-full h-[40px] pl-10 pr-10 rounded-[8px] border border-[#d1d5db] text-[13px] text-[#111827] focus:outline-none focus:border-[#00897b] focus:ring-2 focus:ring-[#00897b]/15 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-[#6b7280] hover:text-[#111827] cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            data-testid="login-submit"
            disabled={loading}
            className="w-full h-[40px] rounded-[8px] bg-[#00897b] hover:bg-[#00796b] disabled:opacity-60 text-white font-semibold text-[13px] shadow-sm transition-colors cursor-pointer"
          >
            {loading ? 'Đang xác thực...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  );
};
