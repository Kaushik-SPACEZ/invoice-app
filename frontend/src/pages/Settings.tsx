import { useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card, CardHeader, CardBody } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { settingsApi } from '../api'
import toast from 'react-hot-toast'

export default function Settings() {
  const { user, setUser } = useAuthStore()

  // Profile
  const [profile, setProfile] = useState({ name: user?.name ?? '', phone: user?.phone ?? '' })
  const [savingProfile, setSavingProfile] = useState(false)

  // Business
  const [business, setBusiness] = useState({ business_name: user?.business_name ?? '', gstin: user?.gstin ?? '' })
  const [savingBusiness, setSavingBusiness] = useState(false)

  // Password
  const [pwd, setPwd] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [savingPwd, setSavingPwd] = useState(false)

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
        <Card>
          <CardHeader><span className="font-semibold text-sm text-gray-200">Profile</span></CardHeader>
          <CardBody className="space-y-4">
            <Input label="Name" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} />
            <Input label="Email" type="email" value={user?.email ?? ''} disabled hint="Email cannot be changed" />
            <Input label="Phone" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} />
            <Button size="sm" onClick={handleSaveProfile} loading={savingProfile}>Save Profile</Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><span className="font-semibold text-sm text-gray-200">Business Information</span></CardHeader>
          <CardBody className="space-y-4">
            <Input label="Business Name" value={business.business_name} onChange={e => setBusiness(p => ({ ...p, business_name: e.target.value }))} />
            <Input label="GSTIN" value={business.gstin} onChange={e => setBusiness(p => ({ ...p, gstin: e.target.value.toUpperCase() }))} placeholder="27AAPFU0939F1ZV" className="font-mono" hint="15-character GST Identification Number" />
            <Button size="sm" onClick={handleSaveBusiness} loading={savingBusiness}>Save Business Info</Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><span className="font-semibold text-sm text-gray-200">Change Password</span></CardHeader>
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
