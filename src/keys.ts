export type Provider = 'rapidapi' | 'apify' | 'scraperapi' | 'dropbox'
export type KeyStatus = 'unknown' | 'active' | 'quota' | 'invalid' | 'testing'

export type ApiKey = {
  id: string
  provider: Provider
  label: string
  value: string
  status: KeyStatus
  message: string
  addedAt: number
  usedAt?: number
  successCount: number
  failCount: number
}

const STORAGE = 'tikload_keys_v2'

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }

export function loadKeys(): ApiKey[] {
  try { return JSON.parse(localStorage.getItem(STORAGE) || '[]') }
  catch { return [] }
}

export function saveKeys(keys: ApiKey[]) {
  try { localStorage.setItem(STORAGE, JSON.stringify(keys)) } catch {}
}

export function addKey(keys: ApiKey[], provider: Provider, label: string, value: string): ApiKey[] {
  const trimmed = value.trim()
  if (!trimmed) return keys
  if (keys.some(k => k.provider === provider && k.value === trimmed)) return keys
  return [...keys, {
    id: uid(), provider, label: label || defaultLabel(provider, keys), value: trimmed,
    status: 'unknown', message: '', addedAt: Date.now(), successCount: 0, failCount: 0,
  }]
}

export function removeKey(keys: ApiKey[], id: string): ApiKey[] {
  return keys.filter(k => k.id !== id)
}

export function updateKeyStatus(keys: ApiKey[], id: string, status: KeyStatus, message = ''): ApiKey[] {
  return keys.map(k => k.id === id ? { ...k, status, message } : k)
}

export function markKeyUsed(keys: ApiKey[], id: string, success: boolean): ApiKey[] {
  return keys.map(k => k.id !== id ? k : {
    ...k,
    usedAt: Date.now(),
    successCount: success ? k.successCount + 1 : k.successCount,
    failCount:    success ? k.failCount : k.failCount + 1,
    status: success ? 'active' : k.failCount >= 2 ? 'quota' : k.status,
  })
}

export function getKeysByProvider(keys: ApiKey[], provider: Provider): ApiKey[] {
  return keys.filter(k => k.provider === provider && k.status !== 'invalid')
}

export function buildKeysHeader(keys: ApiKey[]): string {
  return JSON.stringify({
    rapidapi:   getKeysByProvider(keys, 'rapidapi').map(k => k.value),
    apify:      getKeysByProvider(keys, 'apify').map(k => k.value),
    scraperapi: getKeysByProvider(keys, 'scraperapi').map(k => k.value),
  })
}

export function getDropboxToken(keys: ApiKey[]): string | null {
  return keys.find(k => k.provider === 'dropbox' && k.status !== 'invalid')?.value || null
}

function defaultLabel(p: Provider, keys: ApiKey[]): string {
  const count = keys.filter(k => k.provider === p).length + 1
  const names: Record<Provider, string> = {
    rapidapi:   'RapidAPI',
    apify:      'Apify',
    scraperapi: 'ScraperAPI',
    dropbox:    'Dropbox',
  }
  return `${names[p]} #${count}`
}

export const PROVIDER_INFO: Record<Provider, {
  label: string
  icon: string
  color: string
  glow: string
  border: string
  placeholder: string
  helpUrl: string
  helpText: string
  isTikTok: boolean
}> = {
  rapidapi: {
    label: 'RapidAPI',
    icon: '⚡',
    color: '#00e5ff',
    glow: 'rgba(0,229,255,.15)',
    border: 'rgba(0,229,255,.25)',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    helpUrl: 'https://rapidapi.com/tikwm-tikwm-default/api/tiktok-scraper7',
    helpText: '500 طلب/شهر مجاناً',
    isTikTok: true,
  },
  apify: {
    label: 'Apify',
    icon: '🕷️',
    color: '#1cec84',
    glow: 'rgba(28,236,132,.12)',
    border: 'rgba(28,236,132,.22)',
    placeholder: 'apify_api_xxxxxxxxxxxx',
    helpUrl: 'https://apify.com/clockworks/tiktok-profile-scraper',
    helpText: '5$ رصيد مجاني عند التسجيل',
    isTikTok: true,
  },
  scraperapi: {
    label: 'ScraperAPI',
    icon: '🔄',
    color: '#ff9500',
    glow: 'rgba(255,149,0,.12)',
    border: 'rgba(255,149,0,.22)',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    helpUrl: 'https://www.scraperapi.com/',
    helpText: '1000 طلب مجاناً',
    isTikTok: true,
  },
  dropbox: {
    label: 'Dropbox',
    icon: '☁️',
    color: '#0061ff',
    glow: 'rgba(0,97,255,.12)',
    border: 'rgba(0,97,255,.22)',
    placeholder: 'sl.u.xxxxxxxxxxxxxxx',
    helpUrl: 'https://www.dropbox.com/developers/apps',
    helpText: 'رفع تلقائي على /videos',
    isTikTok: false,
  },
}
