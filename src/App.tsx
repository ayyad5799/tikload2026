import { useState, useCallback, useRef } from 'react'

/* ─── constants ─────────────────────────────────────── */
const API      = '/api/tikwm'
const DL_API   = '/api/download'
const MAX_DUR  = 5 * 60          // 5 دقائق بالثواني
const LIB_KEY  = 'tikload_v5'
const MONTH_MS = 30 * 24 * 60 * 60 * 1000

/* ─── types ─────────────────────────────────────────── */
type Video = {
  id: string
  cover: string
  origin_cover: string
  title: string
  duration: number
  play: string
  wmplay: string
  digg_count: number
  play_count: number
}
type LibItem = { id: string; cover: string; title: string; savedAt: number }
type Sort = 'default' | 'views' | 'likes' | 'shortest' | 'longest'
type Mode = 'device' | 'library'

/* ─── localStorage ──────────────────────────────────── */
function lsRead(): LibItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LIB_KEY) || '[]') as LibItem[]
    return raw.filter(x => Date.now() - x.savedAt < MONTH_MS)
  } catch { return [] }
}
function lsWrite(items: LibItem[]) {
  try { localStorage.setItem(LIB_KEY, JSON.stringify(items)) } catch {}
}

/* ─── helpers ───────────────────────────────────────── */
const n2s = (n: number) =>
  !n ? '0' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n)

const sec2str = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

const daysSince = (ts: number) => Math.floor((Date.now() - ts) / 86400000)

function parseHandle(v: string): string | null {
  v = v.trim()
  const m = v.match(/tiktok\.com\/@([^/?&\s]+)/)
  if (m) return m[1]
  if (v.startsWith('@')) return v.slice(1)
  if (!v.includes('/') && !v.includes('.') && v.length > 0) return v
  return null
}

const isVideoLink = (v: string) => v.includes('tiktok.com') && v.includes('/video/')

/* ─── CSS ───────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }
body {
  background: #070707;
  color: #e0e0e0;
  font-family: 'DM Sans', sans-serif;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

/* glow blobs */
.blob1 { position: fixed; width: 600px; height: 600px; border-radius: 50%;
  background: radial-gradient(circle, rgba(0,255,180,.055) 0%, transparent 65%);
  top: -220px; left: -220px; pointer-events: none; z-index: 0; }
.blob2 { position: fixed; width: 480px; height: 480px; border-radius: 50%;
  background: radial-gradient(circle, rgba(255,0,80,.04) 0%, transparent 65%);
  bottom: -140px; right: -140px; pointer-events: none; z-index: 0; }

.page { max-width: 1160px; margin: 0 auto; padding: 44px 20px 80px; position: relative; z-index: 1; }

