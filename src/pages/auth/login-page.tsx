import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, RefreshCw } from 'lucide-react'
import { AuthLayout } from '@/components/auth/auth-layout'
import { requestAppUpdateCheck } from '@/components/update/app-update-host'
import { cn } from '@/lib/utils'
import { isElectronApp } from '@/lib/update/app-updater'
import { resolveApiBase, syncApiBaseToStorage } from '@/lib/auth/api-base'
import {
  formatAuthFetchError,
  checkUsernameAvailable,
  loginAccount,
  loginWithSms,
  registerAccount,
  sendSmsCode,
} from '@/lib/auth/auth-service'
import {
  createWechatQrcodeSession,
  formatAuthFetchError as formatWechatError,
  pollWechatLogin,
} from '@/lib/auth/wechat-auth-service'
import {
  isAccountLoginEnabled,
  isSmsLoginEnabled,
  isWechatLoginEnabled,
} from '@/lib/auth/login-mode'
import { useAuthStore } from '@/stores/auth-store'
import { useSettingsStore } from '@/stores/settings-store'

const POLL_INTERVAL_MS = 2000
const SMS_COOLDOWN_SEC = 60

type LoginTab = 'wechat' | 'phone' | 'account'
type QrPhase = 'loading' | 'ready' | 'expired' | 'error'
type AccountMode = 'login' | 'register'
type UsernameAvailability = 'idle' | 'checking' | 'available' | 'taken'

const USERNAME_MIN_LENGTH = 4

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 py-2.5 text-sm font-medium transition-colors rounded-lg',
        active
          ? 'bg-white/10 text-white'
          : 'text-white/45 hover:text-white/70',
      )}
    >
      {children}
    </button>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm text-white/60 mb-1.5 text-left">{children}</label>
}

function FieldInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  maxLength,
  onBlur,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  maxLength?: number
  onBlur?: () => void
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      maxLength={maxLength}
      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/25 outline-none focus:border-white/25 transition-colors"
    />
  )
}

