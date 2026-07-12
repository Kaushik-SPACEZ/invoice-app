import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { settingsApi } from '../api'
import client from '../api/client'
import toast from 'react-hot-toast'
import { Mail, CheckCircle, XCircle } from 'lucide-react'

export default function Settings() {
  const { user } = useAuthStore()

  // Profile
  const [profile, setProfile] = useState({ name: user?.name ?? '', phone: user?.phone ?? '' })
  const [savingProfile, setSavingProfile] = useState(false)

  // Business
  const [business, setBusiness] = useState({ business_name: user?.business_name ?? '', gstin: user?.gstin ?? '' })
  const [savingBusiness, setSavingBusiness] = useState(false)

  // Password
  const [pwd, setPwd] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [savingPwd, setSavingPwd] = useState(false)

  // Gmail
  const [gmailConnected, setGmailConnected] = useState(false)
  const [connectingGmail, setConnectingGmail] = useState(false)
  const [gmailEmail, setGmailEmail] = useState('')
  const [gmailMarketplaces, setGmailMarketplaces] = useState({
    amazon: true,
    flipkart: true,
    meesho: true,
    kynetropo: true,
  })

  useEffect(() => {
    // Check Gmail connection status
    client.get('/gmail/status').then(r => setGmailConnected(r.data.data?.connected ?? false)).catch(() => {})

    // Handle OAuth callback result
    const params = new URLSearchParams(window.location.search)
    if (params.get('gmail') === 'connected') {
      setGmailConnected(true)
      toast.success('Gmail connected successfully!')
      window.history.replaceState({}, '', '/settings')
    } else if (params.get('gmail') === 'error') {
      toast.error('Failed to connect Gmail. Please try again.')
      window.history.replaceState({}, '', '/settings')
    }
  }, [])

  const handleConnectGmail = async () => {
    if (!gmailEmail) { toast.error('Enter your Gmail address first'); return }
    setConnectingGmail(true)
    try {
      // Save gmail preferences first
      await settingsApi.update({
        gmail_email: gmailEmail,
        gmail_marketplaces: JSON.stringify(gmailMarketplaces),
      })
      const { data } = await client.get('/gmail/connect')
      window.location.href = data.data.auth_url
    } catch {
      toast.error('Failed to initiate Gmail connection')
      setConnectingGmail(false)
    }
  }

  const handleDisconnectGmail = async () => {
    try {
      await client.post('/gmail/disconnect')
      setGmailConnected(false)
      toast.success('Gmail disconnected')
    } catch {
      toast.error('Failed to disconnect Gmail')
    }
  }

  const handleSaveProfile = async () => {
    if (!profile.name.trim()) { toast.error('Name is required'); return }
    setSavingProfile(true)
    try {
      await settingsApi.update(profile)
      toast.success('Profile updated')
    } catch { toast.error('Failed to update profile') }
    finally { setSavingProfile(false) }
  }

  const handleSaveBusiness = async () => {
    if (business.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(business.gstin)) {
      toast.error('Invalid GSTIN format'); return
    }
    setSavingBusiness(true)
    try {
      await settingsApi.update(business)
      toast.success('Business info updated')
    } catch { toast.error('Failed to update business info') }
    finally { setSavingBusiness(false) }
  }

  const handleUpdatePassword = async () => {
    if (!pwd.current_password) { toast.error('Enter current password'); return }
    if (pwd.new_password.length < 8) { toast.error('New password must be at least 8 characters'); return }
    if (pwd.new_password !== pwd.confirm_password) { toast.error('Passwords do not match'); return }
    setSavingPwd(true)
    try {
      await settingsApi.update({ current_password: pwd.current_password, new_password: pwd.new_password })
      toast.success('Password updated')
      setPwd({ current_password: '', new_password: '', confirm_password: '' })
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to update password')
    } finally { setSavingPwd(false) }
  }

  return (
    <PageWrapper>
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text-primary)' }}>Settings</h1>
      </div>

      <div className="max-w-2xl space-y-6">

        {/* Gmail Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail size={16} className="text-blue-600" />
              <span className="font-semibold text-sm text-slate-700">Gmail Auto-fetch</span>
            </div>
            {gmailConnected
              ? <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle size={12} /> Connected</span>
              : <span className="flex items-center gap-1 text-xs text-slate-500"><XCircle size={12} /> Not connected</span>
            }
          </CardHeader>
          <CardBody>
            {gmailConnected ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Gmail is connected. Invoice emails will be automatically fetched and processed every 2 minutes.
                </p>
                <Button variant="danger" size="sm" onClick={handleDisconnectGmail}>
                  Disconnect Gmail
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Connect your Gmail to automatically fetch and process invoice emails — no manual uploads needed.
                </p>

                <Input
                  label="Your Gmail Address"
                  type="email"
                  placeholder="kaushik24062004@gmail.com"
                  value={gmailEmail}
                  onChange={e => setGmailEmail(e.target.value)}
                  hint="The Gmail inbox to monitor for invoice emails"
                />

                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Watch emails from:</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'amazon', label: 'Amazon', color: '#FF9900', domain: '@amazon.in' },
                      { key: 'flipkart', label: 'Flipkart', color: '#2874F0', domain: '@flipkart.com' },
                      { key: 'meesho', label: 'Meesho', color: '#F43397', domain: '@meesho.com' },
                      { key: 'kynetropo', label: 'Kynetropo', color: '#6366F1', domain: '@kynetropo.com' },
                    ].map(({ key, label, color, domain }) => (
                      <button
                        key={key}
                        onClick={() => setGmailMarketplaces(p => ({ ...p, [key]: !p[key as keyof typeof p] }))}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                          gmailMarketplaces[key as keyof typeof gmailMarketplaces]
                            ? 'border-primary/40 bg-primary/10'
                            : 'border-border-default text-gray-500'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                        <span>{label}</span>
                        <span className="text-gray-500 font-mono">{domain}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleConnectGmail}
                  loading={connectingGmail}
                  size="sm"
                  disabled={!gmailEmail}
                >
                  <Mail size={14} /> Connect Gmail
                </Button>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><span className="font-semibold text-sm text-slate-700">Profile</span></CardHeader>
          <CardBody className="space-y-4">
            <Input label="Name" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} />
            <Input label="Email" type="email" value={user?.email ?? ''} disabled hint="Email cannot be changed" />
            <Input label="Phone" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} />
            <Button size="sm" onClick={handleSaveProfile} loading={savingProfile}>Save Profile</Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><span className="font-semibold text-sm text-slate-700">Business Information</span></CardHeader>
          <CardBody className="space-y-4">
            <Input label="Business Name" value={business.business_name} onChange={e => setBusiness(p => ({ ...p, business_name: e.target.value }))} />
            <Input label="GSTIN" value={business.gstin} onChange={e => setBusiness(p => ({ ...p, gstin: e.target.value.toUpperCase() }))} placeholder="27AAPFU0939F1ZV" className="font-mono" hint="15-character GST Identification Number" />
            <Button size="sm" onClick={handleSaveBusiness} loading={savingBusiness}>Save Business Info</Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><span className="font-semibold text-sm text-slate-700">Change Password</span></CardHeader>
          <CardBody className="space-y-4">
            <Input label="Current Password" type="password" value={pwd.current_password} onChange={e => setPwd(p => ({ ...p, current_password: e.target.value }))} />
            <Input label="New Password" type="password" value={pwd.new_password} onChange={e => setPwd(p => ({ ...p, new_password: e.target.value }))} hint="Minimum 8 characters" />
            <Input label="Confirm New Password" type="password" value={pwd.confirm_password} onChange={e => setPwd(p => ({ ...p, confirm_password: e.target.value }))} />
            <Button size="sm" onClick={handleUpdatePassword} loading={savingPwd}>Update Password</Button>
          </CardBody>
        </Card>
      </div>
    </PageWrapper>
  )
}
