import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

const FLOAT_CARDS = [
  { label: "Today's Revenue", value: '₹12,450', color: 'text-emerald-400', delay: 0 },
  { label: 'GST Payable', value: '₹18,340', color: 'text-amber-400', delay: 0.3 },
  { label: 'Net Profit', value: '₹84,903', color: 'text-primary-light', delay: 0.6 },
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
    <div className="min-h-screen flex bg-bg-base">
      {/* Left: Brand */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-hero relative overflow-hidden flex-col items-center justify-center p-12">
        {/* Glowing orbs */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl" />

        <div className="relative z-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center text-white font-display font-bold text-2xl mx-auto mb-6 shadow-glow">
            B
          </div>
          <h1 className="font-display font-bold text-5xl text-white mb-3">BizSync</h1>
          <p className="text-gray-400 text-lg mb-12">From invoice to insight — automatically.</p>

          {/* Floating metric cards */}
          <div className="space-y-3 max-w-xs mx-auto">
            {FLOAT_CARDS.map((card) => (
              <motion.div
                key={card.label}
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 3.5, delay: card.delay, ease: 'easeInOut' }}
                className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl px-5 py-3 flex items-center justify-between"
              >
                <span className="text-sm text-gray-400">{card.label}</span>
                <span className={`font-mono font-semibold ${card.color}`}>{card.value}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="w-full max-w-sm"
        >
          <div className="lg:hidden w-12 h-12 rounded-2xl bg-gradient-primary flex items-center justify-center text-white font-display font-bold text-xl mb-6 shadow-glow">
            B
          </div>
          <h2 className="font-display font-bold text-3xl text-white mb-1">Welcome back</h2>
          <p className="text-gray-400 text-sm mb-8">Sign in to your BizSync account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="raj@business.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail size={15} />}
              error={errors.email}
              autoComplete="email"
            />
            <Input
              label="Password"
              type={showPass ? 'text' : 'password'}
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock size={15} />}
              rightIcon={
                <button type="button" onClick={() => setShowPass((v) => !v)}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
              error={errors.password}
              autoComplete="current-password"
            />

            <Button type="submit" fullWidth loading={loading} size="lg" className="mt-2">
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border-default" />
            <span className="text-xs text-gray-500">or</span>
            <div className="flex-1 h-px bg-border-default" />
          </div>

          <button className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white text-gray-800 rounded-full font-semibold text-sm hover:bg-gray-100 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <p className="text-center text-sm text-gray-500 mt-6">
            New here?{' '}
            <button className="text-primary-light hover:underline font-medium">Create account</button>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