function WechatLoginPanel({
  apiBase,
  locationKey,
  sessionExpiredHint,
  onSuccess,
}: {
  apiBase: string
  locationKey: string
  sessionExpiredHint: string
  onSuccess: (token: string, user: import('@/types/auth').AuthUser) => void
}) {
  const [phase, setPhase] = useState<QrPhase>('loading')
  const [qrcodeUrl, setQrcodeUrl] = useState('')
  const [sceneId, setSceneId] = useState('')
  const [error, setError] = useState('')
  const [hint, setHint] = useState('请使用微信扫描二维码登录')

  const pollingRef = useRef(false)
  const sceneRef = useRef('')
  const pollTimerRef = useRef<number | null>(null)
  const countdownTimerRef = useRef<number | null>(null)
  const loadGenerationRef = useRef(0)
  const qrLoadedVisitKeyRef = useRef<string | null>(null)
  const [countdown, setCountdown] = useState(0)

  const stopPolling = useCallback(() => {
    pollingRef.current = false
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const stopCountdown = useCallback(() => {
    if (countdownTimerRef.current !== null) {
      window.clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
  }, [])

  const startCountdown = useCallback(
    (seconds: number) => {
      stopCountdown()
      setCountdown(seconds)
      countdownTimerRef.current = window.setInterval(() => {
        setCountdown((prev) => (prev <= 1 ? 0 : prev - 1))
      }, 1000)
    },
    [stopCountdown],
  )

  const pollOnce = useCallback(async () => {
    if (!pollingRef.current || !sceneRef.current) return
    try {
      const result = await pollWechatLogin(sceneRef.current, apiBase)
      if (!pollingRef.current) return
      if (result.status === 'pending') {
        pollTimerRef.current = window.setTimeout(() => void pollOnce(), POLL_INTERVAL_MS)
        return
      }
      if (result.status === 'expired' || result.status === 'consumed') {
        stopPolling()
        stopCountdown()
        setPhase('expired')
        setHint(result.status === 'expired' ? '二维码已过期，请点击刷新' : '二维码已失效，请点击刷新')
        setError(result.message || '')
        return
      }
      if (result.status === 'error') {
        stopPolling()
        setPhase('error')
        setError(result.message || '登录失败')
        return
      }
      if (result.status === 'confirmed' && result.accessToken && result.user) {
        stopPolling()
        stopCountdown()
        onSuccess(result.accessToken, result.user)
      }
    } catch (err) {
      if (!pollingRef.current) return
      stopPolling()
      setPhase('error')
      setError(formatWechatError(err, apiBase))
    }
  }, [apiBase, onSuccess, stopCountdown, stopPolling])

  const loadQrcode = useCallback(
    async (options?: { force?: boolean }) => {
      if (!options?.force && qrLoadedVisitKeyRef.current === locationKey) return
      const generation = ++loadGenerationRef.current
      stopPolling()
      stopCountdown()
      setPhase('loading')
      setError('')
      setHint('正在获取二维码...')
      setQrcodeUrl('')
      sceneRef.current = ''
      try {
        syncApiBaseToStorage(apiBase)
        const session = await createWechatQrcodeSession(apiBase)
        if (generation !== loadGenerationRef.current) return
        qrLoadedVisitKeyRef.current = locationKey
        sceneRef.current = session.sceneId
        setSceneId(session.sceneId)
        setQrcodeUrl(session.qrcodeUrl)
        startCountdown(session.expireSeconds)
        setPhase('ready')
        setHint('请使用微信扫描二维码登录')
        pollingRef.current = true
        void pollOnce()
      } catch (err) {
        if (generation !== loadGenerationRef.current) return
        setPhase('error')
        setError(formatWechatError(err, apiBase))
        setHint('获取二维码失败')
      }
    },
    [apiBase, locationKey, pollOnce, startCountdown, stopCountdown, stopPolling],
  )

  useEffect(() => {
    if (qrLoadedVisitKeyRef.current === locationKey) return
    void loadQrcode()
    return () => {
      loadGenerationRef.current += 1
      stopPolling()
      stopCountdown()
    }
  }, [locationKey, loadQrcode, stopCountdown, stopPolling])

  useEffect(() => {
    if (phase !== 'ready' || countdown > 0) return
    stopPolling()
    setPhase('expired')
    setHint('二维码已过期，请点击刷新')
  }, [countdown, phase, stopPolling])

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <div
          className={cn(
            'rounded-2xl bg-white p-3 shadow-lg shadow-black/20 border border-white/20',
            phase === 'loading' && 'animate-pulse',
          )}
        >
          {qrcodeUrl && phase !== 'loading' ? (
            <img
              src={qrcodeUrl}
              alt="微信登录二维码"
              width={200}
              height={200}
              className={cn(
                'block w-[200px] h-[200px]',
                (phase === 'expired' || phase === 'error') && 'opacity-30 blur-[1px]',
              )}
            />
          ) : (
            <div className="w-[200px] h-[200px] flex items-center justify-center bg-white">
              <Loader2 className="h-10 w-10 animate-spin text-black/20" />
            </div>
          )}
        </div>
        {(phase === 'expired' || phase === 'error') && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40">
            <button
              type="button"
              onClick={() => {
                qrLoadedVisitKeyRef.current = null
                void loadQrcode({ force: true })
              }}
              className="flex items-center gap-2 rounded-full bg-white text-black px-4 py-2 text-sm font-medium hover:bg-white/90"
            >
              <RefreshCw className="h-4 w-4" />
              刷新二维码
            </button>
          </div>
        )}
      </div>
      <p className="text-sm text-white/60">{hint}</p>
      {phase === 'ready' && countdown > 0 ? (
        <p className="text-xs text-white/35">
          二维码 {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')} 后过期
        </p>
      ) : null}
      {(error || sessionExpiredHint) && (
        <p className="text-red-400/90 text-sm">{sessionExpiredHint || error}</p>
      )}
      {sceneId ? (
        <span className="text-white/20 font-mono text-[10px] truncate">{apiBase}</span>
      ) : null}
    </div>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const redirectUrl = searchParams.get('redirect') || '/dashboard'
  const reason = searchParams.get('reason')
  const setSession = useAuthStore((s) => s.setSession)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const settings = useSettingsStore((s) => s.settings)
  const settingsLoading = useSettingsStore((s) => s.loading)
  const loadSettings = useSettingsStore((s) => s.load)

  useEffect(() => {
    if (reason !== 'session_expired') return
    clearAuth()
  }, [clearAuth, reason])

  const [tab, setTab] = useState<LoginTab>('account')
  const wechatEnabled = isWechatLoginEnabled()
  const smsEnabled = isSmsLoginEnabled()
  const accountEnabled = isAccountLoginEnabled()
  const multiLoginMode = [wechatEnabled, smsEnabled, accountEnabled].filter(Boolean).length > 1
  const [accountMode, setAccountMode] = useState<AccountMode>('login')
  const [showSuccess, setShowSuccess] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [phone, setPhone] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [phoneInviteCode, setPhoneInviteCode] = useState('')
  const [smsCooldown, setSmsCooldown] = useState(0)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [accountInviteCode, setAccountInviteCode] = useState('')
  const [usernameAvailability, setUsernameAvailability] = useState<UsernameAvailability>('idle')
  const usernameCheckSeqRef = useRef(0)
  const lastCheckedUsernameRef = useRef('')
  const lastAvailabilityResultRef = useRef<'available' | 'taken' | null>(null)

  const switchAccountMode = useCallback((mode: AccountMode) => {
    setAccountMode(mode)
    setError('')
    setConfirmPassword('')
    setUsernameAvailability('idle')
    lastCheckedUsernameRef.current = ''
    lastAvailabilityResultRef.current = null
    if (mode === 'login') {
      setAccountInviteCode('')
    }
  }, [])

  useEffect(() => {
    if (!settings) void loadSettings()
  }, [loadSettings, settings])

  const apiBase = resolveApiBase(settings?.apiBaseUrl)

  const checkRegisterUsername = useCallback(
    async (rawUsername: string): Promise<boolean> => {
      const trimmed = rawUsername.trim()
      if (trimmed.length < USERNAME_MIN_LENGTH) {
        setUsernameAvailability('idle')
        lastCheckedUsernameRef.current = ''
        lastAvailabilityResultRef.current = null
        return false
      }
      if (lastCheckedUsernameRef.current === trimmed && lastAvailabilityResultRef.current) {
        setUsernameAvailability(lastAvailabilityResultRef.current)
        return lastAvailabilityResultRef.current === 'available'
      }

      const seq = ++usernameCheckSeqRef.current
      setUsernameAvailability('checking')
      try {
        syncApiBaseToStorage(apiBase)
        const available = await checkUsernameAvailable(trimmed, apiBase)
        if (seq !== usernameCheckSeqRef.current) return available
        lastCheckedUsernameRef.current = trimmed
        lastAvailabilityResultRef.current = available ? 'available' : 'taken'
        setUsernameAvailability(lastAvailabilityResultRef.current)
        return available
      } catch (err) {
        if (seq !== usernameCheckSeqRef.current) return false
        setUsernameAvailability('idle')
        lastCheckedUsernameRef.current = ''
        lastAvailabilityResultRef.current = null
        setError(formatAuthFetchError(err, apiBase))
        return false
      }
    },
    [apiBase],
  )

  const handleUsernameChange = useCallback((value: string) => {
    setUsername(value)
    setError('')
    if (accountMode !== 'register') return
    const trimmed = value.trim()
    if (trimmed !== lastCheckedUsernameRef.current) {
      setUsernameAvailability('idle')
      lastAvailabilityResultRef.current = null
    }
  }, [accountMode])

  const handleUsernameBlur = useCallback(() => {
    if (accountMode !== 'register') return
    void checkRegisterUsername(username)
  }, [accountMode, checkRegisterUsername, username])

  useEffect(() => {
    if (smsCooldown <= 0) return
    const t = window.setInterval(() => setSmsCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000)
    return () => window.clearInterval(t)
  }, [smsCooldown])

  const handleAuthSuccess = useCallback(
    (accessToken: string, user: import('@/types/auth').AuthUser) => {
      setSession(accessToken, user)
      setShowSuccess(true)
    },
    [setSession],
  )

  const handleSendSms = async () => {
    setError('')
    if (!phone.trim() || phone.length !== 11) {
      setError('请输入正确的手机号')
      return
    }
    try {
      syncApiBaseToStorage(apiBase)
      await sendSmsCode(phone.trim(), apiBase)
      setSmsCooldown(SMS_COOLDOWN_SEC)
    } catch (err) {
      setError(formatAuthFetchError(err, apiBase))
    }
  }

  const handlePhoneLogin = async () => {
    setError('')
    setSubmitting(true)
    try {
      syncApiBaseToStorage(apiBase)
      const result = await loginWithSms(
        phone.trim(),
        smsCode.trim(),
        phoneInviteCode.trim() || undefined,
        apiBase,
      )
      handleAuthSuccess(result.accessToken, result.user)
    } catch (err) {
      setError(formatAuthFetchError(err, apiBase))
    } finally {
      setSubmitting(false)
    }
  }

  const handleAccountSubmit = async () => {
    setError('')
    if (accountMode === 'register') {
      if (password !== confirmPassword) {
        setError('两次输入的密码不一致')
        return
      }
      const available = await checkRegisterUsername(username)
      if (!available) {
        setError('用户名已被占用，请换一个')
        return
      }
    }
    setSubmitting(true)
    try {
      syncApiBaseToStorage(apiBase)
      const result =
        accountMode === 'register'
          ? await registerAccount(
              username.trim(),
              password,
              accountInviteCode.trim() || undefined,
              apiBase,
            )
          : await loginAccount(username.trim(), password, apiBase)
      handleAuthSuccess(result.accessToken, result.user)
    } catch (err) {
      setError(formatAuthFetchError(err, apiBase))
    } finally {
      setSubmitting(false)
    }
  }

  const trimmedUsername = username.trim()
  const canPhoneSubmit = phone.length === 11 && smsCode.length >= 4 && !submitting
  const canAccountSubmit =
    !submitting &&
    usernameAvailability !== 'checking' &&
    (accountMode === 'login'
      ? trimmedUsername.length > 0 && password.length > 0
      : trimmedUsername.length >= USERNAME_MIN_LENGTH &&
        password.length >= 8 &&
        confirmPassword.length >= 8 &&
        password === confirmPassword &&
        usernameAvailability !== 'taken')

  const sessionExpiredHint = reason === 'session_expired' ? '登录已过期，请重新登录' : ''

  if (settingsLoading && !settings) {
    return (
      <AuthLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-white/30" />
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      showSuccess={showSuccess}
      successTitle="登录成功"
      successSubtitle="正在进入控制面板"
      onTransitionComplete={() =>
        navigate(redirectUrl.startsWith('/') ? redirectUrl : '/dashboard', { replace: true })
      }
    >
      <div className="space-y-2 text-left">
        <h1 className="text-[2rem] font-bold leading-[1.1] tracking-tight text-white text-center">
          {accountEnabled && accountMode === 'register' && tab === 'account'
            ? '创建账号'
            : '欢迎回来'}
        </h1>
        <p className="text-base text-white/50 font-light text-center">
          {accountEnabled && accountMode === 'register' && tab === 'account'
            ? '填写信息完成注册，开启你的 AI 创作之旅'
            : accountEnabled && !wechatEnabled && !smsEnabled
              ? '登录以继续你的 AI 创作之旅'
              : '登录以继续你的 AI 创作之旅'}
        </p>
      </div>

      {multiLoginMode ? (
        <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
          {wechatEnabled ? (
            <TabButton active={tab === 'wechat'} onClick={() => setTab('wechat')}>微信扫码</TabButton>
          ) : null}
          {smsEnabled ? (
            <TabButton active={tab === 'phone'} onClick={() => setTab('phone')}>手机登录</TabButton>
          ) : null}
          {accountEnabled ? (
            <TabButton active={tab === 'account'} onClick={() => setTab('account')}>账号登录</TabButton>
          ) : null}
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        <motion.div
          key={multiLoginMode ? tab : 'account'}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="space-y-4 text-left"
        >
          {wechatEnabled && tab === 'wechat' && (
            <WechatLoginPanel
              apiBase={apiBase}
              locationKey={location.key}
              sessionExpiredHint={sessionExpiredHint}
              onSuccess={handleAuthSuccess}
            />
          )}

          {smsEnabled && tab === 'phone' && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (canPhoneSubmit) void handlePhoneLogin()
              }}
            >
              <div>
                <FieldLabel>手机号</FieldLabel>
                <FieldInput
                  value={phone}
                  onChange={setPhone}
                  placeholder="请输入手机号"
                  maxLength={11}
                />
              </div>
              <div>
                <FieldLabel>验证码</FieldLabel>
                <div className="flex gap-2">
                  <FieldInput
                    value={smsCode}
                    onChange={setSmsCode}
                    placeholder="000000"
                    maxLength={6}
                  />
                  <button
                    type="button"
                    disabled={smsCooldown > 0 || phone.length !== 11}
                    onClick={() => void handleSendSms()}
                    className={cn(
                      'shrink-0 rounded-xl px-4 py-3 text-sm font-medium transition-colors',
                      smsCooldown > 0 || phone.length !== 11
                        ? 'bg-white/5 text-white/30'
                        : 'bg-white/10 text-white hover:bg-white/15',
                    )}
                  >
                    {smsCooldown > 0 ? `${smsCooldown}s` : '发送'}
                  </button>
                </div>
              </div>
              <div>
                <FieldLabel>邀请码（选填）</FieldLabel>
                <FieldInput
                  value={phoneInviteCode}
                  onChange={setPhoneInviteCode}
                  placeholder="有邀请码可填写"
                  maxLength={16}
                />
              </div>
              <p className="text-xs text-white/35">新用户注册得 20 好豆</p>
              <button
                type="submit"
                disabled={!canPhoneSubmit}
                className={cn(
                  'w-full rounded-xl py-3.5 text-base font-semibold transition-colors',
                  canPhoneSubmit
                    ? 'bg-white text-black hover:bg-white/90'
                    : 'bg-white/10 text-white/30',
                )}
              >
                {submitting ? '登录中...' : '登录'}
              </button>
              <p className="text-xs text-white/40 text-center">
                未注册手机号自动创建账号 · 已有密码可
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-white/60"
                  onClick={() => setTab('account')}
                >
                  账号登录
                </button>
              </p>
            </form>
          )}

          {(accountEnabled && (tab === 'account' || !multiLoginMode)) && (
            <>
              <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
                <TabButton
                  active={accountMode === 'login'}
                  onClick={() => switchAccountMode('login')}
                >
                  登录
                </TabButton>
                <TabButton
                  active={accountMode === 'register'}
                  onClick={() => switchAccountMode('register')}
                >
                  注册
                </TabButton>
              </div>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (canAccountSubmit) void handleAccountSubmit()
                }}
              >
                <div>
                  <FieldLabel>用户名</FieldLabel>
                  <FieldInput
                    value={username}
                    onChange={handleUsernameChange}
                    onBlur={accountMode === 'register' ? handleUsernameBlur : undefined}
                    placeholder="4-32 位字母、数字或下划线"
                    maxLength={32}
                  />
                  {accountMode === 'register' && trimmedUsername.length >= USERNAME_MIN_LENGTH ? (
                    <p
                      className={cn(
                        'mt-1.5 text-xs',
                        usernameAvailability === 'checking' && 'text-white/40',
                        usernameAvailability === 'available' && 'text-emerald-400/90',
                        usernameAvailability === 'taken' && 'text-red-400/90',
                      )}
                    >
                      {usernameAvailability === 'checking'
                        ? '正在检查用户名…'
                        : usernameAvailability === 'available'
                          ? '用户名可用'
                          : usernameAvailability === 'taken'
                            ? '用户名已被占用'
                            : null}
                    </p>
                  ) : null}
                </div>
                <div>
                  <FieldLabel>密码</FieldLabel>
                  <FieldInput
                    value={password}
                    onChange={setPassword}
                    placeholder="至少 8 位"
                    type="password"
                    maxLength={128}
                  />
                </div>
                {accountMode === 'register' && (
                  <div>
                    <FieldLabel>确认密码</FieldLabel>
                    <FieldInput
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      placeholder="再次输入密码"
                      type="password"
                      maxLength={128}
                    />
                  </div>
                )}
                {accountMode === 'register' && (
                  <div>
                    <FieldLabel>邀请码（选填）</FieldLabel>
                    <FieldInput
                      value={accountInviteCode}
                      onChange={setAccountInviteCode}
                      placeholder="填写好友的邀请码"
                      maxLength={16}
                    />
                  </div>
                )}
                <p className="text-xs text-white/35">
                  {accountMode === 'register'
                    ? '新用户注册得 20 好豆 · 注册后自动生成你的专属邀请码'
                    : '使用已注册的用户名和密码登录'}
                </p>
                <button
                  type="submit"
                  disabled={!canAccountSubmit}
                  className={cn(
                    'w-full rounded-xl py-3.5 text-base font-semibold transition-colors',
                    canAccountSubmit
                      ? 'bg-white text-black hover:bg-white/90'
                      : 'bg-white/10 text-white/30',
                  )}
                >
                  {submitting
                    ? accountMode === 'register'
                      ? '注册中...'
                      : '登录中...'
                    : accountMode === 'register'
                      ? '注册'
                      : '登录'}
                </button>
              </form>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {error && tab !== 'wechat' && (
        <p className="text-red-400/90 text-sm text-center">{error}</p>
      )}

      <p className="text-xs text-white/30 pt-2 text-center">
        {accountEnabled && !wechatEnabled && !smsEnabled
          ? accountMode === 'register'
            ? '注册成功后可在「设置 → 账户」查看专属邀请码'
            : '忘记密码请联系管理员 · 可在「设置 → 账户」修改密码'
          : '微信扫码或手机号即可自动注册 · 可在个人中心设置密码后用户名登录'}
        {isElectronApp() ? (
          <button
            type="button"
            onClick={() => requestAppUpdateCheck()}
            className="ml-2 text-white/40 underline-offset-2 hover:text-white/60 hover:underline"
          >
            检查更新
          </button>
        ) : null}
      </p>
    </AuthLayout>
  )
}
