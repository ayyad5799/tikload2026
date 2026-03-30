import { useState, useCallback, useRef } from 'react'

/* ─── constants ──────────────────────────────────────── */
const MAX_DUR  = 5 * 60
const LIB_KEY  = 'tikload_v6'
const MONTH_MS = 30 * 24 * 60 * 60 * 1000

/* ─── types ──────────────────────────────────────────── */
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
  comment_count: number
}
type LibItem = { id: string; cover: string; title: string; savedAt: number }
type Sort = 'default' | 'views' | 'likes' | 'shortest' | 'longest'
type Mode = 'device' | 'library'
type Tab  = 'search' | 'library' | 'settings'

/* ─── localStorage ───────────────────────────────────── */
function lsRead(): LibItem[] {
  try {
    return (JSON.parse(localStorage.getItem(LIB_KEY) || '[]') as LibItem[])
      .filter(x => Date.now() - x.savedAt < MONTH_MS)
  } catch { return [] }
}
function lsWrite(items: LibItem[]) {
  try { localStorage.setItem(LIB_KEY, JSON.stringify(items)) } catch {}
}

/* ─── helpers ────────────────────────────────────────── */
const n2s = (n: number) =>
  !n ? '0' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n)

const sec2str = (s: number) =>
  `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

const daysAgo = (ts: number) => Math.floor((Date.now() - ts) / 86400000)

function parseHandle(v: string): string | null {
  v = v.trim()
  const m = v.match(/tiktok\.com\/@([^/?&\s]+)/)
  if (m) return m[1]
  if (v.startsWith('@')) return v.slice(1)
  if (!v.includes('/') && !v.includes('.') && v.length > 0) return v
  return null
}

const isVideoLink = (v: string) =>
  v.includes('tiktok.com') && v.includes('/video/')

/* ─── API helpers ────────────────────────────────────── */
async function apiProfile(username: string, cursor = '0') {
  const qs = new URLSearchParams({ action: 'profile', username, cursor })
  const r = await fetch(`/api/videos?${qs}`)
  if (!r.ok) throw new Error(`Server error ${r.status}`)
  const json = await r.json()
  if (!json.ok) throw new Error(json.error || 'Failed to fetch profile')
  return json.data
}

async function apiVideo(url: string) {
  const qs = new URLSearchParams({ action: 'video', video_url: url })
  const r = await fetch(`/api/videos?${qs}`)
  if (!r.ok) throw new Error(`Server error ${r.status}`)
  const json = await r.json()
  if (!json.ok) throw new Error(json.error || 'Failed to fetch video')
  return json.data
}

async function downloadVideoBlob(dlUrl: string): Promise<Blob> {
  const r = await fetch(`/api/download?url=${encodeURIComponent(dlUrl)}`)
  if (!r.ok) throw new Error(`Download failed: ${r.status}`)
  return r.blob()
}

function uploadToDropboxBg(video: Video, onDone?: (id: string) => void) {
  const dlUrl = video.play || video.wmplay
  if (!dlUrl) return
  fetch('/api/dropbox', {
    method: 'POST',
    headers: {
      'X-Video-Url': encodeURIComponent(dlUrl),
      'X-File-Name': `tiktok_${video.id}.mp4`,
    },
  })
    .then(r => r.json())
    .then(d => { if (d.success && onDone) onDone(String(video.id)) })
    .catch(() => {})
}

/* ══════════════════════════════════════════════════════ */
/*  STYLES                                                */
/* ══════════════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }

body {
  background: #050810;
  color: #d8e0f0;
  font-family: 'DM Sans', sans-serif;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

/* ── layout ────────────────────────────────────────── */
.app  { min-height: 100vh; position: relative }
.blob { position: fixed; border-radius: 50%; pointer-events: none; z-index: 0 }
.b1   { width: 700px; height: 700px; background: radial-gradient(circle, rgba(0,200,255,.048), transparent 65%); top: -260px; left: -260px }
.b2   { width: 550px; height: 550px; background: radial-gradient(circle, rgba(130,0,255,.035), transparent 65%); bottom: -180px; right: -180px }
.page { max-width: 1200px; margin: 0 auto; padding: 48px 20px 100px; position: relative; z-index: 1 }

/* ── header ─────────────────────────────────────────── */
.hdr  { text-align: center; margin-bottom: 44px }
.logo {
  font-family: 'Bebas Neue', cursive;
  font-size: clamp(56px, 9vw, 94px);
  letter-spacing: 7px; line-height: 1;
  background: linear-gradient(135deg, #fff 0%, #00e5ff 42%, #7b2fff 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}
.logo-sub { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #1e2840; margin-top: 9px }
.dbx-pill {
  display: inline-flex; align-items: center; gap: 7px;
  margin-top: 13px; padding: 6px 16px;
  background: rgba(0,200,255,.07); border: 1px solid rgba(0,200,255,.18);
  border-radius: 99px; font-size: 12px; color: #00b8d9;
}
.dbx-dot { width: 7px; height: 7px; border-radius: 50%; background: #00e5ff; animation: pu 2s infinite }

/* ── tabs ────────────────────────────────────────────── */
.tabs { display: flex; gap: 3px; margin-bottom: 24px; background: #0a0e1c; border: 1px solid #111828; border-radius: 13px; padding: 4px; width: fit-content }
.tab  { padding: 8px 20px; border-radius: 9px; border: none; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all .2s; background: transparent; color: #283050; display: flex; align-items: center; gap: 6px }
.tab.on { background: #0f1428; color: #d8e0f0 }
.tbadge { min-width: 17px; height: 17px; border-radius: 99px; background: #00e5ff; color: #000; font-size: 10px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; padding: 0 4px }

/* ── mode bar ────────────────────────────────────────── */
.mbar { display: flex; align-items: center; gap: 10px; background: #0a0e1c; border: 1px solid #111828; border-radius: 12px; padding: 12px 16px; margin-bottom: 14px; flex-wrap: wrap }
.mlab { font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #1a2035 }
.mopts { display: flex; gap: 5px }
.mopt { padding: 6px 14px; border-radius: 8px; border: 1px solid #111828; background: transparent; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; color: #283050; cursor: pointer; transition: all .2s }
.mopt:hover { border-color: #1e2840; color: #4a5e7e }
.mopt.on.dev { background: rgba(255,60,100,.07); border-color: #ff3c64; color: #ff3c64 }
.mopt.on.lib { background: rgba(130,0,255,.07); border-color: #8200ff; color: #a855f7 }
.mbar-info { font-size: 12px; color: #182030; width: 100%; margin-top: 3px; display: flex; align-items: center; gap: 6px }

/* ── search card ─────────────────────────────────────── */
.sc { background: #0a0e1c; border: 1px solid #111828; border-radius: 16px; padding: 22px 26px; margin-bottom: 14px; transition: border-color .25s }
.sc:focus-within { border-color: #00e5ff }
.fl { display: block; font-size: 10px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; color: #1a2035; margin-bottom: 10px }
.srow { display: flex; gap: 10px; align-items: stretch; flex-wrap: wrap }
.inp { flex: 1 1 240px; background: #050810; border: 1px solid #111828; border-radius: 10px; padding: 11px 15px; color: #d8e0f0; font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color .2s; min-height: 44px }
.inp:focus { border-color: #00e5ff }
.inp::placeholder { color: #111828 }
.chips { display: flex; gap: 7px; flex-wrap: wrap; margin-top: 10px }
.chip { font-size: 12px; padding: 4px 12px; background: #070b18; border: 1px solid #0f1828; border-radius: 99px; color: #1a2840; cursor: pointer; transition: all .2s }
.chip:hover { border-color: #1e2840; color: #4a5e7e }

/* ── buttons ─────────────────────────────────────────── */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 20px; min-height: 44px; border: none; border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all .2s; white-space: nowrap }
.btn:disabled { opacity: .22; cursor: not-allowed !important; transform: none !important; box-shadow: none !important }
.bfetch { background: linear-gradient(135deg, #00e5ff, #7b2fff); color: #fff }
.bfetch:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 6px 22px rgba(0,200,255,.3) }
.bdl  { background: linear-gradient(135deg, #ff3c64, #ff7000); color: #fff }
.bdl:not(:disabled):hover { transform: translateY(-1px) }
.blib { background: linear-gradient(135deg, #8200ff, #5500cc); color: #fff }
.blib:not(:disabled):hover { transform: translateY(-1px) }
.bmore { background: #0a0e1c; color: #283050; border: 1px solid #111828 }
.bmore:not(:disabled):hover { border-color: #1e2840; color: #5a6e8e }
.bghost { background: transparent; color: #283050; border: 1px solid #111828 }
.bghost:not(:disabled):hover { border-color: #1e2840; color: #5a6e8e }
.bsm { padding: 0 13px; min-height: 32px; font-size: 12px; border-radius: 8px }
.bdanger { background: rgba(255,60,100,.1); color: #ff3c64; border: 1px solid rgba(255,60,100,.2) }
.bdanger:not(:disabled):hover { background: rgba(255,60,100,.18) }

/* ── alerts ──────────────────────────────────────────── */
.al { display: flex; align-items: flex-start; gap: 9px; padding: 11px 15px; border-radius: 10px; font-size: 13px; margin-bottom: 12px; line-height: 1.5 }
.ae { background: rgba(255,60,100,.06); border: 1px solid rgba(255,60,100,.15); color: #ff6070 }
.ao { background: rgba(0,229,255,.04); border: 1px solid rgba(0,229,255,.12); color: #00b8d9 }
.as { background: #0a0e1c; border: 1px solid #111828; color: #283050 }
.aw { background: rgba(255,165,0,.04); border: 1px solid rgba(255,165,0,.12); color: #b08000 }
.dot { width: 7px; height: 7px; border-radius: 50%; background: #00e5ff; flex-shrink: 0; margin-top: 3px; animation: pu 1.6s infinite }
@keyframes pu { 0%,100% { opacity: 1 } 50% { opacity: .2 } }

/* ── progress ────────────────────────────────────────── */
.prc { background: #0a0e1c; border: 1px solid #111828; border-radius: 12px; padding: 16px 20px; margin-bottom: 14px }
.prh { display: flex; justify-content: space-between; margin-bottom: 9px }
.prt { font-size: 13px; font-weight: 600; color: #7088aa }
.prn { font-size: 13px; color: #283050 }
.ptr { height: 4px; background: #0f1428; border-radius: 99px; overflow: hidden; margin-bottom: 5px }
.pf  { height: 100%; border-radius: 99px; transition: width .35s }
.pf.dev { background: linear-gradient(90deg, #ff3c64, #ff7000) }
.pf.lib { background: linear-gradient(90deg, #8200ff, #5500cc) }
.ps  { font-size: 11px; color: #182030 }

/* ── filter row + toolbar ────────────────────────────── */
.frow { display: flex; gap: 7px; flex-wrap: wrap; align-items: center; margin-bottom: 14px }
.flab { font-size: 10px; color: #1a2035; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase }
.fb   { padding: 5px 12px; border-radius: 99px; border: 1px solid #0f1828; background: transparent; color: #222e42; font-family: 'DM Sans', sans-serif; font-size: 12px; cursor: pointer; transition: all .2s }
.fb:hover { border-color: #1e2840; color: #4a5e7e }
.fb.on { background: #0f1428; border-color: #00e5ff; color: #00b8d9 }

.tbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 12px }
.tbl  { display: flex; align-items: center; gap: 11px; flex-wrap: wrap }
.vcnt { font-family: 'Bebas Neue', cursive; font-size: 28px; letter-spacing: 1px; color: #00e5ff; line-height: 1 }
.vlab { font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #131c2e }

/* ── selection bar ───────────────────────────────────── */
.selbar { background: #0a0e1c; border: 1px solid #111828; border-radius: 12px; padding: 12px 16px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px }
.selL { display: flex; align-items: center; gap: 10px }
.seln { font-family: 'Bebas Neue', cursive; font-size: 24px; letter-spacing: 1px }
.seln.dev { color: #ff3c64 }
.seln.lib { color: #a855f7 }
.selh { font-size: 12px; color: #1a2035 }
.selR { display: flex; gap: 7px; flex-wrap: wrap }

/* ── grid ────────────────────────────────────────────── */
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(184px, 1fr)); gap: 12px }

/* ── card ────────────────────────────────────────────── */
.card { background: #080c1a; border: 2px solid transparent; border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; user-select: none; transition: border-color .15s, transform .15s, box-shadow .15s }
.card:hover { transform: translateY(-2px); border-color: #111828 }
.card.sdv { border-color: #ff3c64 !important; box-shadow: 0 0 16px rgba(255,60,100,.14) }
.card.slib { border-color: #8200ff !important; box-shadow: 0 0 16px rgba(130,0,255,.14) }

/* thumbnail = click to select */
.cth { position: relative; aspect-ratio: 9/16; overflow: hidden; background: #0b0f1e; flex-shrink: 0; cursor: pointer }
.cth img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .3s }
.card:hover .cth img { transform: scale(1.04) }

/* duration badge */
.dur { position: absolute; bottom: 7px; left: 7px; background: rgba(0,0,0,.75); backdrop-filter: blur(5px); color: #fff; font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 6px; pointer-events: none }

/* check ring */
.ck { position: absolute; top: 8px; right: 8px; width: 24px; height: 24px; border-radius: 50%; background: rgba(0,0,0,.6); border: 2px solid #1e2840; display: flex; align-items: center; justify-content: center; transition: all .15s; pointer-events: none }
.card.sdv  .ck { background: #ff3c64; border-color: #ff3c64 }
.card.slib .ck { background: #8200ff; border-color: #8200ff }
.ct { font-size: 12px; font-weight: 800; color: #fff; opacity: 0; transition: opacity .15s }
.card.sdv  .ct,
.card.slib .ct { opacity: 1 }

/* selection order number */
.sord { position: absolute; top: 8px; left: 8px; min-width: 20px; height: 20px; border-radius: 99px; font-size: 10px; font-weight: 800; display: flex; align-items: center; justify-content: center; padding: 0 4px; pointer-events: none }
.card.sdv  .sord { background: #ff3c64; color: #fff }
.card.slib .sord { background: #8200ff; color: #fff }

/* dropbox status overlay */
.dbx-overlay { position: absolute; bottom: 7px; right: 7px; font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 5px; pointer-events: none }
.dbx-overlay.uploading { background: rgba(0,200,255,.2); color: #00e5ff; display: flex; align-items: center; gap: 4px }
.dbx-overlay.done { background: rgba(0,200,100,.2); color: #00c864 }
.dbx-spin { width: 8px; height: 8px; border-radius: 50%; border: 2px solid #00e5ff44; border-top-color: #00e5ff; animation: spin .7s linear infinite }
@keyframes spin { to { transform: rotate(360deg) } }

.cbody { padding: 9px 11px 4px; flex: 1 }
.cst   { display: flex; gap: 9px; font-size: 11px; color: #1a2035; margin-bottom: 4px }
.cdesc { font-size: 12px; color: #222e42; line-height: 1.4; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical }
.cfoot { padding: 6px 10px 10px; display: flex; flex-direction: column; gap: 5px }

.abtn { width: 100%; min-height: 32px; border-radius: 8px; font-size: 12px; font-weight: 600; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all .2s }
.abtn:disabled { opacity: .22; cursor: not-allowed }
.abtn.dev  { background: linear-gradient(135deg, #ff3c64, #ff7000); color: #fff }
.abtn.dev:not(:disabled):hover { transform: translateY(-1px) }
.abtn.lib  { background: rgba(130,0,255,.1); color: #a855f7; border: 1px solid rgba(130,0,255,.2) }
.abtn.lib:not(:disabled):hover { background: rgba(130,0,255,.18) }
.saved { width: 100%; min-height: 27px; border-radius: 7px; font-size: 11px; font-weight: 600; border: 1px solid rgba(0,229,255,.14); background: rgba(0,229,255,.05); color: #00b8d9; display: flex; align-items: center; justify-content: center; gap: 4px }

.lmw { display: flex; justify-content: center; margin-top: 26px }

/* ── skeletons ───────────────────────────────────────── */
.sg  { display: grid; grid-template-columns: repeat(auto-fill, minmax(184px, 1fr)); gap: 12px }
.sk  { background: #080c1a; border-radius: 14px; overflow: hidden }
.skt { aspect-ratio: 9/16; background: linear-gradient(90deg, #080c1a 25%, #0e1228 50%, #080c1a 75%); background-size: 200% 100%; animation: shim 1.4s infinite }
.skl { height: 9px; margin: 9px 11px 0; border-radius: 4px; background: linear-gradient(90deg, #080c1a 25%, #0e1228 50%, #080c1a 75%); background-size: 200% 100%; animation: shim 1.4s infinite }
.skl.s { width: 55%; margin-bottom: 10px }
@keyframes shim { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }

/* ── empty ───────────────────────────────────────────── */
.emp  { text-align: center; padding: 80px 20px }
.eico { font-size: 52px; margin-bottom: 16px }
.etit { font-family: 'Bebas Neue', cursive; font-size: 34px; letter-spacing: 2px; color: #101828; margin-bottom: 6px }
.esub { font-size: 13px; color: #131c2e }

/* ── library ─────────────────────────────────────────── */
.lhdr  { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 10px }
.ltit  { font-family: 'Bebas Neue', cursive; font-size: 26px; letter-spacing: 2px; color: #222e42 }
.lstats { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px }
.lstat { background: #080c1a; border: 1px solid #0f1428; border-radius: 10px; padding: 11px 16px }
.lsn   { font-family: 'Bebas Neue', cursive; font-size: 22px; color: #00e5ff }
.lsl   { font-size: 11px; color: #1a2035 }
.li    { background: #080c1a; border: 1px solid #0f1428; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; transition: border-color .2s }
.li:hover { border-color: rgba(0,229,255,.14) }
.lth   { position: relative; aspect-ratio: 9/16; overflow: hidden; background: #0b0f1e }
.lth img { width: 100%; height: 100%; object-fit: cover; display: block }
.la    { position: absolute; top: 7px; left: 7px; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 5px }
.la.old { background: rgba(255,60,100,.7); color: #fff }
.la.ok  { background: rgba(0,229,255,.15); color: #00e5ff }
.lbd   { padding: 9px 11px 11px; flex: 1; display: flex; flex-direction: column; gap: 5px }
.ldesc { font-size: 12px; color: #222e42; line-height: 1.4; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; flex: 1 }
.ldate { font-size: 11px; color: #131c2e }
.lrm   { min-height: 28px; border-radius: 7px; border: none; background: rgba(255,60,100,.07); color: #ff3c64; font-size: 11px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: background .2s }
.lrm:hover { background: rgba(255,60,100,.14) }
.lemp  { text-align: center; padding: 55px 20px }
.leico { font-size: 42px; margin-bottom: 14px }
.letxt { font-size: 13px; color: #101828; line-height: 1.7 }

/* ── settings tab ────────────────────────────────────── */
.settings-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px }
.scard { background: #080c1a; border: 1px solid #0f1428; border-radius: 14px; padding: 20px }
.scard-title { font-size: 13px; font-weight: 700; color: #4a5e7e; margin-bottom: 14px; display: flex; align-items: center; gap: 8px }
.scard-row { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px }
.scard-row:last-child { margin-bottom: 0 }
.scard-lbl { font-size: 11px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: #1a2035 }
.sinp { width: 100%; background: #050810; border: 1px solid #111828; border-radius: 9px; padding: 10px 14px; color: #d8e0f0; font-family: 'DM Sans', sans-serif; font-size: 13px; outline: none; transition: border-color .2s }
.sinp:focus { border-color: #00e5ff }
.sinp::placeholder { color: #111828 }
.sstatus { font-size: 12px; margin-top: 4px; min-height: 18px }
.sstatus.ok  { color: #00b8d9 }
.sstatus.err { color: #ff6070 }
.sstatus.saving { color: #888 }
.sinfo { font-size: 12px; color: #182030; line-height: 1.6; margin-top: 6px }
.sinfo a { color: #00b8d9; text-decoration: none }

/* ── responsive ──────────────────────────────────────── */
@media (max-width: 540px) {
  .grid, .sg { grid-template-columns: repeat(2, 1fr); gap: 8px }
  .srow { flex-direction: column }
  .inp { flex: 1 1 100% }
  .btn { width: 100% }
  .sc { padding: 15px }
  .selR { width: 100% }
  .selR .btn { flex: 1 }
  .settings-grid { grid-template-columns: 1fr }
}
`