/* header */
.logo-wrap { text-align: center; margin-bottom: 40px; }
.logo {
  font-family: 'Bebas Neue', cursive;
  font-size: clamp(56px, 9vw, 92px);
  letter-spacing: 6px; line-height: 1;
  background: linear-gradient(135deg, #fff 0%, #00ffb0 45%, #ff0050 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}
.logo-sub { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #2e2e2e; margin-top: 8px; }

/* tabs */
.tabs { display: flex; gap: 4px; margin-bottom: 24px;
  background: #0d0d0d; border: 1px solid #191919; border-radius: 13px; padding: 5px; width: fit-content; }
.tab-btn { padding: 8px 20px; border-radius: 9px; border: none;
  font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
  cursor: pointer; transition: all .2s; background: transparent; color: #3e3e3e;
  display: flex; align-items: center; gap: 6px; }
.tab-btn.on { background: #151515; color: #e0e0e0; }
.tab-badge { min-width: 17px; height: 17px; border-radius: 99px; background: #00ffb0;
  color: #000; font-size: 10px; font-weight: 700;
  display: inline-flex; align-items: center; justify-content: center; padding: 0 4px; }

/* mode toggle */
.mode-bar { display: flex; align-items: center; gap: 10px;
  background: #0d0d0d; border: 1px solid #191919; border-radius: 13px;
  padding: 13px 18px; margin-bottom: 16px; flex-wrap: wrap; }
.mode-lbl { font-size: 10px; font-weight: 700; letter-spacing: 2px;
  text-transform: uppercase; color: #282828; }
.mode-opts { display: flex; gap: 5px; }
.mode-btn { padding: 6px 15px; border-radius: 9px; border: 1px solid #1c1c1c;
  background: transparent; font-family: 'DM Sans', sans-serif; font-size: 13px;
  font-weight: 500; color: #3e3e3e; cursor: pointer; transition: all .2s; }
.mode-btn:hover { border-color: #282828; color: #666; }
.mode-btn.on { background: #101010; border-color: #00ffb0; color: #00ffb0; }
.mode-btn.on.lib { border-color: #a855f7; color: #a855f7; background: rgba(168,85,247,.06); }
.mode-desc { font-size: 12px; color: #252525; width: 100%; margin-top: 2px; }

/* search card */
.search-card { background: #0e0e0e; border: 1px solid #1a1a1a; border-radius: 17px;
  padding: 22px 26px; margin-bottom: 16px; transition: border-color .25s; }
.search-card:focus-within { border-color: #00ffb0; }
.field-lbl { display: block; font-size: 10px; font-weight: 700; letter-spacing: 2.5px;
  text-transform: uppercase; color: #262626; margin-bottom: 11px; }
.search-row { display: flex; gap: 10px; align-items: stretch; flex-wrap: wrap; }
.url-inp { flex: 1 1 240px; background: #070707; border: 1px solid #1a1a1a; border-radius: 10px;
  padding: 11px 15px; color: #e0e0e0; font-family: 'DM Sans', sans-serif; font-size: 14px;
  outline: none; transition: border-color .2s; min-height: 44px; }
.url-inp:focus { border-color: #00ffb0; }
.url-inp::placeholder { color: #202020; }
.examples { display: flex; gap: 7px; flex-wrap: wrap; margin-top: 11px; }
.ex-chip { font-size: 12px; padding: 4px 12px; background: #090909;
  border: 1px solid #171717; border-radius: 99px; color: #2a2a2a; cursor: pointer; transition: all .2s; }
.ex-chip:hover { border-color: #282828; color: #555; }

/* buttons */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 0 20px; min-height: 44px; border: none; border-radius: 10px;
  font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
  cursor: pointer; transition: all .2s; white-space: nowrap; }
.btn:disabled { opacity: .28; cursor: not-allowed !important; transform: none !important; box-shadow: none !important; }
.btn-fetch { background: linear-gradient(135deg, #00ffb0, #00b4ff); color: #000; }
.btn-fetch:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,255,176,.28); }
.btn-dl { background: linear-gradient(135deg, #ff0050, #ff4d00); color: #fff; }
.btn-dl:not(:disabled):hover { transform: translateY(-1px); }
.btn-lib { background: linear-gradient(135deg, #a855f7, #6366f1); color: #fff; }
.btn-lib:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(168,85,247,.28); }
.btn-more { background: #111; color: #4e4e4e; border: 1px solid #1c1c1c; }
.btn-more:not(:disabled):hover { border-color: #2e2e2e; color: #888; }
.btn-ghost { background: transparent; color: #4e4e4e; border: 1px solid #1a1a1a; }
.btn-ghost:not(:disabled):hover { border-color: #2e2e2e; color: #888; }
.btn-sm { padding: 0 13px; min-height: 32px; font-size: 12px; border-radius: 8px; }

/* alerts */
.alert { display: flex; align-items: flex-start; gap: 9px; padding: 11px 15px;
  border-radius: 10px; font-size: 13px; margin-bottom: 13px; line-height: 1.5; }
.alert-err { background: rgba(255,0,80,.05); border: 1px solid rgba(255,0,80,.14); color: #ff6070; }
.alert-ok  { background: rgba(0,255,176,.04); border: 1px solid rgba(0,255,176,.1); color: #00dda0; }
.alert-info{ background: #0e0e0e; border: 1px solid #1a1a1a; color: #4e4e4e; }
.alert-warn{ background: rgba(255,175,0,.04); border: 1px solid rgba(255,175,0,.12); color: #c08a00; }
.pulse { width: 7px; height: 7px; border-radius: 50%; background: #00ffb0;
  flex-shrink: 0; margin-top: 3px; animation: pu 1.6s infinite; }
@keyframes pu { 0%,100% { opacity: 1 } 50% { opacity: .2 } }

/* progress */
.prog-card { background: #0e0e0e; border: 1px solid #1a1a1a; border-radius: 13px;
  padding: 16px 20px; margin-bottom: 16px; }
.prog-head { display: flex; justify-content: space-between; margin-bottom: 9px; }
.prog-title { font-size: 13px; font-weight: 600; color: #aaa; }
.prog-pct   { font-size: 13px; color: #4e4e4e; }
.prog-track { height: 4px; background: #151515; border-radius: 99px; overflow: hidden; margin-bottom: 5px; }
.prog-fill  { height: 100%; border-radius: 99px; transition: width .3s; }
.prog-fill.dv { background: linear-gradient(90deg, #00ffb0, #00b4ff); }
.prog-fill.lb { background: linear-gradient(90deg, #a855f7, #6366f1); }
.prog-sub   { font-size: 11px; color: #2a2a2a; }

/* filters + toolbar */
.filter-row { display: flex; gap: 7px; flex-wrap: wrap; align-items: center; margin-bottom: 16px; }
.filter-lbl { font-size: 10px; color: #262626; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; }
.filter-btn { padding: 5px 12px; border-radius: 99px; border: 1px solid #171717;
  background: transparent; color: #333; font-family: 'DM Sans', sans-serif; font-size: 12px;
  cursor: pointer; transition: all .2s; }
.filter-btn:hover { border-color: #282828; color: #666; }
.filter-btn.on { background: #131313; border-color: #00ffb0; color: #00ffb0; }

.toolbar { display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 10px; margin-bottom: 13px; }
.toolbar-l { display: flex; align-items: center; gap: 11px; flex-wrap: wrap; }
.vid-count { font-family: 'Bebas Neue', cursive; font-size: 28px; letter-spacing: 1px; color: #00ffb0; line-height: 1; }
.vid-lbl   { font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #222; }

/* selection bar */
.sel-bar { background: #0d0d0d; border: 1px solid #191919; border-radius: 13px;
  padding: 13px 17px; margin-bottom: 16px;
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 11px; }
.sel-left { display: flex; align-items: center; gap: 10px; }
.sel-count { font-family: 'Bebas Neue', cursive; font-size: 22px; letter-spacing: 1px; }
.sel-count.dv { color: #00ffb0; }
.sel-count.lb { color: #a855f7; }
.sel-hint { font-size: 12px; color: #2e2e2e; }
.sel-right { display: flex; gap: 7px; flex-wrap: wrap; }

/* grid */
.vid-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(186px, 1fr)); gap: 12px; }

/* card */
.vcard { background: #0c0c0c; border: 2px solid transparent; border-radius: 14px;
  overflow: hidden; display: flex; flex-direction: column; user-select: none;
  transition: border-color .15s, transform .15s, box-shadow .15s; }
.vcard:hover { transform: translateY(-2px); border-color: #1c1c1c; }
.vcard.sel-dv { border-color: #00ffb0 !important; box-shadow: 0 0 16px rgba(0,255,176,.12); }
.vcard.sel-lb { border-color: #a855f7 !important; box-shadow: 0 0 16px rgba(168,85,247,.12); }

/* thumbnail = click area for selection */
.vthumb { position: relative; aspect-ratio: 9/16; overflow: hidden; background: #111; flex-shrink: 0; cursor: pointer; }
.vthumb img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .3s; }
.vcard:hover .vthumb img { transform: scale(1.04); }

.dur-badge { position: absolute; bottom: 7px; left: 7px;
  background: rgba(0,0,0,.72); backdrop-filter: blur(5px); color: #fff;
  font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 6px; pointer-events: none; }
.check-ring { position: absolute; top: 8px; right: 8px; width: 24px; height: 24px; border-radius: 50%;
  background: rgba(0,0,0,.55); border: 2px solid #2a2a2a;
  display: flex; align-items: center; justify-content: center; transition: all .15s; pointer-events: none; }
.vcard.sel-dv .check-ring { background: #00ffb0; border-color: #00ffb0; }
.vcard.sel-lb .check-ring { background: #a855f7; border-color: #a855f7; }
.check-tick { font-size: 12px; font-weight: 800; color: #000; opacity: 0; transition: opacity .15s; }
.vcard.sel-dv .check-tick, .vcard.sel-lb .check-tick { opacity: 1; }
.sel-order { position: absolute; top: 8px; left: 8px; min-width: 20px; height: 20px;
  border-radius: 99px; font-size: 11px; font-weight: 800;
  display: flex; align-items: center; justify-content: center; padding: 0 4px; pointer-events: none; }
.vcard.sel-dv .sel-order { background: #00ffb0; color: #000; }
.vcard.sel-lb .sel-order { background: #a855f7; color: #fff; }

.vcard-body { padding: 9px 11px 4px; flex: 1; }
.vcard-stats { display: flex; gap: 9px; font-size: 11px; color: #2e2e2e; margin-bottom: 4px; }
.vcard-title { font-size: 12px; color: #3a3a3a; line-height: 1.4;
  overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.vcard-foot { padding: 6px 10px 10px; display: flex; flex-direction: column; gap: 5px; }

.action-btn { width: 100%; min-height: 32px; border-radius: 8px; font-size: 12px; font-weight: 600;
  border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all .2s; }
.action-btn:disabled { opacity: .28; cursor: not-allowed; }
.action-btn.primary { background: linear-gradient(135deg, #00ffb0, #00b4ff); color: #000; }
.action-btn.primary:not(:disabled):hover { transform: translateY(-1px); }
.action-btn.purple { background: rgba(168,85,247,.1); color: #a855f7; border: 1px solid rgba(168,85,247,.2); }
.action-btn.purple:not(:disabled):hover { background: rgba(168,85,247,.18); }
.saved-badge { width: 100%; min-height: 28px; border-radius: 7px; font-size: 11px; font-weight: 600;
  border: 1px solid rgba(0,255,176,.14); background: rgba(0,255,176,.04); color: #009966;
  display: flex; align-items: center; justify-content: center; gap: 4px; }

.load-more-wrap { display: flex; justify-content: center; margin-top: 26px; }

/* skeletons */
.skel-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(186px, 1fr)); gap: 12px; }
.skel { background: #0c0c0c; border-radius: 14px; overflow: hidden; }
.skel-thumb { aspect-ratio: 9/16; background: linear-gradient(90deg, #0c0c0c 25%, #131313 50%, #0c0c0c 75%);
  background-size: 200% 100%; animation: shim 1.4s infinite; }
.skel-line { height: 9px; margin: 9px 11px 0; border-radius: 4px;
  background: linear-gradient(90deg, #0c0c0c 25%, #131313 50%, #0c0c0c 75%);
  background-size: 200% 100%; animation: shim 1.4s infinite; }
.skel-line.short { width: 55%; margin-bottom: 10px; }
@keyframes shim { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }

/* empty */
.empty { text-align: center; padding: 80px 20px; }
.empty-icon { font-size: 48px; margin-bottom: 14px; }
.empty-title { font-family: 'Bebas Neue', cursive; font-size: 32px; letter-spacing: 2px; color: #1a1a1a; margin-bottom: 6px; }
.empty-sub { font-size: 13px; color: #202020; }

/* library */
.lib-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 10px; }
.lib-title { font-family: 'Bebas Neue', cursive; font-size: 24px; letter-spacing: 2px; color: #383838; }
.lib-stats { display: flex; gap: 11px; flex-wrap: wrap; margin-bottom: 16px; }
.lib-stat { background: #0c0c0c; border: 1px solid #131313; border-radius: 10px; padding: 11px 16px; }
.lib-stat-n { font-family: 'Bebas Neue', cursive; font-size: 22px; color: #a855f7; }
.lib-stat-l { font-size: 11px; color: #262626; }
.lib-card { background: #0c0c0c; border: 1px solid #131313; border-radius: 12px;
  overflow: hidden; display: flex; flex-direction: column; transition: border-color .2s; }
.lib-card:hover { border-color: rgba(168,85,247,.22); }
.lib-thumb { position: relative; aspect-ratio: 9/16; overflow: hidden; background: #111; }
.lib-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.lib-age { position: absolute; top: 7px; left: 7px; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 5px; }
.lib-age.old { background: rgba(255,0,80,.72); color: #fff; }
.lib-age.ok  { background: rgba(0,255,176,.14); color: #00ffb0; }
.lib-body { padding: 9px 11px 11px; flex: 1; display: flex; flex-direction: column; gap: 5px; }
.lib-desc { font-size: 12px; color: #363636; line-height: 1.4;
  overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; flex: 1; }
.lib-date { font-size: 11px; color: #202020; }
.lib-rm { min-height: 28px; border-radius: 7px; border: none;
  background: rgba(255,0,80,.07); color: #ff4060; font-size: 11px; font-weight: 600;
  cursor: pointer; font-family: 'DM Sans', sans-serif; transition: background .2s; }
.lib-rm:hover { background: rgba(255,0,80,.13); }
.lib-empty { text-align: center; padding: 55px 20px; }
.lib-empty-icon { font-size: 40px; margin-bottom: 12px; }
.lib-empty-text { font-size: 13px; color: #1c1c1c; line-height: 1.7; }

@media (max-width: 540px) {
  .vid-grid, .skel-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .search-row { flex-direction: column; }
  .url-inp { flex: 1 1 100%; }
  .btn { width: 100%; }
  .search-card { padding: 15px; }
  .sel-right { width: 100%; }
  .sel-right .btn { flex: 1; }
}
`

/* ════════════════════════════════════════════════════════ */
export default function App() {
  /* ── tab & mode ─────────────────────────────────────── */
  const [tab,  setTab]  = useState<'search' | 'library'>('search')
  const [mode, setMode] = useState<Mode>('device')

  /* ── search state ───────────────────────────────────── */
  const [urlInput, setUrlInput] = useState('')
  const [videos,   setVideos]   = useState<Video[]>([])
  const [cursor,   setCursor]   = useState<string | null>(null)
  const [hasMore,  setHasMore]  = useState(false)
  const [curUser,  setCurUser]  = useState('')
  const [skipped,  setSkipped]  = useState(0)
  const [loading,  setLoading]  = useState(false)
  const [moreLoad, setMoreLoad] = useState(false)
  const [status,   setStatus]   = useState('')
  const [error,    setError]    = useState('')
  const [dlId,     setDlId]     = useState<string | null>(null)
  const [sort,     setSort]     = useState<Sort>('default')

  /* ── bulk state ─────────────────────────────────────── */
  const [busy,    setBusy]    = useState(false)
  const [bDone,   setBDone]   = useState(0)
  const [bTotal,  setBTotal]  = useState(0)
  const [bLabel,  setBLabel]  = useState('')

  /* ── SELECTION ──────────────────────────────────────── */
  // نستخدم ref للقائمة + counter للـ re-render
  const selRef = useRef<string[]>([])
  const [selTick, setSelTick] = useState(0) // trigger re-render only

  function getSel()         { return selRef.current }
  function refreshSel()     { setSelTick(t => t + 1) }

  function toggleSel(id: string) {
    const cur = selRef.current
    selRef.current = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]
    refreshSel()
  }
  function selectAll(vids: Video[]) {
    selRef.current = vids.map(v => String(v.id))
    refreshSel()
  }
  function clearSel() {
    selRef.current = []
    refreshSel()
  }

  /* ── LIBRARY ────────────────────────────────────────── */
  // نستخدم ref للقائمة + counter للـ re-render + نكتب مباشرة في localStorage
  const libRef = useRef<LibItem[]>(lsRead())
  const [libTick, setLibTick] = useState(0)

  function getLib()         { return libRef.current }
  function refreshLib()     { setLibTick(t => t + 1) }

  function libSaveAll(items: LibItem[]) {
    libRef.current = items
    lsWrite(items)
    refreshLib()
  }

  function addToLib(vs: Video[]) {
    const existing = new Set(libRef.current.map(x => x.id))
    const now = Date.now()
    const fresh: LibItem[] = []
    for (const v of vs) {
      const id = String(v.id)
      if (!existing.has(id)) {
        existing.add(id)
        fresh.push({ id, cover: v.cover || v.origin_cover, title: v.title || 'بدون عنوان', savedAt: now })
      }
    }
    if (!fresh.length) return
    libSaveAll([...fresh, ...libRef.current])
  }

  function removeFromLib(id: string) {
    libSaveAll(libRef.current.filter(x => x.id !== id))
  }

  function isInLib(id: string) {
    return libRef.current.some(x => x.id === id)
  }

  /* ── fetch videos ───────────────────────────────────── */
  const fetchPage = async (username: string, cur?: string) => {
    const qs = new URLSearchParams({ endpoint: 'user/posts', unique_id: username, count: '35', ...(cur ? { cursor: cur } : {}) })
    const r = await fetch(`${API}?${qs}`)
    const d = await r.json()
    if (!d || d.code !== 0) throw new Error(d?.msg || 'تعذّر جلب البروفايل. تحقق من اسم المستخدم.')
    const all: Video[] = d.data?.videos || []
    const filtered = all.filter(v => !v.duration || v.duration <= MAX_DUR)
    return {
      filtered,
      skippedN: all.length - filtered.length,
      nextCursor: d.data?.cursor || null,
      hasMore: !!d.data?.hasMore,
    }
  }

  const searchProfile = useCallback(async (username: string) => {
    setLoading(true); setError(''); setVideos([]); setSkipped(0)
    clearSel(); setCursor(null); setHasMore(false); setCurUser(username)
    setStatus(`جاري جلب فيديوهات @${username}...`)
    try {
      const pg = await fetchPage(username)
      if (!pg.filtered.length) throw new Error('لا توجد فيديوهات في هذا الحساب.')
      setVideos(pg.filtered)
      setSkipped(pg.skippedN)
      setCursor(pg.nextCursor)
      setHasMore(pg.hasMore)
      setStatus(`تم جلب ${pg.filtered.length} فيديو من @${username}${pg.hasMore ? ' · اضغط «تحميل المزيد»' : ''}`)
    } catch (e: any) { setError(e.message); setStatus('') }
    finally { setLoading(false) }
  }, []) // eslint-disable-line

  const loadMoreVideos = async () => {
    if (!curUser || !cursor || moreLoad) return
    setMoreLoad(true)
    try {
      const pg = await fetchPage(curUser, cursor)
      setVideos(prev => {
        const ids = new Set(prev.map(v => String(v.id)))
        return [...prev, ...pg.filtered.filter(v => !ids.has(String(v.id)))]
      })
      setSkipped(s => s + pg.skippedN)
      setCursor(pg.nextCursor)
      setHasMore(pg.hasMore)
    } catch (e: any) { setError(e.message) }
    finally { setMoreLoad(false) }
  }

  const searchSingleVideo = useCallback(async (vUrl: string) => {
    setLoading(true); setError(''); setStatus('جاري جلب الفيديو...')
    try {
      const qs = new URLSearchParams({ endpoint: '', url: vUrl })
      const r = await fetch(`${API}?${qs}`)
      const d = await r.json()
      if (!d || d.code !== 0) throw new Error(d?.msg || 'تعذّر جلب الفيديو.')
      if (d.data?.duration > MAX_DUR) throw new Error('هذا الفيديو أطول من 5 دقائق.')
      setVideos([d.data]); setHasMore(false); setStatus('تم جلب الفيديو بنجاح!')
    } catch (e: any) { setError(e.message); setStatus('') }
    finally { setLoading(false) }
  }, [])

  const handleSearch = () => {
    const v = urlInput.trim(); if (!v) return; setError('')
    if (isVideoLink(v)) searchSingleVideo(v)
    else {
      const u = parseHandle(v)
      if (!u) { setError('أدخل رابط بروفايل صحيح مثل: @username'); return }
      searchProfile(u)
    }
  }

  /* ── sort ───────────────────────────────────────────── */
  const sorted = [...videos].sort((a, b) => {
    if (sort === 'views')    return b.play_count - a.play_count
    if (sort === 'likes')    return b.digg_count - a.digg_count
    if (sort === 'shortest') return a.duration - b.duration
    if (sort === 'longest')  return b.duration - a.duration
    return 0
  })

  /* ── download single video to device ───────────────── */
  const downloadToDevice = async (v: Video): Promise<boolean> => {
    const dlUrl = v.play || v.wmplay; if (!dlUrl) return false
    try {
      const res = await fetch(`${DL_API}?url=${encodeURIComponent(dlUrl)}`)
      if (!res.ok) return false
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `tiktok_${v.id}.mp4`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(a.href)
      return true
    } catch { return false }
  }

  /* ── download one (from card button) ───────────────── */
  const dlOne = async (v: Video) => {
    const id = String(v.id)
    setDlId(id); setError('')
    if (mode === 'library') {
      addToLib([v])
      setDlId(null)
      return
    }
    const ok = await downloadToDevice(v)
    if (ok) addToLib([v]); else setError('فشل تحميل الفيديو، جرّب مرة أخرى.')
    setDlId(null)
  }

  /* ── bulk action (receives sel + mode as params) ────── */
  const bulkAction = async (currentSel: string[], currentMode: Mode) => {
    if (!currentSel.length) return
    const vMap = new Map(videos.map(v => [String(v.id), v]))
    const toProcess = currentSel.map(id => vMap.get(id)).filter(Boolean) as Video[]
    if (!toProcess.length) return

    setBusy(true); setBDone(0); setBTotal(toProcess.length); setError('')

    if (currentMode === 'library') {
      // حفظ كل المحدد في المكتبة دفعة واحدة فوراً
      setBLabel('جاري الحفظ في المكتبة...')
      addToLib(toProcess)
      setBDone(toProcess.length)
      await new Promise(r => setTimeout(r, 350))
      setBusy(false); setBLabel('')
      setStatus(`✅ تم حفظ ${toProcess.length} فيديو في المكتبة!`)
      clearSel()
      return
    }

    // تحميل على الجهاز: واحد ورا واحد
    let failed = 0
    for (let i = 0; i < toProcess.length; i++) {
      setBLabel(`فيديو ${i + 1} من ${toProcess.length}`)
      const ok = await downloadToDevice(toProcess[i])
      if (ok) addToLib([toProcess[i]]); else failed++
      setBDone(i + 1)
      await new Promise(r => setTimeout(r, 650))
    }
    setBusy(false); setBLabel('')
    setStatus(`✅ تم تحميل ${toProcess.length - failed} فيديو!${failed > 0 ? ` (فشل ${failed})` : ''}`)
    clearSel()
  }

  /* ── derived values ─────────────────────────────────── */
  const bPct       = bTotal > 0 ? Math.round((bDone / bTotal) * 100) : 0
  const sel        = getSel()
  const lib        = getLib()
  const expiring   = lib.filter(x => daysSince(x.savedAt) >= 25).length
  const selLen     = sel.length

  const SORTS: { k: Sort; l: string }[] = [
    { k: 'default', l: 'الافتراضي' }, { k: 'views', l: '▶ مشاهدات' },
    { k: 'likes', l: '❤ لايكات' }, { k: 'shortest', l: '⏱ الأقصر' }, { k: 'longest', l: '⏱ الأطول' },
  ]

  /* ════════════════════════════════ RENDER ════════════ */
  return (
    <>
      <style>{CSS}</style>
      <div style={{ minHeight: '100vh', background: '#070707' }}>
        <div className="blob1" /><div className="blob2" />
        <div className="page">

          {/* LOGO */}
          <div className="logo-wrap">
            <div className="logo">TIKLOAD</div>
            <div className="logo-sub">تحميل فيديوهات تيك توك · بدون علامة مائية · تحت 5 دقائق</div>
          </div>

          {/* TABS */}
          <div className="tabs">
            <button className={`tab-btn${tab === 'search' ? ' on' : ''}`} onClick={() => setTab('search')}>
              🔍 البحث
            </button>
            <button className={`tab-btn${tab === 'library' ? ' on' : ''}`} onClick={() => setTab('library')}>
              {lib.length > 0 && <span className="tab-badge">{lib.length}</span>}
              📁 مكتبتي
            </button>
          </div>

          {/* ═══════════ SEARCH TAB ═══════════ */}
          {tab === 'search' && (
            <>
              {/* MODE */}
              <div className="mode-bar">
                <span className="mode-lbl">وضع التحميل:</span>
                <div className="mode-opts">
                  <button className={`mode-btn${mode === 'device' ? ' on' : ''}`} onClick={() => setMode('device')}>
                    💾 على الجهاز
                  </button>
                  <button className={`mode-btn${mode === 'library' ? ' on lib' : ''}`} onClick={() => setMode('library')}>
                    📁 في المكتبة
                  </button>
                </div>
                <div className="mode-desc">
                  {mode === 'device'
                    ? '⬇ يحمّل الفيديو على جهازك ويضيفه للمكتبة تلقائياً'
                    : '📁 يحفظ في المكتبة فقط — كل المحدد يُحفظ دفعة واحدة فوراً'}
                </div>
              </div>

              {/* SEARCH */}
              <div className="search-card">
                <label className="field-lbl">رابط البروفايل أو الفيديو</label>
                <div className="search-row">
                  <input
                    className="url-inp" dir="ltr"
                    placeholder="tiktok.com/@username  أو رابط فيديو مباشر"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  />
                  <button className="btn btn-fetch" onClick={handleSearch} disabled={loading || !urlInput.trim()}>
                    {loading ? 'جاري الجلب...' : 'جلب الفيديوهات'}
                  </button>
                </div>
                <div className="examples">
                  {['@mrbeast', '@khaby.lame', '@charlidamelio'].map(ex => (
                    <span key={ex} className="ex-chip" onClick={() => setUrlInput(ex)}>{ex}</span>
                  ))}
                </div>
              </div>

              {/* ALERTS */}
              {error   && <div className="alert alert-err">⚠ {error}</div>}
              {status && !error && <div className="alert alert-info"><div className="pulse" />{status}</div>}
              {skipped > 0 && <div className="alert alert-ok">ℹ تم تخطي {skipped} فيديو أطول من 5 دقائق</div>}

              {/* PROGRESS */}
              {busy && (
                <div className="prog-card">
                  <div className="prog-head">
                    <span className="prog-title">
                      {mode === 'library' ? '📁 جاري الحفظ...' : '⬇ جاري التحميل...'} {bLabel}
                    </span>
                    <span className="prog-pct">{bDone}/{bTotal}</span>
                  </div>
                  <div className="prog-track">
                    <div className={`prog-fill ${mode === 'library' ? 'lb' : 'dv'}`} style={{ width: `${bPct}%` }} />
                  </div>
                  <div className="prog-sub">{bPct}% مكتمل</div>
                </div>
              )}

              {/* SKELETONS */}
              {loading && (
                <div className="skel-grid">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div className="skel" key={i}>
                      <div className="skel-thumb" />
                      <div className="skel-line" />
                      <div className="skel-line short" />
                    </div>
                  ))}
                </div>
              )}

              {/* VIDEOS */}
              {!loading && videos.length > 0 && (
                <>
                  {/* filters */}
                  <div className="filter-row">
                    <span className="filter-lbl">ترتيب:</span>
                    {SORTS.map(s => (
                      <button key={s.k} className={`filter-btn${sort === s.k ? ' on' : ''}`} onClick={() => setSort(s.k)}>
                        {s.l}
                      </button>
                    ))}
                  </div>

                  {/* toolbar */}
                  <div className="toolbar">
                    <div className="toolbar-l">
                      <div>
                        <div className="vid-count">{videos.length}</div>
                        <div className="vid-lbl">فيديو</div>
                      </div>
                      <button className="btn btn-ghost btn-sm" onClick={() => selectAll(videos)} disabled={busy}>
                        تحديد الكل
                      </button>
                      {selLen > 0 && (
                        <button className="btn btn-ghost btn-sm" onClick={clearSel} disabled={busy}>
                          ✕ إلغاء
                        </button>
                      )}
                    </div>
                  </div>

                  {/* SELECTION BAR */}
                  {selLen > 0 && (
                    <div className="sel-bar">
                      <div className="sel-left">
                        <div>
                          <div className={`sel-count ${mode === 'library' ? 'lb' : 'dv'}`}>{selLen}</div>
                          <div className="sel-hint">فيديو محدد — اضغط الصورة لإضافة أو إزالة</div>
                        </div>
                      </div>
                      <div className="sel-right">
                        {mode === 'library' ? (
                          <button className="btn btn-lib btn-sm"
                            onClick={() => bulkAction([...sel], mode)} disabled={busy}>
                            {busy ? `📁 ${bPct}%` : `📁 حفظ ${selLen} في المكتبة`}
                          </button>
                        ) : (
                          <button className="btn btn-dl btn-sm"
                            onClick={() => bulkAction([...sel], mode)} disabled={busy}>
                            {busy ? `⬇ ${bPct}%` : `⬇ تحميل ${selLen} فيديو`}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* GRID */}
                  <div className="vid-grid">
                    {sorted.map(v => {
                      const id    = String(v.id)
                      const idx   = sel.indexOf(id)
                      const isSel = idx !== -1
                      const isDl  = dlId === id
                      const inLib = isInLib(id)
                      const selClass = isSel ? (mode === 'library' ? ' sel-lb' : ' sel-dv') : ''

                      return (
                        <div key={id} className={`vcard${selClass}`}>

                          {/* THUMBNAIL — click = select/deselect */}
                          <div className="vthumb" onClick={() => { if (!busy && !isDl) toggleSel(id) }}>
                            <img
                              src={v.cover || v.origin_cover} alt="" loading="lazy"
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                            />
                            {v.duration > 0 && <div className="dur-badge">{sec2str(v.duration)}</div>}
                            <div className="check-ring"><span className="check-tick">✓</span></div>
                            {isSel && <div className="sel-order">{idx + 1}</div>}
                          </div>

                          {/* INFO */}
                          <div className="vcard-body">
                            <div className="vcard-stats">
                              <span>❤ {n2s(v.digg_count)}</span>
                              <span>▶ {n2s(v.play_count)}</span>
                            </div>
                            <div className="vcard-title">{v.title || 'بدون عنوان'}</div>
                          </div>

                          {/* ACTIONS */}
                          <div className="vcard-foot">
                            {mode === 'library' ? (
                              inLib
                                ? <div className="saved-badge">✓ محفوظ في المكتبة</div>
                                : <button className="action-btn purple"
                                    onClick={() => dlOne(v)} disabled={isDl || busy}>
                                    {isDl ? '⏳...' : '📁 حفظ في المكتبة'}
                                  </button>
                            ) : (
                              <>
                                <button className="action-btn primary"
                                  onClick={() => dlOne(v)} disabled={isDl || busy}>
                                  {isDl ? '⏳ جاري...' : '⬇ تحميل'}
                                </button>
                                {inLib
                                  ? <div className="saved-badge">✓ في المكتبة</div>
                                  : <button className="action-btn purple"
                                      onClick={() => { addToLib([v]) }} disabled={busy}>
                                      📁 حفظ فقط
                                    </button>
                                }
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* LOAD MORE */}
                  {hasMore && (
                    <div className="load-more-wrap">
                      <button className="btn btn-more" onClick={loadMoreVideos} disabled={moreLoad}>
                        {moreLoad ? 'جاري التحميل...' : '⬇ تحميل المزيد'}
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* EMPTY */}
              {!loading && videos.length === 0 && !error && (
                <div className="empty">
                  <div className="empty-icon">🎬</div>
                  <div className="empty-title">ابدأ من هنا</div>
                  <div className="empty-sub">أدخل رابط بروفايل تيك توك أو فيديو مباشر</div>
                </div>
              )}
            </>
          )}

          {/* ═══════════ LIBRARY TAB ═══════════ */}
          {tab === 'library' && (
            <>
              {expiring > 0 && (
                <div className="alert alert-warn">
                  ⚠ {expiring} فيديو ستُحذف تلقائياً خلال أقل من 5 أيام
                </div>
              )}

              <div className="lib-head">
                <div className="lib-title">📁 مكتبتي ({lib.length})</div>
                {lib.length > 0 && (
                  <button className="btn btn-ghost btn-sm"
                    onClick={() => { if (confirm('مسح المكتبة كاملة؟')) libSaveAll([]) }}>
                    🗑 مسح الكل
                  </button>
                )}
              </div>

              {lib.length > 0 && (
                <div className="lib-stats">
                  <div className="lib-stat">
                    <div className="lib-stat-n">{lib.length}</div>
                    <div className="lib-stat-l">محفوظ</div>
                  </div>
                  <div className="lib-stat">
                    <div className="lib-stat-n">{lib.filter(x => daysSince(x.savedAt) < 7).length}</div>
                    <div className="lib-stat-l">هذا الأسبوع</div>
                  </div>
                  <div className="lib-stat">
                    <div className="lib-stat-n">{expiring}</div>
                    <div className="lib-stat-l">تنتهي قريباً</div>
                  </div>
                </div>
              )}

              {lib.length === 0 ? (
                <div className="lib-empty">
                  <div className="lib-empty-icon">📭</div>
                  <div className="lib-empty-text">
                    لم تحفظ أي فيديو بعد.<br />
                    استخدم «حفظ في المكتبة» وستظهر هنا.
                  </div>
                </div>
              ) : (
                <div className="vid-grid">
                  {lib.map(item => {
                    const d = daysSince(item.savedAt)
                    return (
                      <div key={item.id} className="lib-card">
                        <div className="lib-thumb">
                          <img src={item.cover} alt="" loading="lazy"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                          <div className={`lib-age ${d >= 25 ? 'old' : 'ok'}`}>
                            {d === 0 ? 'اليوم' : `${d} يوم`}
                          </div>
                        </div>
                        <div className="lib-body">
                          <div className="lib-desc">{item.title}</div>
                          <div className="lib-date">📅 منذ {d} يوم</div>
                          <button className="lib-rm" onClick={() => removeFromLib(item.id)}>✕ إزالة</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </>
  )
}
