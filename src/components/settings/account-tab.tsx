import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Copy, KeyRound, Loader2, Pencil, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { HaodouIcon } from '@/components/ui/haodou-icon'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { resolveApiBase } from '@/lib/auth/api-base'
import {
  bindAccountPhone,
  fetchClientProfile,
  formatAuthFetchError,
  sendSmsCode,
  setAccountPassword,
  setAccountNickname,
  setAccountUsername,
  uploadAccountAvatar,
} from '@/lib/auth/auth-service'
import { isLoginRequired } from '@/lib/auth/login-mode'
import { useAuthStore } from '@/stores/auth-store'
import { useSettingsStore } from '@/stores/settings-store'
import { HaodouRechargeSection } from '@/components/settings/haodou-recharge-section'
import { HaodouLedgerSection } from '@/components/settings/haodou-ledger-section'

const SMS_COOLDOWN_SEC = 60

function AccountDialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto w-full max-w-md"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="rounded-2xl border border-border/40 bg-card shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-6 pt-6 pb-4">
                  <h2 className="text-lg font-semibold">{title}</h2>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg p-1.5 transition-colors hover:bg-muted"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                <div className="px-6 pb-6">{children}</div>
              </div>
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}

export function AccountTab() {
  const loginRequired = isLoginRequired()
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const setSession = useAuthStore((s) => s.setSession)
  const settings = useSettingsStore((s) => s.settings)
  const apiBase = resolveApiBase(settings?.apiBaseUrl)

  const [loading, setLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [bindPhone, setBindPhone] = useState('')
  const [bindCode, setBindCode] = useState('')
  const [smsCooldown, setSmsCooldown] = useState(0)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [bindPhoneDialogOpen, setBindPhoneDialogOpen] = useState(false)
  const [nicknameDialogOpen, setNicknameDialogOpen] = useState(false)
  const [nicknameInput, setNicknameInput] = useState('')
  const [avatarUploading, setAvatarUploading] = useState(false)

  useEffect(() => {
    if (!loginRequired || !token) return
    void fetchClientProfile(token, apiBase, { reportSessionExpired: true })
      .then((profile) => {
        if (profile) setSession(token, profile)
      })
      .catch(() => {
        /* 超时/网络失败时保留本地资料 */
      })
  }, [apiBase, loginRequired, setSession, token])

  useEffect(() => {
    if (smsCooldown <= 0) return
    const t = window.setInterval(() => setSmsCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000)
    return () => window.clearInterval(t)
  }, [smsCooldown])

  const closePasswordDialog = useCallback(() => {
    setPasswordDialogOpen(false)
    setOldPassword('')
    setNewPassword('')
    setConfirmNewPassword('')
  }, [])

  const closeBindPhoneDialog = useCallback(() => {
    setBindPhoneDialogOpen(false)
    setBindPhone('')
    setBindCode('')
  }, [])

  const openBindPhoneDialog = useCallback(() => {
    setBindPhone(user?.phone || '')
    setBindCode('')
    setBindPhoneDialogOpen(true)
  }, [user?.phone])

  const openNicknameDialog = useCallback(() => {
    setNicknameInput(user?.nickname || '')
    setNicknameDialogOpen(true)
  }, [user?.nickname])

  const closeNicknameDialog = useCallback(() => {
    setNicknameDialogOpen(false)
    setNicknameInput('')
  }, [])

  if (!loginRequired) {
    return (
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">账户</h2>
        <p className="text-sm text-muted-foreground">当前为本地模式。设置 VITE_LOGIN_REQUIRED=true 后可管理云端账户。</p>
      </div>
    )
  }

  if (!token || !user) {
    return (
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">账户</h2>
        <p className="text-sm text-muted-foreground">请先登录后再管理账户信息。</p>
      </div>
    )
  }

  const hasUsername = Boolean(user.username)
  const displayNickname = user.nickname?.trim() || user.username || '用户'
  const avatarFallback = displayNickname.slice(0, 1).toUpperCase()
  const passwordMismatch = confirmNewPassword.length > 0 && newPassword !== confirmNewPassword
  const canSubmitPassword =
    newPassword.length >= 8 &&
    newPassword === confirmNewPassword &&
    (!user.has_password || oldPassword.length > 0)

  async function handleCopyInvite() {
    if (!user?.invite_code) return
    try {
      await navigator.clipboard.writeText(user.invite_code)
      toast.success('邀请码已复制，分享给好友注册即可')
    } catch {
      toast.error('复制失败')
    }
  }

  async function handleSetNickname() {
    if (!token) return
    const next = nicknameInput.trim()
    if (!next) {
      toast.error('请输入昵称')
      return
    }
    setLoading(true)
    try {
      const profile = await setAccountNickname(token, next, apiBase)
      setSession(token, profile)
      toast.success('昵称已更新')
      closeNicknameDialog()
    } catch (err) {
      toast.error(formatAuthFetchError(err, apiBase))
    } finally {
      setLoading(false)
    }
  }

  async function handleAvatarPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !token) return
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('头像大小不能超过 2MB')
      return
    }
    setAvatarUploading(true)
    try {
      const profile = await uploadAccountAvatar(token, file, apiBase)
      setSession(token, profile)
      toast.success('头像已更新')
    } catch (err) {
      toast.error(formatAuthFetchError(err, apiBase))
    } finally {
      setAvatarUploading(false)
    }
  }

  async function handleSetUsername() {
    if (!token) return
    setLoading(true)
    try {
      const profile = await setAccountUsername(token, username.trim(), apiBase)
      setSession(token, profile)
      toast.success('用户名设置成功')
      setUsername('')
    } catch (err) {
      toast.error(formatAuthFetchError(err, apiBase))
    } finally {
      setLoading(false)
    }
  }

  async function handleSetPassword() {
    if (!token) return
    if (newPassword !== confirmNewPassword) {
      toast.error('两次输入的新密码不一致')
      return
    }
    setLoading(true)
    try {
      const profile = await setAccountPassword(
        token,
        newPassword,
        user?.has_password ? oldPassword : undefined,
        apiBase,
      )
      setSession(token, profile)
      toast.success(user?.has_password ? '密码已修改' : '密码设置成功')
      closePasswordDialog()
    } catch (err) {
      toast.error(formatAuthFetchError(err, apiBase))
    } finally {
      setLoading(false)
    }
  }

  async function handleSendBindSms() {
    if (!bindPhone.trim() || bindPhone.length !== 11) {
      toast.error('请输入正确的手机号')
      return
    }
    try {
      await sendSmsCode(bindPhone.trim(), apiBase, 'bind')
      setSmsCooldown(SMS_COOLDOWN_SEC)
      toast.success('验证码已发送')
    } catch (err) {
      toast.error(formatAuthFetchError(err, apiBase))
    }
  }

  async function handleBindPhone() {
    if (!token) return
    setLoading(true)
    try {
      const profile = await bindAccountPhone(token, bindPhone.trim(), bindCode.trim(), apiBase)
      setSession(token, profile)
      toast.success('手机绑定成功')
      closeBindPhoneDialog()
    } catch (err) {
      toast.error(formatAuthFetchError(err, apiBase))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h2 className="text-lg font-semibold">账户</h2>
          <p className="text-sm text-muted-foreground mt-1">
            好豆余额与明细、账户信息与安全设置。充值套餐仅内部员工可见。
          </p>
        </div>

        <section className="space-y-3 rounded-xl border border-border/30 bg-card/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-medium">账户概览</h3>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-3"
                onClick={openBindPhoneDialog}
              >
                {user.phone ? '更换手机' : '绑定手机'}
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 px-3 shadow-sm"
                onClick={() => setPasswordDialogOpen(true)}
              >
                <KeyRound className="h-4 w-4 mr-1.5" />
                {user.has_password ? '重置密码' : '设置密码'}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="relative shrink-0 cursor-pointer group">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                disabled={avatarUploading}
                onChange={(e) => void handleAvatarPick(e)}
              />
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt=""
                  className="h-16 w-16 rounded-full object-cover ring-2 ring-border/50"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-lg font-semibold text-primary ring-2 ring-border/50">
                  {avatarFallback}
                </div>
              )}
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                {avatarUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : '更换'}
              </span>
            </label>
            <div className="min-w-0 space-y-1">
              <p className="text-base font-medium truncate">{displayNickname}</p>
              <p className="text-xs text-muted-foreground">点击头像可上传，支持 JPG / PNG / WebP，最大 2MB</p>
            </div>
          </div>

          <dl className="grid grid-cols-[88px_1fr] gap-2 text-sm sm:grid-cols-[100px_1fr]">
            <dt className="text-muted-foreground">用户名</dt>
            <dd>
              {hasUsername ? (
                <span>
                  {user.username}
                  <span className="text-muted-foreground">（用于登录，设置后不可修改）</span>
                </span>
              ) : (
                '未设置'
              )}
            </dd>
            <dt className="text-muted-foreground">昵称</dt>
            <dd className="flex items-center gap-2 min-w-0">
              <span className="truncate">{user.nickname || '未设置'}</span>
              <button
                type="button"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                title="修改昵称"
                onClick={openNicknameDialog}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </dd>
            <dt className="text-muted-foreground">手机</dt>
            <dd>{user.phone || '未绑定'}</dd>
            <dt className="text-muted-foreground">微信</dt>
            <dd>{user.wechat_bound ? '已绑定' : '未绑定（服务号上线后可绑定）'}</dd>
            <dt className="text-muted-foreground">好豆</dt>
            <dd className="flex items-center gap-1.5 font-semibold tabular-nums text-amber-600 dark:text-amber-400">
              <HaodouIcon size={16} />
              {user.bells ?? user.remaining_quota ?? 0}
            </dd>
            <dt className="text-muted-foreground">已邀请</dt>
            <dd>{user.invited_count ?? 0} 人</dd>
            <dt className="text-muted-foreground">我的邀请码</dt>
            <dd className="flex items-center gap-2">
              {user.invite_code ? (
                <>
                  <span className="font-mono text-primary">{user.invite_code}</span>
                  <button type="button" onClick={() => void handleCopyInvite()} className="text-muted-foreground hover:text-foreground" title="复制邀请码">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                '-'
              )}
            </dd>
          </dl>
          <p className="text-xs text-muted-foreground leading-relaxed">
            好友注册时填写你的邀请码，双方可获得平台奖励。
          </p>
        </section>

        <HaodouLedgerSection />

        <HaodouRechargeSection />

        {!hasUsername && (
          <section className="space-y-3 rounded-xl border border-border/30 bg-card/30 p-4">
            <h3 className="text-sm font-medium">设置用户名</h3>
            <p className="text-xs text-muted-foreground">仅可设置一次。</p>
            <div className="space-y-2">
              <Label>用户名</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="4-32 位字母、数字或下划线" maxLength={32} />
            </div>
            <Button disabled={loading || username.trim().length < 4} onClick={() => void handleSetUsername()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '保存用户名'}
            </Button>
          </section>
        )}
      </div>

      <AccountDialog open={nicknameDialogOpen} title="修改昵称" onClose={closeNicknameDialog}>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            昵称用于界面展示；用户名仅用于登录，二者相互独立。
          </p>
          <div className="space-y-2">
            <Label>昵称</Label>
            <Input
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              placeholder="1-32 个字符"
              maxLength={32}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={closeNicknameDialog} disabled={loading}>
              取消
            </Button>
            <Button
              disabled={loading || !nicknameInput.trim()}
              onClick={() => void handleSetNickname()}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '保存'}
            </Button>
          </div>
        </div>
      </AccountDialog>

      <AccountDialog
        open={passwordDialogOpen}
        title={user.has_password ? '重置密码' : '设置密码'}
        onClose={closePasswordDialog}
      >
        <div className="space-y-4">
          {user.has_password ? (
            <div className="space-y-2">
              <Label>原密码</Label>
              <Input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>新密码</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="至少 8 位"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label>确认新密码</Label>
            <Input
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              placeholder="再次输入新密码"
              autoComplete="new-password"
            />
            {passwordMismatch ? (
              <p className="text-xs text-destructive">两次输入的新密码不一致</p>
            ) : null}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={closePasswordDialog} disabled={loading}>
              取消
            </Button>
            <Button disabled={loading || !canSubmitPassword} onClick={() => void handleSetPassword()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '确认修改'}
            </Button>
          </div>
        </div>
      </AccountDialog>

      <AccountDialog open={bindPhoneDialogOpen} title="绑定手机" onClose={closeBindPhoneDialog}>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">可绑定或更换手机号（短信功能上线后生效）。</p>
          <div className="space-y-2">
            <Label>手机号</Label>
            <Input
              value={bindPhone}
              onChange={(e) => setBindPhone(e.target.value)}
              placeholder="11 位手机号"
              maxLength={11}
            />
          </div>
          <div className="flex gap-2">
            <Input
              value={bindCode}
              onChange={(e) => setBindCode(e.target.value)}
              placeholder="验证码"
              maxLength={6}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              disabled={smsCooldown > 0 || bindPhone.length !== 11}
              onClick={() => void handleSendBindSms()}
              className="shrink-0"
            >
              {smsCooldown > 0 ? `${smsCooldown}s` : '发送'}
            </Button>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={closeBindPhoneDialog} disabled={loading}>
              取消
            </Button>
            <Button
              disabled={loading || bindPhone.length !== 11 || bindCode.length < 4}
              onClick={() => void handleBindPhone()}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '绑定手机'}
            </Button>
          </div>
        </div>
      </AccountDialog>
    </>
  )
}
