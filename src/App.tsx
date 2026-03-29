import { useState, useCallback, useRef } from 'react'

const API      = '/api/tikwm'
const DL_API   = '/api/download'
const DBX_API  = '/api/dropbox'
const MAX_DUR  = 5 * 60
const LIB_KEY  = 'tikload_lib'
const MONTH_MS = 30 * 24 * 60 * 60 * 1000

type Video   = { id:string; cover:string; origin_cover:string; title:string; duration:number; play:string; wmplay:string; digg_count:number; play_count:number }
type LibItem = { id:string; cover:string; title:string; savedAt:number }
type Sort    = 'default'|'views'|'likes'|'shortest'|'longest'
type Mode    = 'device'|'library'

function lsRead():LibItem[]{
  try{ return (JSON.parse(localStorage.getItem(LIB_KEY)||'[]') as LibItem[]).filter(x=>Date.now()-x.savedAt<MONTH_MS) }
  catch{ return [] }
}
function lsWrite(items:LibItem[]){ try{ localStorage.setItem(LIB_KEY,JSON.stringify(items)) }catch{} }

const n2s=(n:number)=>!n?'0':n>=1e6?(n/1e6).toFixed(1)+'M':n>=1000?(n/1000).toFixed(1)+'K':String(n)
const sec2str=(s:number)=>`${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`
const daysSince=(ts:number)=>Math.floor((Date.now()-ts)/86400000)

function parseHandle(v:string):string|null{
  v=v.trim()
  const m=v.match(/tiktok\.com\/@([^/?&\s]+)/)
  if(m) return m[1]
  if(v.startsWith('@')) return v.slice(1)
  if(!v.includes('/')&&!v.includes('.')&&v.length>0) return v
  return null
}
const isVideoLink=(v:string)=>v.includes('tiktok.com')&&v.includes('/video/')

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#06080f;color:#dde3f0;font-family:'DM Sans',sans-serif;min-height:100vh;-webkit-font-smoothing:antialiased}
.blob1{position:fixed;width:640px;height:640px;border-radius:50%;background:radial-gradient(circle,rgba(0,200,255,.05),transparent 65%);top:-240px;left:-240px;pointer-events:none;z-index:0}
.blob2{position:fixed;width:500px;height:500px;border-radius:50%;background:radial-gradient(circle,rgba(0,97,255,.04),transparent 65%);bottom:-150px;right:-150px;pointer-events:none;z-index:0}
.page{max-width:1180px;margin:0 auto;padding:44px 20px 100px;position:relative;z-index:1}

