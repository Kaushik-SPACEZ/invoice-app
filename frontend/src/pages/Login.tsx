import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'

const FEATURES = [
  'AI Invoice Extraction',
  'GST Auto-calculation',
  'Multi-marketplace Analytics',
]

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    if (!email) { setErrors({ email: 'Email is required' }); return }
    if (!password) { setErrors({ password: 'Password is required' }); return }
    setLoading(true)
    try {
      const { data } = await authApi.login(email, password)
      setAuth(data.data.user, data.data.token)
      navigate('/dashboard')
    } catch (err: any) {
      if (err.response?.data?.errors) setErrors(err.response.data.errors)
      else toast.error(err.response?.data?.message ?? 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#F5F7FA' }}>
      {/* Left panel — dark navy brand area */}
      <div
        className="hidden lg:flex lg:w-2/5 flex-col justify-between p-10"
        style={{ backgroundColor: '#1E293B' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-md flex items-center justify-center text-white font-bold text-base"
            style={{ backgroundColor: '#2563EB' }}
          >
            B
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">BizSync</span>
        </div>

        {/* Center content */}
        <div>
          <h2 className="text-white font-bold text-2xl mb-3 leading-snug">
            Automate your marketplace accounting
          </h2>
          <p className="text-sm mb-8" style={{ color: '#94A3B8' }}>
            Built for Indian sellers on Amazon, Flipkart, Meesho and more.
          </p>
          <ul className="space-y-3">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-3">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'rgba(37,99,235,0.25)' }}
                >
                  <Check size={11} color="#60A5FA" strokeWidth={3} />
                </span>
                <span className="text-sm" style={{ color: '#CBD5E1' }}>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <p className="text-xs" style={{ color: '#475569' }}>
          &copy; {new Date().getFullYear()} BizSync Technologies Pvt. Ltd. &middot; GST-compliant ERP
        </p>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: '#2563EB' }}
            >
              B
            </div>
            <span className="font-semibold text-base" style={{ color: '#0F172A' }}>BizSync</span>
          </div>

          <h1 className="font-bold text-2xl mb-1" style={{ color: '#0F172A' }}>
            Sign in to BizSync
          </h1>
          <p className="text-sm mb-8" style={{ color: '#475569' }}>
            Enter your credentials to access your account
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium mb-1.5"
                style={{ color: '#334155' }}
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="raj@business.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-md outline-none transition-colors"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: errors.email ? '1px solid #DC2626' : '1px solid #D1D5DB',
                  color: '#0F172A',
                }}
                onFocus={(e) => {
                  if (!errors.email) e.currentTarget.style.border = '1px solid #2563EB'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = errors.email ? '1px solid #DC2626' : '1px solid #D1D5DB'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
              {errors.email && (
                <p className="mt-1 text-xs" style={{ color: '#DC2626' }}>{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium mb-1.5"
                style={{ color: '#334155' }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 pr-10 text-sm rounded-md outline-none transition-colors"
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: errors.password ? '1px solid #DC2626' : '1px solid #D1D5DB',
                    color: '#0F172A',
                  }}
                  onFocus={(e) => {
                    if (!errors.password) e.currentTarget.style.border = '1px solid #2563EB'
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.border = errors.password ? '1px solid #DC2626' : '1px solid #D1D5DB'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: '#94A3B8' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#475569')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#94A3B8')}
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs" style={{ color: '#DC2626' }}>{errors.password}</p>
              )}
            </div>

            {/* Sign In button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-md text-sm font-medium text-white transition-colors duration-150 mt-1"
              style={{
                backgroundColor: loading ? '#60A5FA' : '#2563EB',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = '#1D4ED8'
              }}
              onMouseLeave={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = '#2563EB'
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ backgroundColor: '#E2E8F0' }} />
            <span className="text-xs" style={{ color: '#94A3B8' }}>or</span>
            <div className="flex-1 h-px" style={{ backgroundColor: '#E2E8F0' }} />
          </div>

          {/* Google sign in */}
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-md text-sm font-medium transition-colors duration-150"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #D1D5DB',
              color: '#374151',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F9FAFB')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <p className="text-center text-sm mt-6" style={{ color: '#64748B' }}>
            New to BizSync?{' '}
            <button
              type="button"
              className="font-medium transition-colors duration-150"
              style={{ color: '#2563EB' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#1D4ED8')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#2563EB')}
            >
              Create account
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