/* ══════════════════════════════════════════════════════ */
/*  COMPONENT                                             */
/* ══════════════════════════════════════════════════════ */
export default function App() {
  /* ── state ──────────────────────────────────────────── */
  const [tab,  setTab]  = useState<Tab>('search')
  const [mode, setMode] = useState<Mode>('device')

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

  const [busy,   setBusy]   = useState(false)
  const [bDone,  setBDone]  = useState(0)
  const [bTotal, setBTotal] = useState(0)
  const [bLabel, setBLabel] = useState('')

  const [dbxUp,   setDbxUp]   = useState<Set<string>>(new Set())
  const [dbxDone, setDbxDone] = useState<Set<string>>(new Set())

  // settings
  const [rapidKey,    setRapidKey]    = useState(() => localStorage.getItem('tl_rapid_key') || '')
  const [dropboxTok,  setDropboxTok]  = useState(() => localStorage.getItem('tl_dbx_token') || '')
  const [settingsSts, setSettingsSts] = useState('')
  const [filterDur,   setFilterDur]   = useState<number>(() => Number(localStorage.getItem('tl_max_dur') || MAX_DUR))

  /* ── selection via ref ───────────────────────────────── */
  const selRef = useRef<string[]>([])
  const [, rSel] = useState(0)
  const getSel    = () => selRef.current
  const toggleSel = (id: string) => { const c = selRef.current; selRef.current = c.includes(id) ? c.filter(x => x !== id) : [...c, id]; rSel(n => n + 1) }
  const selAll    = (vids: Video[]) => { selRef.current = vids.map(v => String(v.id)); rSel(n => n + 1) }
  const clrSel    = () => { selRef.current = []; rSel(n => n + 1) }

  /* ── library via ref ─────────────────────────────────── */
  const libRef = useRef<LibItem[]>(lsRead())
  const [, rLib] = useState(0)
  const getLib      = () => libRef.current
  const saveLib     = (items: LibItem[]) => { libRef.current = items; lsWrite(items); rLib(n => n + 1) }
  const addToLib    = (vs: Video[]) => {
    const ex = new Set(libRef.current.map(x => x.id)); const now = Date.now(); const fr: LibItem[] = []
    for (const v of vs) { const id = String(v.id); if (!ex.has(id)) { ex.add(id); fr.push({ id, cover: v.cover || v.origin_cover, title: v.title || 'بدون عنوان', savedAt: now }) } }
    if (fr.length) saveLib([...fr, ...libRef.current])
  }
  const rmFromLib   = (id: string) => saveLib(libRef.current.filter(x => x.id !== id))
  const isInLib     = (id: string) => libRef.current.some(x => x.id === id)

  /* ── fetch helpers ───────────────────────────────────── */
  const doFetchProfile = async (username: string, cur = '0') => {
    const raw = await apiProfile(username, cur)
    const vids = (raw?.data?.videos || raw?.videos || []) as Video[]
    const nextCursor = raw?.data?.cursor || raw?.cursor || null
    const more = !!(raw?.data?.hasMore ?? raw?.hasMore)
    const all  = vids
    const filtered = all.filter(v => !v.duration || v.duration <= filterDur)
    return { filtered, skipped: all.length - filtered.length, nextCursor, more }
  }

  const searchProfile = useCallback(async (username: string) => {
    setLoading(true); setError(''); setVideos([]); setSkipped(0)
    clrSel(); setCursor(null); setHasMore(false); setCurUser(username)
    setStatus(`جاري جلب فيديوهات @${username}...`)
    try {
      const pg = await doFetchProfile(username)
      if (!pg.filtered.length) throw new Error('لا توجد فيديوهات مطابقة في هذا الحساب.')
      setVideos(pg.filtered); setSkipped(pg.skipped)
      setCursor(pg.nextCursor); setHasMore(pg.more)
      setStatus(`تم جلب ${pg.filtered.length} فيديو من @${username}${pg.more ? ' · اضغط «تحميل المزيد»' : ''}`)
    } catch (e: any) { setError(e.message); setStatus('') }
    finally { setLoading(false) }
  }, [filterDur])

  const loadMore = async () => {
    if (!curUser || !cursor || moreLoad) return
    setMoreLoad(true)
    try {
      const pg = await doFetchProfile(curUser, cursor)
      setVideos(prev => { const ids = new Set(prev.map(v => String(v.id))); return [...prev, ...pg.filtered.filter(v => !ids.has(String(v.id)))] })
      setSkipped(s => s + pg.skipped); setCursor(pg.nextCursor); setHasMore(pg.more)
    } catch (e: any) { setError(e.message) }
    finally { setMoreLoad(false) }
  }

  const searchVideo = useCallback(async (vUrl: string) => {
    setLoading(true); setError(''); setStatus('جاري جلب الفيديو...')
    try {
      const raw = await apiVideo(vUrl)
      const v: Video = raw?.data || raw
      if (!v?.id) throw new Error('تعذّر جلب الفيديو.')
      if (v.duration > filterDur) throw new Error(`هذا الفيديو أطول من ${Math.floor(filterDur / 60)} دقائق.`)
      setVideos([v]); setHasMore(false); setStatus('تم جلب الفيديو بنجاح!')
    } catch (e: any) { setError(e.message); setStatus('') }
    finally { setLoading(false) }
  }, [filterDur])

  const handleSearch = () => {
    const v = urlInput.trim(); if (!v) return; setError('')
    if (isVideoLink(v)) searchVideo(v)
    else { const u = parseHandle(v); if (!u) { setError('أدخل رابط بروفايل صحيح: @username'); return } searchProfile(u) }
  }

  /* ── sort ────────────────────────────────────────────── */
  const sorted = [...videos].sort((a, b) => {
    if (sort === 'views')    return b.play_count - a.play_count
    if (sort === 'likes')    return b.digg_count - a.digg_count
    if (sort === 'shortest') return a.duration - b.duration
    if (sort === 'longest')  return b.duration - a.duration
    return 0
  })

  /* ── dropbox ─────────────────────────────────────────── */
  const triggerDropbox = (video: Video) => {
    const id = String(video.id)
    setDbxUp(p => new Set(p).add(id))
    uploadToDropboxBg(video, (doneId) => {
      setDbxUp(p => { const s = new Set(p); s.delete(doneId); return s })
      setDbxDone(p => new Set(p).add(doneId))
    })
  }

  /* ── download one ────────────────────────────────────── */
  const dlOne = async (v: Video) => {
    const id = String(v.id); setDlId(id); setError('')
    if (mode === 'library') {
      addToLib([v]); triggerDropbox(v); setDlId(null); return
    }
    try {
      const blob = await downloadVideoBlob(v.play || v.wmplay)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob); a.download = `tiktok_${id}.mp4`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href)
      addToLib([v]); triggerDropbox(v)
    } catch { setError('فشل التحميل، جرّب مرة أخرى.') }
    setDlId(null)
  }

  /* ── bulk ────────────────────────────────────────────── */
  const bulkAction = async (currentSel: string[], currentMode: Mode) => {
    if (!currentSel.length) return
    const vMap = new Map(videos.map(v => [String(v.id), v]))
    const toProcess = currentSel.map(id => vMap.get(id)).filter(Boolean) as Video[]
    if (!toProcess.length) return

    setBusy(true); setBDone(0); setBTotal(toProcess.length); setError('')

    if (currentMode === 'library') {
      setBLabel('جاري الحفظ في المكتبة...')
      addToLib(toProcess)
      toProcess.forEach(v => triggerDropbox(v))
      setBDone(toProcess.length)
      await new Promise(r => setTimeout(r, 350))
      setBusy(false); setBLabel('')
      setStatus(`✅ تم حفظ ${toProcess.length} فيديو + يُرفع على Dropbox!`)
      clrSel(); return
    }

    let failed = 0
    for (let i = 0; i < toProcess.length; i++) {
      setBLabel(`فيديو ${i + 1} من ${toProcess.length}`)
      const v = toProcess[i]
      try {
        const blob = await downloadVideoBlob(v.play || v.wmplay)
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob); a.download = `tiktok_${v.id}.mp4`
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href)
        addToLib([v]); triggerDropbox(v)
      } catch { failed++ }
      setBDone(i + 1)
      await new Promise(r => setTimeout(r, 700))
    }
    setBusy(false); setBLabel('')
    setStatus(`✅ تم تحميل ${toProcess.length - failed} فيديو!${failed > 0 ? ` (فشل ${failed})` : ''}`)
    clrSel()
  }

  /* ── settings save ───────────────────────────────────── */
  const saveSettings = () => {
    setSettingsSts('saving')
    localStorage.setItem('tl_rapid_key', rapidKey)
    localStorage.setItem('tl_dbx_token', dropboxTok)
    localStorage.setItem('tl_max_dur', String(filterDur))
    setTimeout(() => setSettingsSts('ok'), 600)
  }

  /* ── derived ─────────────────────────────────────────── */
  const bPct     = bTotal > 0 ? Math.round((bDone / bTotal) * 100) : 0
  const sel      = getSel()
  const lib      = getLib()
  const selLen   = sel.length
  const expiring = lib.filter(x => daysAgo(x.savedAt) >= 25).length

  const SORTS: { k: Sort; l: string }[] = [
    { k: 'default', l: 'الافتراضي' }, { k: 'views', l: '▶ مشاهدات' },
    { k: 'likes', l: '❤ لايكات' }, { k: 'shortest', l: '⏱ الأقصر' }, { k: 'longest', l: '⏱ الأطول' },
  ]

  /* ══════════════════════════════════════════════════════ */
  /*  RENDER                                                */
  /* ══════════════════════════════════════════════════════ */
  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <div className="blob b1" /><div className="blob b2" />
        <div className="page">

          {/* HEADER */}
          <div className="hdr">
            <div className="logo">TIKLOAD</div>
            <div className="logo-sub">تحميل فيديوهات تيك توك · بدون علامة مائية</div>
            {dropboxTok && (
              <div><span className="dbx-pill"><span className="dbx-dot" />☁️ Dropbox متصل — يرفع تلقائياً في /videos</span></div>
            )}
          </div>

          {/* TABS */}
          <div className="tabs">
            <button className={`tab${tab === 'search' ? ' on' : ''}`} onClick={() => setTab('search')}>🔍 البحث</button>
            <button className={`tab${tab === 'library' ? ' on' : ''}`} onClick={() => setTab('library')}>
              {lib.length > 0 && <span className="tbadge">{lib.length}</span>}
              📁 مكتبتي
            </button>
            <button className={`tab${tab === 'settings' ? ' on' : ''}`} onClick={() => setTab('settings')}>⚙️ الإعدادات</button>
          </div>

          {/* ══ SEARCH TAB ══ */}
          {tab === 'search' && <>

            {/* mode */}
            <div className="mbar">
              <span className="mlab">وضع التحميل:</span>
              <div className="mopts">
                <button className={`mopt${mode === 'device' ? ' on dev' : ''}`} onClick={() => setMode('device')}>💾 على الجهاز</button>
                <button className={`mopt${mode === 'library' ? ' on lib' : ''}`} onClick={() => setMode('library')}>📁 مكتبة فقط</button>
              </div>
              <div className="mbar-info">
                {mode === 'device'
                  ? <>⬇ يحمّل على جهازك{dropboxTok && ' + يرفع على Dropbox تلقائياً'}</>
                  : <>📁 يحفظ في المكتبة فقط{dropboxTok && ' + يرفع على Dropbox تلقائياً'}</>
                }
              </div>
            </div>

            {/* search */}
            <div className="sc">
              <label className="fl">رابط البروفايل أو الفيديو</label>
              <div className="srow">
                <input className="inp" dir="ltr"
                  placeholder="tiktok.com/@username  أو رابط فيديو مباشر"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                <button className="btn bfetch" onClick={handleSearch} disabled={loading || !urlInput.trim()}>
                  {loading ? 'جاري الجلب...' : 'جلب الفيديوهات'}
                </button>
              </div>
              <div className="chips">
                {['@mrbeast', '@khaby.lame', '@charlidamelio'].map(ex => (
                  <span key={ex} className="chip" onClick={() => setUrlInput(ex)}>{ex}</span>
                ))}
              </div>
            </div>

            {error   && <div className="al ae">⚠ {error}</div>}
            {status && !error && <div className="al as"><div className="dot" />{status}</div>}
            {skipped > 0 && <div className="al aw">ℹ تم تخطي {skipped} فيديو (أطول من {Math.floor(filterDur / 60)} دقائق)</div>}

            {busy && (
              <div className="prc">
                <div className="prh">
                  <span className="prt">{mode === 'library' ? '📁 جاري الحفظ...' : '⬇ جاري التحميل...'} {bLabel}</span>
                  <span className="prn">{bDone}/{bTotal}</span>
                </div>
                <div className="ptr"><div className={`pf ${mode}`} style={{ width: `${bPct}%` }} /></div>
                <div className="ps">{bPct}%{dropboxTok ? ' · ☁️ يُرفع على Dropbox في الخلفية' : ''}</div>
              </div>
            )}

            {loading && (
              <div className="sg">{Array.from({ length: 8 }).map((_, i) => (
                <div className="sk" key={i}><div className="skt" /><div className="skl" /><div className="skl s" /></div>
              ))}</div>
            )}

            {!loading && videos.length > 0 && <>
              <div className="frow">
                <span className="flab">ترتيب:</span>
                {SORTS.map(s => <button key={s.k} className={`fb${sort === s.k ? ' on' : ''}`} onClick={() => setSort(s.k)}>{s.l}</button>)}
              </div>

              <div className="tbar">
                <div className="tbl">
                  <div><div className="vcnt">{videos.length}</div><div className="vlab">فيديو</div></div>
                  <button className="btn bghost bsm" onClick={() => selAll(videos)} disabled={busy}>تحديد الكل</button>
                  {selLen > 0 && <button className="btn bghost bsm" onClick={clrSel} disabled={busy}>✕ إلغاء</button>}
                </div>
              </div>

              {selLen > 0 && (
                <div className="selbar">
                  <div className="selL">
                    <div>
                      <div className={`seln ${mode}`}>{selLen}</div>
                      <div className="selh">فيديو محدد — اضغط الصورة لإضافة أو إزالة</div>
                    </div>
                  </div>
                  <div className="selR">
                    {mode === 'device'
                      ? <button className="btn bdl bsm" onClick={() => bulkAction([...sel], mode)} disabled={busy}>
                          {busy ? `⬇ ${bPct}%` : `⬇ تحميل ${selLen} فيديو`}
                        </button>
                      : <button className="btn blib bsm" onClick={() => bulkAction([...sel], mode)} disabled={busy}>
                          {busy ? `📁 ${bPct}%` : `📁 حفظ ${selLen} في المكتبة`}
                        </button>
                    }
                  </div>
                </div>
              )}

              <div className="grid">
                {sorted.map(v => {
                  const id     = String(v.id)
                  const idx    = sel.indexOf(id)
                  const isSel  = idx !== -1
                  const isDl   = dlId === id
                  const inLib  = isInLib(id)
                  const isUp   = dbxUp.has(id)
                  const isDone = dbxDone.has(id)
                  const cls    = `card${isSel ? (mode === 'library' ? ' slib' : ' sdv') : ''}`
                  return (
                    <div key={id} className={cls}>
                      {/* thumbnail = select area */}
                      <div className="cth" onClick={() => { if (!busy && !isDl) toggleSel(id) }}>
                        <img src={v.cover || v.origin_cover} alt="" loading="lazy"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        {v.duration > 0 && <div className="dur">{sec2str(v.duration)}</div>}
                        <div className="ck"><span className="ct">✓</span></div>
                        {isSel && <div className="sord">{idx + 1}</div>}
                        {isUp  && <div className="dbx-overlay uploading"><div className="dbx-spin" />Dropbox</div>}
                        {isDone && !isUp && <div className="dbx-overlay done">☁️ Dropbox</div>}
                      </div>

                      <div className="cbody">
                        <div className="cst">
                          <span>❤ {n2s(v.digg_count)}</span>
                          <span>▶ {n2s(v.play_count)}</span>
                          {v.comment_count > 0 && <span>💬 {n2s(v.comment_count)}</span>}
                        </div>
                        <div className="cdesc">{v.title || 'بدون عنوان'}</div>
                      </div>

                      <div className="cfoot">
                        {mode === 'device' ? (
                          inLib
                            ? <div className="saved">✓ تم التحميل</div>
                            : <button className="abtn dev" onClick={() => dlOne(v)} disabled={isDl || busy}>
                                {isDl ? '⏳ جاري...' : '⬇ تحميل'}
                              </button>
                        ) : (
                          inLib
                            ? <div className="saved">✓ في المكتبة</div>
                            : <button className="abtn lib" onClick={() => dlOne(v)} disabled={isDl || busy}>
                                {isDl ? '⏳...' : '📁 حفظ'}
                              </button>
                        )}
                        {mode === 'device' && !inLib && (
                          <button className="abtn lib" onClick={() => { addToLib([v]); triggerDropbox(v) }} disabled={busy}>
                            📁 حفظ في المكتبة
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {hasMore && (
                <div className="lmw">
                  <button className="btn bmore" onClick={loadMore} disabled={moreLoad}>
                    {moreLoad ? 'جاري التحميل...' : '⬇ تحميل المزيد'}
                  </button>
                </div>
              )}
            </>}

            {!loading && videos.length === 0 && !error && (
              <div className="emp">
                <div className="eico">🎬</div>
                <div className="etit">ابدأ من هنا</div>
                <div className="esub">أدخل رابط بروفايل تيك توك أو فيديو مباشر</div>
              </div>
            )}
          </>}

          {/* ══ LIBRARY TAB ══ */}
          {tab === 'library' && <>
            {expiring > 0 && <div className="al aw">⚠ {expiring} فيديو ستُحذف تلقائياً خلال أقل من 5 أيام</div>}
            <div className="lhdr">
              <div className="ltit">📁 مكتبتي ({lib.length})</div>
              {lib.length > 0 && (
                <button className="btn bdanger bsm"
                  onClick={() => { if (confirm('مسح المكتبة كاملة؟')) saveLib([]) }}>
                  🗑 مسح الكل
                </button>
              )}
            </div>
            {lib.length > 0 && (
              <div className="lstats">
                <div className="lstat"><div className="lsn">{lib.length}</div><div className="lsl">محفوظ</div></div>
                <div className="lstat"><div className="lsn">{lib.filter(x => daysAgo(x.savedAt) < 7).length}</div><div className="lsl">هذا الأسبوع</div></div>
                <div className="lstat"><div className="lsn">{expiring}</div><div className="lsl">تنتهي قريباً</div></div>
              </div>
            )}
            {lib.length === 0 ? (
              <div className="lemp"><div className="leico">📭</div><div className="letxt">لم تحفظ أي فيديو بعد.</div></div>
            ) : (
              <div className="grid">
                {lib.map(item => {
                  const d = daysAgo(item.savedAt)
                  return (
                    <div key={item.id} className="li">
                      <div className="lth">
                        <img src={item.cover} alt="" loading="lazy"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        <div className={`la ${d >= 25 ? 'old' : 'ok'}`}>{d === 0 ? 'اليوم' : `${d} يوم`}</div>
                      </div>
                      <div className="lbd">
                        <div className="ldesc">{item.title}</div>
                        <div className="ldate">📅 منذ {d} يوم</div>
                        <button className="lrm" onClick={() => rmFromLib(item.id)}>✕ إزالة</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>}

          {/* ══ SETTINGS TAB ══ */}
          {tab === 'settings' && (
            <div className="settings-grid">

              <div className="scard">
                <div className="scard-title">🔑 مفاتيح RapidAPI</div>
                <div className="scard-row">
                  <label className="scard-lbl">RAPIDAPI KEY (الرئيسي)</label>
                  <input className="sinp" type="password" placeholder="أدخل المفتاح..."
                    value={rapidKey} onChange={e => setRapidKey(e.target.value)} />
                </div>
                <div className="sinfo">
                  احصل على مفتاح مجاني من{' '}
                  <a href="https://rapidapi.com/tikwm-tikwm-default/api/tiktok-scraper7" target="_blank" rel="noopener noreferrer">
                    RapidAPI
                  </a>
                  <br />الموقع يستخدم tikwm.com تلقائياً لو انتهت الحصة.
                </div>
              </div>

              <div className="scard">
                <div className="scard-title">☁️ Dropbox</div>
                <div className="scard-row">
                  <label className="scard-lbl">Access Token</label>
                  <input className="sinp" type="password" placeholder="sl.u...."
                    value={dropboxTok} onChange={e => setDropboxTok(e.target.value)} />
                </div>
                <div className="sinfo">
                  الفيديوهات تُرفع تلقائياً في مجلد <strong>/videos</strong> على Dropbox.
                  <br />
                  <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener noreferrer">
                    أنشئ App واحصل على Token
                  </a>
                </div>
              </div>

              <div className="scard">
                <div className="scard-title">⏱ فلتر المدة</div>
                <div className="scard-row">
                  <label className="scard-lbl">الحد الأقصى للمدة (ثانية)</label>
                  <input className="sinp" type="number" min={30} max={600}
                    value={filterDur} onChange={e => setFilterDur(Number(e.target.value))} />
                </div>
                <div className="sinfo">
                  الإعداد الحالي: أقل من <strong>{Math.floor(filterDur / 60)} دقائق و{filterDur % 60} ثانية</strong>
                </div>
              </div>

              <div className="scard" style={{ gridColumn: '1 / -1' }}>
                <button className="btn bfetch" onClick={saveSettings} style={{ minWidth: 160 }}>
                  💾 حفظ الإعدادات
                </button>
                {settingsSts === 'ok' && <span className="sstatus ok" style={{ marginRight: 12 }}>✓ تم الحفظ</span>}
                <div className="sinfo" style={{ marginTop: 12 }}>
                  ملاحظة: مفاتيح API تُضاف أيضاً في Vercel → Environment Variables للأمان.
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </>
  )
}