/* header */
.hdr{text-align:center;margin-bottom:42px}
.logo{font-family:'Bebas Neue',cursive;font-size:clamp(54px,9vw,90px);letter-spacing:6px;line-height:1;background:linear-gradient(135deg,#fff 0%,#00ffb0 45%,#ff0050 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.logo-sub{font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#1e2535;margin-top:8px}
.dbx-pill{display:inline-flex;align-items:center;gap:7px;margin-top:12px;padding:6px 16px;background:rgba(0,97,255,.08);border:1px solid rgba(0,97,255,.2);border-radius:99px;font-size:12px;color:#4488ff}
.dbx-dot{width:7px;height:7px;border-radius:50%;background:#0061ff;animation:pu 2s infinite}

/* tabs */
.tabs{display:flex;gap:4px;margin-bottom:22px;background:#0b0e1a;border:1px solid #141929;border-radius:12px;padding:5px;width:fit-content}
.tab{padding:8px 20px;border-radius:9px;border:none;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;background:transparent;color:#2e3650;display:flex;align-items:center;gap:6px}
.tab.on{background:#10142a;color:#dde3f0}
.tbadge{min-width:17px;height:17px;border-radius:99px;background:#00ffb0;color:#000;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;padding:0 4px}

/* mode bar */
.mbar{display:flex;align-items:center;gap:10px;background:#0b0e1a;border:1px solid #141929;border-radius:12px;padding:12px 16px;margin-bottom:14px;flex-wrap:wrap}
.mlab{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#1e2535}
.mopts{display:flex;gap:5px;flex-wrap:wrap}
.mopt{padding:6px 14px;border-radius:8px;border:1px solid #141929;background:transparent;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;color:#2e3650;cursor:pointer;transition:all .2s}
.mopt:hover{border-color:#1e2a3e;color:#5a6e8e}
.mopt.on.dev{background:rgba(0,255,176,.06);border-color:#00ffb0;color:#00ffb0}
.mopt.on.lib{background:rgba(168,85,247,.06);border-color:#a855f7;color:#c084fc}
.mdesc{font-size:12px;color:#1a2030;width:100%;margin-top:4px}
.dbx-always{font-size:12px;color:#4488ff;background:rgba(0,97,255,.06);border:1px solid rgba(0,97,255,.15);border-radius:8px;padding:7px 12px;width:100%;margin-top:6px}

/* search */
.sc{background:#0b0e1a;border:1px solid #141929;border-radius:16px;padding:22px 26px;margin-bottom:14px;transition:border-color .25s}
.sc:focus-within{border-color:#00ffb0}
.fl{display:block;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#1e2535;margin-bottom:10px}
.srow{display:flex;gap:10px;align-items:stretch;flex-wrap:wrap}
.inp{flex:1 1 240px;background:#06080f;border:1px solid #141929;border-radius:10px;padding:11px 15px;color:#dde3f0;font-family:'DM Sans',sans-serif;font-size:14px;outline:none;transition:border-color .2s;min-height:44px}
.inp:focus{border-color:#00ffb0}
.inp::placeholder{color:#151c2e}
.chips{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
.chip{font-size:12px;padding:4px 12px;background:#080b15;border:1px solid #121827;border-radius:99px;color:#1e2a3e;cursor:pointer;transition:all .2s}
.chip:hover{border-color:#1e2a3e;color:#4a5e7e}

/* buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 20px;min-height:44px;border:none;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;white-space:nowrap}
.btn:disabled{opacity:.25;cursor:not-allowed!important;transform:none!important;box-shadow:none!important}
.bfe{background:linear-gradient(135deg,#00ffb0,#00b4ff);color:#000}
.bfe:not(:disabled):hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(0,255,176,.28)}
.bdl{background:linear-gradient(135deg,#ff0050,#ff4d00);color:#fff}
.bdl:not(:disabled):hover{transform:translateY(-1px)}
.blib{background:linear-gradient(135deg,#a855f7,#6366f1);color:#fff}
.blib:not(:disabled):hover{transform:translateY(-1px)}
.bmore{background:#0b0e1a;color:#2e3650;border:1px solid #141929}
.bmore:not(:disabled):hover{border-color:#1e2a3e;color:#5a6e8e}
.bghost{background:transparent;color:#2e3650;border:1px solid #141929}
.bghost:not(:disabled):hover{border-color:#1e2a3e;color:#5a6e8e}
.bsm{padding:0 13px;min-height:32px;font-size:12px;border-radius:8px}

/* alerts */
.al{display:flex;align-items:flex-start;gap:9px;padding:11px 15px;border-radius:10px;font-size:13px;margin-bottom:12px;line-height:1.5}
.al-err{background:rgba(255,0,80,.06);border:1px solid rgba(255,0,80,.15);color:#ff6070}
.al-ok{background:rgba(0,255,176,.04);border:1px solid rgba(0,255,176,.1);color:#00dda0}
.al-info{background:#0b0e1a;border:1px solid #141929;color:#2e3650}
.al-warn{background:rgba(255,175,0,.04);border:1px solid rgba(255,175,0,.12);color:#b08000}
.dot{width:7px;height:7px;border-radius:50%;background:#00ffb0;flex-shrink:0;margin-top:3px;animation:pu 1.6s infinite}
@keyframes pu{0%,100%{opacity:1}50%{opacity:.2}}

/* progress */
.prc{background:#0b0e1a;border:1px solid #141929;border-radius:12px;padding:16px 20px;margin-bottom:14px}
.prh{display:flex;justify-content:space-between;margin-bottom:9px}
.prt{font-size:13px;font-weight:600;color:#8899bb}
.prp{font-size:13px;color:#2e3650}
.prtr{height:4px;background:#101525;border-radius:99px;overflow:hidden;margin-bottom:5px}
.prf{height:100%;border-radius:99px;transition:width .3s;background:linear-gradient(90deg,#ff0050,#ff4d00)}
.prf.lib{background:linear-gradient(90deg,#a855f7,#6366f1)}
.prs{font-size:11px;color:#1a2030}

/* dbx progress pill */
.dbx-uploading{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:#4488ff;background:rgba(0,97,255,.07);border:1px solid rgba(0,97,255,.15);border-radius:99px;padding:3px 10px;margin-top:3px}
.dbx-spin{width:8px;height:8px;border-radius:50%;border:2px solid #4488ff44;border-top-color:#4488ff;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

/* filters + toolbar */
.frow{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
.flab{font-size:10px;color:#1e2535;font-weight:700;letter-spacing:1.5px;text-transform:uppercase}
.fb{padding:5px 12px;border-radius:99px;border:1px solid #121827;background:transparent;color:#252e42;font-family:'DM Sans',sans-serif;font-size:12px;cursor:pointer;transition:all .2s}
.fb:hover{border-color:#1e2a3e;color:#4a5e7e}
.fb.on{background:#10142a;border-color:#00ffb0;color:#00ffb0}
.tbar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px}
.tbl{display:flex;align-items:center;gap:11px;flex-wrap:wrap}
.vcnt{font-family:'Bebas Neue',cursive;font-size:28px;letter-spacing:1px;color:#00ffb0;line-height:1}
.vlab{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#151c2e}

/* selection bar */
.selbar{background:#0b0e1a;border:1px solid #141929;border-radius:12px;padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}
.selL{display:flex;align-items:center;gap:10px}
.selcnt{font-family:'Bebas Neue',cursive;font-size:22px;letter-spacing:1px}
.selcnt.dev{color:#ff4070}
.selcnt.lib{color:#c084fc}
.selhint{font-size:12px;color:#1e2535}
.selR{display:flex;gap:7px;flex-wrap:wrap}

/* grid */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(185px,1fr));gap:12px}

/* card */
.card{background:#090c18;border:2px solid transparent;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;user-select:none;transition:border-color .15s,transform .15s,box-shadow .15s}
.card:hover{transform:translateY(-2px);border-color:#141929}
.card.sdv{border-color:#ff0050!important;box-shadow:0 0 16px rgba(255,0,80,.12)}
.card.slib{border-color:#a855f7!important;box-shadow:0 0 16px rgba(168,85,247,.12)}

.cthumb{position:relative;aspect-ratio:9/16;overflow:hidden;background:#0d1020;flex-shrink:0;cursor:pointer}
.cthumb img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s}
.card:hover .cthumb img{transform:scale(1.04)}
.dur{position:absolute;bottom:7px;left:7px;background:rgba(0,0,0,.75);backdrop-filter:blur(5px);color:#fff;font-size:11px;font-weight:600;padding:2px 7px;border-radius:6px;pointer-events:none}
.ck{position:absolute;top:8px;right:8px;width:24px;height:24px;border-radius:50%;background:rgba(0,0,0,.6);border:2px solid #1e2535;display:flex;align-items:center;justify-content:center;transition:all .15s;pointer-events:none}
.card.sdv .ck{background:#ff0050;border-color:#ff0050}
.card.slib .ck{background:#a855f7;border-color:#a855f7}
.ct{font-size:12px;font-weight:800;color:#fff;opacity:0;transition:opacity .15s}
.card.sdv .ct,.card.slib .ct{opacity:1}
.sord{position:absolute;top:8px;left:8px;min-width:20px;height:20px;border-radius:99px;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 4px;pointer-events:none}
.card.sdv .sord{background:#ff0050;color:#fff}
.card.slib .sord{background:#a855f7;color:#fff}

.cbody{padding:9px 11px 4px;flex:1}
.cst{display:flex;gap:9px;font-size:11px;color:#1e2535;margin-bottom:4px}
.cdesc{font-size:12px;color:#252e42;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.cfoot{padding:6px 10px 10px;display:flex;flex-direction:column;gap:5px}

.abtn{width:100%;min-height:32px;border-radius:8px;font-size:12px;font-weight:600;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .2s}
.abtn:disabled{opacity:.25;cursor:not-allowed}
.abtn.dev{background:linear-gradient(135deg,#ff0050,#ff4d00);color:#fff}
.abtn.dev:not(:disabled):hover{transform:translateY(-1px)}
.abtn.lib{background:rgba(168,85,247,.1);color:#c084fc;border:1px solid rgba(168,85,247,.2)}
.abtn.lib:not(:disabled):hover{background:rgba(168,85,247,.18)}
.saved{width:100%;min-height:27px;border-radius:7px;font-size:11px;font-weight:600;border:1px solid rgba(0,255,176,.14);background:rgba(0,255,176,.04);color:#009966;display:flex;align-items:center;justify-content:center;gap:4px}
.dbx-saved{width:100%;min-height:24px;border-radius:6px;font-size:11px;font-weight:600;color:#4488ff;display:flex;align-items:center;justify-content:center;gap:4px;opacity:.8}

.lmw{display:flex;justify-content:center;margin-top:26px}

/* skeletons */
.sg{display:grid;grid-template-columns:repeat(auto-fill,minmax(185px,1fr));gap:12px}
.sk{background:#090c18;border-radius:14px;overflow:hidden}
.skt{aspect-ratio:9/16;background:linear-gradient(90deg,#090c18 25%,#0e1122 50%,#090c18 75%);background-size:200% 100%;animation:shim 1.4s infinite}
.skl{height:9px;margin:9px 11px 0;border-radius:4px;background:linear-gradient(90deg,#090c18 25%,#0e1122 50%,#090c18 75%);background-size:200% 100%;animation:shim 1.4s infinite}
.skl.s{width:55%;margin-bottom:10px}
@keyframes shim{0%{background-position:200% 0}100%{background-position:-200% 0}}

.emp{text-align:center;padding:80px 20px}
.ei{font-size:48px;margin-bottom:14px}
.et{font-family:'Bebas Neue',cursive;font-size:32px;letter-spacing:2px;color:#111828;margin-bottom:6px}
.es{font-size:13px;color:#151c2e}

/* library */
.lhdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px}
.lt{font-family:'Bebas Neue',cursive;font-size:24px;letter-spacing:2px;color:#252e42}
.lstats{display:flex;gap:11px;flex-wrap:wrap;margin-bottom:16px}
.lstat{background:#090c18;border:1px solid #111828;border-radius:10px;padding:11px 16px}
.lsn{font-family:'Bebas Neue',cursive;font-size:22px;color:#00ffb0}
.lsl{font-size:11px;color:#1e2535}
.li{background:#090c18;border:1px solid #111828;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;transition:border-color .2s}
.li:hover{border-color:rgba(0,255,176,.15)}
.lth{position:relative;aspect-ratio:9/16;overflow:hidden;background:#0d1020}
.lth img{width:100%;height:100%;object-fit:cover;display:block}
.la{position:absolute;top:7px;left:7px;font-size:10px;font-weight:600;padding:2px 6px;border-radius:5px}
.la.old{background:rgba(255,0,80,.7);color:#fff}
.la.ok{background:rgba(0,255,176,.15);color:#00ffb0}
.lbd{padding:9px 11px 11px;flex:1;display:flex;flex-direction:column;gap:5px}
.ldesc{font-size:12px;color:#252e42;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;flex:1}
.ldate{font-size:11px;color:#151c2e}
.lrm{min-height:28px;border-radius:7px;border:none;background:rgba(255,0,80,.07);color:#ff4060;font-size:11px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background .2s}
.lrm:hover{background:rgba(255,0,80,.13)}
.lemp{text-align:center;padding:55px 20px}
.lei{font-size:40px;margin-bottom:12px}
.let{font-size:13px;color:#111828;line-height:1.7}

@media(max-width:540px){
  .grid,.sg{grid-template-columns:repeat(2,1fr);gap:8px}
  .srow{flex-direction:column}
  .inp{flex:1 1 100%}
  .btn{width:100%}
  .sc{padding:15px}
  .selR{width:100%}
  .selR .btn{flex:1}
}
`

export default function App() {
  const [tab,  setTab]  = useState<'search'|'library'>('search')
  const [mode, setMode] = useState<Mode>('device')

  const [urlInput, setUrlInput] = useState('')
  const [videos,   setVideos]   = useState<Video[]>([])
  const [cursor,   setCursor]   = useState<string|null>(null)
  const [hasMore,  setHasMore]  = useState(false)
  const [curUser,  setCurUser]  = useState('')
  const [skipped,  setSkipped]  = useState(0)
  const [loading,  setLoading]  = useState(false)
  const [moreLoad, setMoreLoad] = useState(false)
  const [status,   setStatus]   = useState('')
  const [error,    setError]    = useState('')
  const [dlId,     setDlId]     = useState<string|null>(null)
  const [sort,     setSort]     = useState<Sort>('default')
  const [busy,     setBusy]     = useState(false)
  const [bDone,    setBDone]    = useState(0)
  const [bTotal,   setBTotal]   = useState(0)
  const [bLabel,   setBLabel]   = useState('')

  // track which videos are currently uploading to Dropbox in background
  const [dbxUploading, setDbxUploading] = useState<Set<string>>(new Set())
  const [dbxDone,      setDbxDone]      = useState<Set<string>>(new Set())

  // ── selection ─────────────────────────────────────────
  const selRef = useRef<string[]>([])
  const [, forceSelRender] = useState(0)
  const getSel    = () => selRef.current
  const toggleSel = (id:string) => {
    const c=selRef.current
    selRef.current = c.includes(id)?c.filter(x=>x!==id):[...c,id]
    forceSelRender(n=>n+1)
  }
  const selectAll = (vids:Video[]) => { selRef.current=vids.map(v=>String(v.id)); forceSelRender(n=>n+1) }
  const clearSel  = () => { selRef.current=[]; forceSelRender(n=>n+1) }

  // ── library ───────────────────────────────────────────
  const libRef = useRef<LibItem[]>(lsRead())
  const [, forceLibRender] = useState(0)
  const getLib    = () => libRef.current
  const saveLib   = (items:LibItem[]) => { libRef.current=items; lsWrite(items); forceLibRender(n=>n+1) }
  const addToLib  = (vs:Video[]) => {
    const existing=new Set(libRef.current.map(x=>x.id))
    const now=Date.now()
    const fresh:LibItem[]=[]
    for(const v of vs){
      const id=String(v.id)
      if(!existing.has(id)){ existing.add(id); fresh.push({id,cover:v.cover||v.origin_cover,title:v.title||'بدون عنوان',savedAt:now}) }
    }
    if(fresh.length) saveLib([...fresh,...libRef.current])
  }
  const removeFromLib = (id:string) => saveLib(libRef.current.filter(x=>x.id!==id))
  const isInLib       = (id:string) => libRef.current.some(x=>x.id===id)

  // ── fetch ─────────────────────────────────────────────
  const fetchPage = async (username:string, cur?:string) => {
    const qs=new URLSearchParams({endpoint:'user/posts',unique_id:username,count:'35',...(cur?{cursor:cur}:{})})
    const r=await fetch(`${API}?${qs}`)
    const d=await r.json()
    if(!d||d.code!==0) throw new Error(d?.msg||'تعذّر جلب البروفايل.')
    const all:Video[]=d.data?.videos||[]
    const filtered=all.filter(v=>!v.duration||v.duration<=MAX_DUR)
    return { filtered, skippedN:all.length-filtered.length, nextCursor:d.data?.cursor||null, hasMore:!!d.data?.hasMore }
  }

  const searchProfile = useCallback(async (username:string) => {
    setLoading(true); setError(''); setVideos([]); setSkipped(0)
    clearSel(); setCursor(null); setHasMore(false); setCurUser(username)
    setStatus(`جاري جلب فيديوهات @${username}...`)
    try {
      const pg=await fetchPage(username)
      if(!pg.filtered.length) throw new Error('لا توجد فيديوهات في هذا الحساب.')
      setVideos(pg.filtered); setSkipped(pg.skippedN)
      setCursor(pg.nextCursor); setHasMore(pg.hasMore)
      setStatus(`تم جلب ${pg.filtered.length} فيديو من @${username}${pg.hasMore?' · اضغط «تحميل المزيد»':''}`)
    } catch(e:any){ setError(e.message); setStatus('') }
    finally{ setLoading(false) }
  },[])

  const loadMoreVideos = async () => {
    if(!curUser||!cursor||moreLoad) return
    setMoreLoad(true)
    try {
      const pg=await fetchPage(curUser,cursor)
      setVideos(prev=>{ const ids=new Set(prev.map(v=>String(v.id))); return [...prev,...pg.filtered.filter(v=>!ids.has(String(v.id)))] })
      setSkipped(s=>s+pg.skippedN); setCursor(pg.nextCursor); setHasMore(pg.hasMore)
    } catch(e:any){ setError(e.message) }
    finally{ setMoreLoad(false) }
  }

  const searchSingleVideo = useCallback(async (vUrl:string) => {
    setLoading(true); setError(''); setStatus('جاري جلب الفيديو...')
    try {
      const r=await fetch(`${API}?endpoint=&url=${encodeURIComponent(vUrl)}`)
      const d=await r.json()
      if(!d||d.code!==0) throw new Error(d?.msg||'تعذّر جلب الفيديو.')
      if(d.data?.duration>MAX_DUR) throw new Error('هذا الفيديو أطول من 5 دقائق.')
      setVideos([d.data]); setHasMore(false); setStatus('تم جلب الفيديو بنجاح!')
    } catch(e:any){ setError(e.message); setStatus('') }
    finally{ setLoading(false) }
  },[])

  const handleSearch = () => {
    const v=urlInput.trim(); if(!v) return; setError('')
    if(isVideoLink(v)) searchSingleVideo(v)
    else { const u=parseHandle(v); if(!u){setError('أدخل رابط بروفايل صحيح: @username');return} searchProfile(u) }
  }

  // ── Dropbox upload (runs in background, non-blocking) ─
  const uploadToDropbox = (video:Video) => {
    const id   = String(video.id)
    const dlUrl= video.play||video.wmplay
    if(!dlUrl) return

    // أظهر مؤشر الرفع
    setDbxUploading(prev=>new Set(prev).add(id))

    fetch(DBX_API, {
      method: 'POST',
      headers: {
        'X-Video-Url': encodeURIComponent(dlUrl),
        'X-File-Name': `tiktok_${id}.mp4`,
      },
    })
    .then(r=>r.json())
    .then(data=>{
      if(data.success){
        setDbxDone(prev=>new Set(prev).add(id))
      }
    })
    .catch(()=>{/* فشل الرفع لا يوقف التجربة */})
    .finally(()=>{
      setDbxUploading(prev=>{ const s=new Set(prev); s.delete(id); return s })
    })
  }

  // ── download to device ────────────────────────────────
  const downloadToDevice = async (v:Video):Promise<boolean> => {
    const dlUrl=v.play||v.wmplay; if(!dlUrl) return false
    try {
      const res=await fetch(`${DL_API}?url=${encodeURIComponent(dlUrl)}`)
      if(!res.ok) return false
      const blob=await res.blob()
      const a=document.createElement('a')
      a.href=URL.createObjectURL(blob); a.download=`tiktok_${v.id}.mp4`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href)
      return true
    } catch{ return false }
  }

  // ── process one video ─────────────────────────────────
  const processOne = async (v:Video) => {
    const id=String(v.id); setDlId(id); setError('')

    if(mode==='library'){
      addToLib([v])
      uploadToDropbox(v)   // رفع تلقائي على Dropbox
      setDlId(null); return
    }

    // device mode
    const ok=await downloadToDevice(v)
    if(ok){
      addToLib([v])
      uploadToDropbox(v)   // رفع تلقائي على Dropbox
    } else {
      setError('فشل التحميل، جرّب مرة أخرى.')
    }
    setDlId(null)
  }

  // ── bulk action ───────────────────────────────────────
  const bulkAction = async (currentSel:string[], currentMode:Mode) => {
    if(!currentSel.length) return
    const vMap=new Map(videos.map(v=>[String(v.id),v]))
    const toProcess=currentSel.map(id=>vMap.get(id)).filter(Boolean) as Video[]
    if(!toProcess.length) return

    setBusy(true); setBDone(0); setBTotal(toProcess.length); setError('')

    if(currentMode==='library'){
      setBLabel('جاري الحفظ في المكتبة...')
      addToLib(toProcess)
      // رفع الكل على Dropbox في الخلفية
      toProcess.forEach(v=>uploadToDropbox(v))
      setBDone(toProcess.length)
      await new Promise(r=>setTimeout(r,350))
      setBusy(false); setBLabel('')
      setStatus(`✅ تم حفظ ${toProcess.length} فيديو في المكتبة + بدأ الرفع على Dropbox!`)
      clearSel(); return
    }

    // device: download one by one + upload to Dropbox in background
    let failed=0
    for(let i=0;i<toProcess.length;i++){
      setBLabel(`فيديو ${i+1} من ${toProcess.length}`)
      const ok=await downloadToDevice(toProcess[i])
      if(ok){
        addToLib([toProcess[i]])
        uploadToDropbox(toProcess[i])  // رفع في الخلفية
      } else failed++
      setBDone(i+1)
      await new Promise(r=>setTimeout(r,700))
    }
    setBusy(false); setBLabel('')
    const success=toProcess.length-failed
    setStatus(`✅ تم تحميل ${success} فيديو على الجهاز + يُرفع على Dropbox تلقائياً!${failed>0?` (فشل ${failed})`:''}`)
    clearSel()
  }

  // ── derived ───────────────────────────────────────────
  const bPct   = bTotal>0?Math.round((bDone/bTotal)*100):0
  const sel    = getSel()
  const lib    = getLib()
  const selLen = sel.length
  const expiring=lib.filter(x=>daysSince(x.savedAt)>=25).length

  const sorted=[...videos].sort((a,b)=>{
    if(sort==='views')    return b.play_count-a.play_count
    if(sort==='likes')    return b.digg_count-a.digg_count
    if(sort==='shortest') return a.duration-b.duration
    if(sort==='longest')  return b.duration-a.duration
    return 0
  })

  const SORTS:{k:Sort;l:string}[]=[
    {k:'default',l:'الافتراضي'},{k:'views',l:'▶ مشاهدات'},
    {k:'likes',l:'❤ لايكات'},{k:'shortest',l:'⏱ الأقصر'},{k:'longest',l:'⏱ الأطول'},
  ]

  return (
    <>
      <style>{CSS}</style>
      <div style={{minHeight:'100vh',background:'#06080f'}}>
        <div className="blob1"/><div className="blob2"/>
        <div className="page">

          <div className="hdr">
            <div className="logo">TIKLOAD</div>
            <div className="logo-sub">تحميل فيديوهات تيك توك · بدون علامة مائية · تحت 5 دقائق</div>
            <div><span className="dbx-pill"><span className="dbx-dot"/> ☁️ Dropbox متصل — يرفع تلقائياً في /videos</span></div>
          </div>

          <div className="tabs">
            <button className={`tab${tab==='search'?' on':''}`} onClick={()=>setTab('search')}>🔍 البحث</button>
            <button className={`tab${tab==='library'?' on':''}`} onClick={()=>setTab('library')}>
              {lib.length>0&&<span className="tbadge">{lib.length}</span>}
              📁 مكتبتي
            </button>
          </div>

          {tab==='search'&&<>
            <div className="mbar">
              <span className="mlab">وضع التحميل:</span>
              <div className="mopts">
                <button className={`mopt${mode==='device'?' on dev':''}`} onClick={()=>setMode('device')}>💾 على الجهاز</button>
                <button className={`mopt${mode==='library'?' on lib':''}`} onClick={()=>setMode('library')}>📁 مكتبة فقط</button>
              </div>
              <div className="dbx-always">☁️ في كلا الوضعين: الفيديو يُرفع تلقائياً على Dropbox في مجلد /videos</div>
            </div>

            <div className="sc">
              <label className="fl">رابط البروفايل أو الفيديو</label>
              <div className="srow">
                <input className="inp" dir="ltr"
                  placeholder="tiktok.com/@username  أو رابط فيديو مباشر"
                  value={urlInput} onChange={e=>setUrlInput(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&handleSearch()}/>
                <button className="btn bfe" onClick={handleSearch} disabled={loading||!urlInput.trim()}>
                  {loading?'جاري الجلب...':'جلب الفيديوهات'}
                </button>
              </div>
              <div className="chips">
                {['@mrbeast','@khaby.lame','@charlidamelio'].map(ex=>(
                  <span key={ex} className="chip" onClick={()=>setUrlInput(ex)}>{ex}</span>
                ))}
              </div>
            </div>

            {error&&<div className="al al-err">⚠ {error}</div>}
            {status&&!error&&<div className="al al-info"><div className="dot"/>{status}</div>}
            {skipped>0&&<div className="al al-warn">ℹ تم تخطي {skipped} فيديو أطول من 5 دقائق</div>}

            {busy&&(
              <div className="prc">
                <div className="prh">
                  <span className="prt">{mode==='library'?'📁 جاري الحفظ...':'⬇ جاري التحميل...'} {bLabel}</span>
                  <span className="prp">{bDone}/{bTotal}</span>
                </div>
                <div className="prtr"><div className={`prf${mode==='library'?' lib':''}`} style={{width:`${bPct}%`}}/></div>
                <div className="prs">{bPct}% · ☁️ يُرفع على Dropbox في الخلفية</div>
              </div>
            )}

            {loading&&(
              <div className="sg">{Array.from({length:8}).map((_,i)=>(
                <div className="sk" key={i}><div className="skt"/><div className="skl"/><div className="skl s"/></div>
              ))}</div>
            )}

            {!loading&&videos.length>0&&<>
              <div className="frow">
                <span className="flab">ترتيب:</span>
                {SORTS.map(s=><button key={s.k} className={`fb${sort===s.k?' on':''}`} onClick={()=>setSort(s.k)}>{s.l}</button>)}
              </div>

              <div className="tbar">
                <div className="tbl">
                  <div><div className="vcnt">{videos.length}</div><div className="vlab">فيديو</div></div>
                  <button className="btn bghost bsm" onClick={()=>selectAll(videos)} disabled={busy}>تحديد الكل</button>
                  {selLen>0&&<button className="btn bghost bsm" onClick={clearSel} disabled={busy}>✕ إلغاء</button>}
                </div>
              </div>

              {selLen>0&&(
                <div className="selbar">
                  <div className="selL">
                    <div>
                      <div className={`selcnt ${mode}`}>{selLen}</div>
                      <div className="selhint">فيديو محدد — اضغط الصورة لإضافة أو إزالة</div>
                    </div>
                  </div>
                  <div className="selR">
                    {mode==='device'
                      ?<button className="btn bdl bsm" onClick={()=>bulkAction([...sel],mode)} disabled={busy}>
                          {busy?`⬇ ${bPct}%`:`⬇ تحميل ${selLen} + رفع Dropbox`}
                        </button>
                      :<button className="btn blib bsm" onClick={()=>bulkAction([...sel],mode)} disabled={busy}>
                          {busy?`📁 ${bPct}%`:`📁 حفظ ${selLen} + رفع Dropbox`}
                        </button>
                    }
                  </div>
                </div>
              )}

              <div className="grid">
                {sorted.map(v=>{
                  const id=String(v.id)
                  const idx=sel.indexOf(id)
                  const isSel=idx!==-1
                  const isDl=dlId===id
                  const inLib=isInLib(id)
                  const isUploading=dbxUploading.has(id)
                  const isUploaded=dbxDone.has(id)
                  const cardCls=`card${isSel?(mode==='library'?' slib':' sdv'):''}`
                  return (
                    <div key={id} className={cardCls}>
                      <div className="cthumb" onClick={()=>{ if(!busy&&!isDl) toggleSel(id) }}>
                        <img src={v.cover||v.origin_cover} alt="" loading="lazy"
                          onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
                        {v.duration>0&&<div className="dur">{sec2str(v.duration)}</div>}
                        <div className="ck"><span className="ct">✓</span></div>
                        {isSel&&<div className="sord">{idx+1}</div>}
                      </div>
                      <div className="cbody">
                        <div className="cst"><span>❤ {n2s(v.digg_count)}</span><span>▶ {n2s(v.play_count)}</span></div>
                        <div className="cdesc">{v.title||'بدون عنوان'}</div>
                      </div>
                      <div className="cfoot">
                        {/* زر التحميل/الحفظ */}
                        {mode==='device'&&(
                          inLib
                            ?<div className="saved">✓ محمّل</div>
                            :<button className="abtn dev" onClick={()=>processOne(v)} disabled={isDl||busy}>
                                {isDl?'⏳ جاري...':'⬇ تحميل + Dropbox'}
                              </button>
                        )}
                        {mode==='library'&&(
                          inLib
                            ?<div className="saved">✓ محفوظ</div>
                            :<button className="abtn lib" onClick={()=>processOne(v)} disabled={isDl||busy}>
                                {isDl?'⏳...':'📁 حفظ + Dropbox'}
                              </button>
                        )}
                        {/* مؤشر Dropbox */}
                        {isUploading&&<div className="dbx-uploading"><div className="dbx-spin"/>يُرفع على Dropbox...</div>}
                        {isUploaded&&!isUploading&&<div className="dbx-saved">☁️ في Dropbox /videos</div>}
                      </div>
                    </div>
                  )
                })}
              </div>

              {hasMore&&(
                <div className="lmw">
                  <button className="btn bmore" onClick={loadMoreVideos} disabled={moreLoad}>
                    {moreLoad?'جاري التحميل...':'⬇ تحميل المزيد'}
                  </button>
                </div>
              )}
            </>}

            {!loading&&videos.length===0&&!error&&(
              <div className="emp">
                <div className="ei">🎬</div>
                <div className="et">ابدأ من هنا</div>
                <div className="es">أدخل رابط بروفايل تيك توك أو فيديو مباشر</div>
              </div>
            )}
          </>}

          {tab==='library'&&<>
            {expiring>0&&<div className="al al-warn">⚠ {expiring} فيديو ستُحذف تلقائياً خلال أقل من 5 أيام</div>}
            <div className="lhdr">
              <div className="lt">📁 مكتبتي ({lib.length})</div>
              {lib.length>0&&<button className="btn bghost bsm" onClick={()=>{if(confirm('مسح المكتبة؟'))saveLib([])}}>🗑 مسح الكل</button>}
            </div>
            {lib.length>0&&(
              <div className="lstats">
                <div className="lstat"><div className="lsn">{lib.length}</div><div className="lsl">محفوظ</div></div>
                <div className="lstat"><div className="lsn">{lib.filter(x=>daysSince(x.savedAt)<7).length}</div><div className="lsl">هذا الأسبوع</div></div>
                <div className="lstat"><div className="lsn">{expiring}</div><div className="lsl">تنتهي قريباً</div></div>
              </div>
            )}
            {lib.length===0
              ?<div className="lemp"><div className="lei">📭</div><div className="let">لم تحفظ أي فيديو بعد.</div></div>
              :<div className="grid">
                {lib.map(item=>{
                  const d=daysSince(item.savedAt)
                  return (
                    <div key={item.id} className="li">
                      <div className="lth">
                        <img src={item.cover} alt="" loading="lazy"
                          onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
                        <div className={`la ${d>=25?'old':'ok'}`}>{d===0?'اليوم':`${d} يوم`}</div>
                      </div>
                      <div className="lbd">
                        <div className="ldesc">{item.title}</div>
                        <div className="ldate">📅 منذ {d} يوم</div>
                        <button className="lrm" onClick={()=>removeFromLib(item.id)}>✕ إزالة</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            }
          </>}

        </div>
      </div>
    </>
  )
}
