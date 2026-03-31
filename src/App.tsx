import { useState, useRef, useEffect } from 'react'
import {
  ApiKey, Provider, KeyStatus, loadKeys, saveKeys,
  addKey, removeKey, updateKeyStatus, buildKeysHeader,
  getDropboxToken, PROVIDER_INFO
} from './keys'

/* ── constants ───────────────────────────────────────── */
const MAX_DUR  = 5 * 60
const LIB_KEY  = 'tikload_lib_v2'
const MONTH_MS = 30 * 24 * 60 * 60 * 1000

/* ── types ───────────────────────────────────────────── */
type Video   = { id:string; cover:string; origin_cover:string; title:string; duration:number; play:string; wmplay:string; digg_count:number; play_count:number; comment_count?:number }
type LibItem = { id:string; cover:string; title:string; savedAt:number }
type Sort    = 'default'|'views'|'likes'|'shortest'|'longest'
type Mode    = 'device'|'library'
type Tab     = 'search'|'library'|'keys'

/* ── localStorage ────────────────────────────────────── */
function lsRead():LibItem[]{ try{ return (JSON.parse(localStorage.getItem(LIB_KEY)||'[]') as LibItem[]).filter(x=>Date.now()-x.savedAt<MONTH_MS) }catch{ return [] } }
function lsWrite(i:LibItem[]){ try{ localStorage.setItem(LIB_KEY,JSON.stringify(i)) }catch{} }

/* ── helpers ─────────────────────────────────────────── */
const n2s=(n:number)=>!n?'0':n>=1e6?(n/1e6).toFixed(1)+'M':n>=1000?(n/1000).toFixed(1)+'K':String(n)
const sec2str=(s:number)=>`${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`
const daysAgo=(ts:number)=>Math.floor((Date.now()-ts)/86400000)
function parseHandle(v:string):string|null{ v=v.trim(); const m=v.match(/tiktok\.com\/@([^/?&\s]+)/); if(m)return m[1]; if(v.startsWith('@'))return v.slice(1); if(!v.includes('/')&&!v.includes('.')&&v.length>0)return v; return null }
const isVidLink=(v:string)=>v.includes('tiktok.com')&&v.includes('/video/')

/* ── CSS ─────────────────────────────────────────────── */
const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#050810;color:#d0daf0;font-family:'DM Sans',sans-serif;min-height:100vh;-webkit-font-smoothing:antialiased}
.blob{position:fixed;border-radius:50%;pointer-events:none;z-index:0}
.b1{width:700px;height:700px;background:radial-gradient(circle,rgba(0,180,255,.048),transparent 65%);top:-260px;left:-260px}
.b2{width:550px;height:550px;background:radial-gradient(circle,rgba(100,0,255,.035),transparent 65%);bottom:-180px;right:-180px}
.pg{max-width:1200px;margin:0 auto;padding:44px 20px 100px;position:relative;z-index:1}

/* header */
.hdr{text-align:center;margin-bottom:40px}
.logo{font-family:'Bebas Neue',cursive;font-size:clamp(54px,9vw,92px);letter-spacing:7px;line-height:1;background:linear-gradient(135deg,#fff 0%,#00e0ff 40%,#7a00ff 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.logo-sub{font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#1a2238;margin-top:8px}
.status-pills{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:12px}
.pill{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:99px;font-size:11px;font-weight:600;border:1px solid}
.pill-dot{width:6px;height:6px;border-radius:50%;background:currentColor}
.pill.on{background:rgba(0,220,100,.07);border-color:rgba(0,220,100,.2);color:#00cc78}
.pill.off{background:rgba(255,60,60,.06);border-color:rgba(255,60,60,.15);color:#ff4444}
.pill.neutral{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.08);color:#3a4860}

/* tabs */
.tabs{display:flex;gap:3px;margin-bottom:22px;background:#09000f;border:1px solid #101525;border-radius:13px;padding:4px;width:fit-content}
.tab{padding:8px 18px;border-radius:9px;border:none;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;background:transparent;color:#253050;display:flex;align-items:center;gap:6px}
.tab.on{background:#0e1328;color:#d0daf0}
.tbadge{min-width:17px;height:17px;border-radius:99px;background:#00e0ff;color:#000;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;padding:0 4px}

/* mode bar */
.mbar{display:flex;align-items:center;gap:10px;background:#090c1c;border:1px solid #101525;border-radius:12px;padding:12px 16px;margin-bottom:14px;flex-wrap:wrap}
.mlab{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#1a2238}
.mopts{display:flex;gap:5px}
.mopt{padding:6px 14px;border-radius:8px;border:1px solid #101525;background:transparent;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;color:#253050;cursor:pointer;transition:all .2s}
.mopt.on-dev{background:rgba(255,60,100,.07);border-color:#ff3c64;color:#ff3c64}
.mopt.on-lib{background:rgba(122,0,255,.07);border-color:#7a00ff;color:#a855f7}
.mbar-note{font-size:12px;color:#16202e;width:100%;margin-top:3px}

/* search */
.sc{background:#090c1c;border:1px solid #101525;border-radius:16px;padding:20px 24px;margin-bottom:14px;transition:border-color .25s}
.sc:focus-within{border-color:#00e0ff}
.fl{display:block;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#18203a;margin-bottom:10px}
.sr{display:flex;gap:10px;align-items:stretch;flex-wrap:wrap}
.inp{flex:1 1 240px;background:#050810;border:1px solid #101525;border-radius:10px;padding:11px 15px;color:#d0daf0;font-family:'DM Sans',sans-serif;font-size:14px;outline:none;transition:border-color .2s;min-height:44px}
.inp:focus{border-color:#00e0ff}
.inp::placeholder{color:#101525}
.chips{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
.chip{font-size:12px;padding:4px 12px;background:#06090e;border:1px solid #0e1525;border-radius:99px;color:#18203a;cursor:pointer;transition:all .2s}
.chip:hover{border-color:#1a2840;color:#4a5e7e}

/* buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 18px;min-height:44px;border:none;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;white-space:nowrap}
.btn:disabled{opacity:.22;cursor:not-allowed!important;transform:none!important;box-shadow:none!important}
.bfetch{background:linear-gradient(135deg,#00e0ff,#7a00ff);color:#fff}
.bfetch:not(:disabled):hover{transform:translateY(-1px);box-shadow:0 6px 22px rgba(0,180,255,.3)}
.bdl{background:linear-gradient(135deg,#ff3c64,#ff7000);color:#fff}
.bdl:not(:disabled):hover{transform:translateY(-1px)}
.blib{background:linear-gradient(135deg,#7a00ff,#5000cc);color:#fff}
.blib:not(:disabled):hover{transform:translateY(-1px)}
.bmore{background:#090c1c;color:#253050;border:1px solid #101525}
.bmore:not(:disabled):hover{border-color:#1a2840;color:#4a6080}
.bghost{background:transparent;color:#253050;border:1px solid #101525}
.bghost:not(:disabled):hover{border-color:#1a2840;color:#4a6080}
.bsm{padding:0 12px;min-height:32px;font-size:12px;border-radius:8px}
.bdanger{background:rgba(255,60,100,.1);color:#ff3c64;border:1px solid rgba(255,60,100,.2)}
.bdanger:not(:disabled):hover{background:rgba(255,60,100,.18)}

/* alerts */
.al{display:flex;align-items:flex-start;gap:9px;padding:11px 15px;border-radius:10px;font-size:13px;margin-bottom:12px;line-height:1.5}
.ae{background:rgba(255,60,100,.06);border:1px solid rgba(255,60,100,.15);color:#ff6070}
.ao{background:rgba(0,224,255,.04);border:1px solid rgba(0,224,255,.12);color:#00b8d9}
.as{background:#090c1c;border:1px solid #101525;color:#253050}
.aw{background:rgba(255,165,0,.04);border:1px solid rgba(255,165,0,.12);color:#a07000}
.dot{width:7px;height:7px;border-radius:50%;background:#00e0ff;flex-shrink:0;margin-top:3px;animation:pu 1.6s infinite}
@keyframes pu{0%,100%{opacity:1}50%{opacity:.15}}

/* progress */
.prc{background:#090c1c;border:1px solid #101525;border-radius:12px;padding:15px 18px;margin-bottom:14px}
.prh{display:flex;justify-content:space-between;margin-bottom:8px}
.prt{font-size:13px;font-weight:600;color:#607090}
.prn{font-size:13px;color:#253050}
.ptr{height:4px;background:#0d1020;border-radius:99px;overflow:hidden;margin-bottom:5px}
.pf{height:100%;border-radius:99px;transition:width .35s}
.pf.dev{background:linear-gradient(90deg,#ff3c64,#ff7000)}
.pf.lib{background:linear-gradient(90deg,#7a00ff,#5000cc)}
.ps{font-size:11px;color:#14202e}

/* filters + toolbar */
.frow{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
.flab{font-size:10px;color:#18203a;font-weight:700;letter-spacing:1.5px;text-transform:uppercase}
.fb{padding:5px 12px;border-radius:99px;border:1px solid #0e1525;background:transparent;color:#202e42;font-family:'DM Sans',sans-serif;font-size:12px;cursor:pointer;transition:all .2s}
.fb:hover{border-color:#1a2840;color:#4a5e7e}
.fb.on{background:#0e1328;border-color:#00e0ff;color:#00b8d9}
.tbar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px}
.tbl{display:flex;align-items:center;gap:11px;flex-wrap:wrap}
.vcnt{font-family:'Bebas Neue',cursive;font-size:28px;letter-spacing:1px;color:#00e0ff;line-height:1}
.vlab{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#111c2e}

/* selection bar */
.selbar{background:#090c1c;border:1px solid #101525;border-radius:12px;padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}
.selL{display:flex;align-items:center;gap:10px}
.seln{font-family:'Bebas Neue',cursive;font-size:24px;letter-spacing:1px}
.seln.dev{color:#ff3c64}
.seln.lib{color:#a855f7}
.selh{font-size:12px;color:#18203a}
.selR{display:flex;gap:7px;flex-wrap:wrap}

/* grid */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(183px,1fr));gap:11px}
.card{background:#07091a;border:2px solid transparent;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;user-select:none;transition:border-color .15s,transform .15s,box-shadow .15s}
.card:hover{transform:translateY(-2px);border-color:#101525}
.card.sdv{border-color:#ff3c64!important;box-shadow:0 0 16px rgba(255,60,100,.14)}
.card.slib{border-color:#7a00ff!important;box-shadow:0 0 16px rgba(122,0,255,.14)}
.cth{position:relative;aspect-ratio:9/16;overflow:hidden;background:#0b0e20;flex-shrink:0;cursor:pointer}
.cth img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s}
.card:hover .cth img{transform:scale(1.04)}
.dur{position:absolute;bottom:7px;left:7px;background:rgba(0,0,0,.75);backdrop-filter:blur(5px);color:#fff;font-size:11px;font-weight:600;padding:2px 7px;border-radius:6px;pointer-events:none}
.ck{position:absolute;top:8px;right:8px;width:24px;height:24px;border-radius:50%;background:rgba(0,0,0,.6);border:2px solid #1a2238;display:flex;align-items:center;justify-content:center;transition:all .15s;pointer-events:none}
.card.sdv .ck{background:#ff3c64;border-color:#ff3c64}
.card.slib .ck{background:#7a00ff;border-color:#7a00ff}
.ct{font-size:12px;font-weight:800;color:#fff;opacity:0;transition:opacity .15s}
.card.sdv .ct,.card.slib .ct{opacity:1}
.sord{position:absolute;top:8px;left:8px;min-width:20px;height:20px;border-radius:99px;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 4px;pointer-events:none}
.card.sdv .sord{background:#ff3c64;color:#fff}
.card.slib .sord{background:#7a00ff;color:#fff}
.dbx-ov{position:absolute;bottom:7px;right:7px;font-size:10px;font-weight:600;padding:2px 7px;border-radius:5px;pointer-events:none;display:flex;align-items:center;gap:4px}
.dbx-ov.up{background:rgba(0,100,255,.25);color:#5599ff}
.dbx-ov.done{background:rgba(0,200,100,.2);color:#00c864}
.dbx-spin{width:7px;height:7px;border-radius:50%;border:2px solid #5599ff44;border-top-color:#5599ff;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.cbody{padding:9px 11px 4px;flex:1}
.cst{display:flex;gap:9px;font-size:11px;color:#18203a;margin-bottom:4px}
.cdesc{font-size:12px;color:#202e42;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.cfoot{padding:6px 10px 10px;display:flex;flex-direction:column;gap:5px}
.abtn{width:100%;min-height:32px;border-radius:8px;font-size:12px;font-weight:600;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .2s}
.abtn:disabled{opacity:.22;cursor:not-allowed}
.abtn.dev{background:linear-gradient(135deg,#ff3c64,#ff7000);color:#fff}
.abtn.dev:not(:disabled):hover{transform:translateY(-1px)}
.abtn.lib{background:rgba(122,0,255,.1);color:#a855f7;border:1px solid rgba(122,0,255,.2)}
.abtn.lib:not(:disabled):hover{background:rgba(122,0,255,.18)}
.saved{width:100%;min-height:27px;border-radius:7px;font-size:11px;font-weight:600;border:1px solid rgba(0,224,255,.14);background:rgba(0,224,255,.05);color:#00b8d9;display:flex;align-items:center;justify-content:center;gap:4px}
.lmw{display:flex;justify-content:center;margin-top:26px}

/* skeletons */
.sg{display:grid;grid-template-columns:repeat(auto-fill,minmax(183px,1fr));gap:11px}
.sk{background:#07091a;border-radius:14px;overflow:hidden}
.skt{aspect-ratio:9/16;background:linear-gradient(90deg,#07091a 25%,#0d1120 50%,#07091a 75%);background-size:200% 100%;animation:shim 1.4s infinite}
.skl{height:9px;margin:9px 11px 0;border-radius:4px;background:linear-gradient(90deg,#07091a 25%,#0d1120 50%,#07091a 75%);background-size:200% 100%;animation:shim 1.4s infinite}
.skl.s{width:55%;margin-bottom:10px}
@keyframes shim{0%{background-position:200% 0}100%{background-position:-200% 0}}

.emp{text-align:center;padding:80px 20px}
.eico{font-size:52px;margin-bottom:16px}
.etit{font-family:'Bebas Neue',cursive;font-size:34px;letter-spacing:2px;color:#0e1828;margin-bottom:6px}
.esub{font-size:13px;color:#111c2e}

/* library */
.lhdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px}
.ltit{font-family:'Bebas Neue',cursive;font-size:26px;letter-spacing:2px;color:#1e2e42}
.lstats{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px}
.lstat{background:#07091a;border:1px solid #0e1428;border-radius:10px;padding:11px 16px}
.lsn{font-family:'Bebas Neue',cursive;font-size:22px;color:#00e0ff}
.lsl{font-size:11px;color:#18203a}
.li{background:#07091a;border:1px solid #0e1428;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;transition:border-color .2s}
.li:hover{border-color:rgba(0,224,255,.14)}
.lth{position:relative;aspect-ratio:9/16;overflow:hidden;background:#0b0e20}
.lth img{width:100%;height:100%;object-fit:cover;display:block}
.la{position:absolute;top:7px;left:7px;font-size:10px;font-weight:600;padding:2px 6px;border-radius:5px}
.la.old{background:rgba(255,60,100,.7);color:#fff}
.la.ok{background:rgba(0,224,255,.15);color:#00e0ff}
.lbd{padding:9px 11px 11px;flex:1;display:flex;flex-direction:column;gap:5px}
.ldesc{font-size:12px;color:#1e2e42;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;flex:1}
.ldate{font-size:11px;color:#10182a}
.lrm{min-height:28px;border-radius:7px;border:none;background:rgba(255,60,100,.07);color:#ff3c64;font-size:11px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background .2s}
.lrm:hover{background:rgba(255,60,100,.14)}
.lemp{text-align:center;padding:55px 20px}
.lei{font-size:42px;margin-bottom:14px}
.let{font-size:13px;color:#0e1828;line-height:1.7}

/* ── KEY MANAGER ─────────────────────────────────────── */
.km{display:flex;flex-direction:column;gap:16px}
.km-intro{background:#090c1c;border:1px solid #101525;border-radius:14px;padding:18px 20px}
.km-intro-title{font-size:13px;font-weight:700;color:#3a5070;margin-bottom:8px}
.km-intro-text{font-size:12px;color:#16202e;line-height:1.7}
.km-intro-text a{color:#00b8d9;text-decoration:none}

.prov-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}

.prov-card{background:#090c1c;border:1px solid #101525;border-radius:14px;overflow:hidden;transition:border-color .2s}
.prov-card-head{padding:14px 16px 10px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #101525}
.prov-icon{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.prov-name{font-size:14px;font-weight:700;line-height:1}
.prov-desc{font-size:11px;color:#18203a;margin-top:2px}
.prov-help{font-size:11px;margin-top:3px}
.prov-help a{text-decoration:none}

.prov-keys{padding:10px 14px;display:flex;flex-direction:column;gap:7px;min-height:40px}
.prov-no-keys{font-size:12px;color:#141e2e;text-align:center;padding:8px 0}

.key-item{display:flex;align-items:center;gap:8px;background:#06090e;border:1px solid #0d1420;border-radius:9px;padding:8px 11px;transition:border-color .2s}
.key-item:hover{border-color:#1a2438}
.key-status{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.key-status.active{background:#00c878}
.key-status.quota{background:#ffa000}
.key-status.invalid{background:#ff3c64}
.key-status.unknown{background:#253050}
.key-status.testing{background:#7a00ff;animation:pu .8s infinite}
.key-info{flex:1;min-width:0}
.key-label{font-size:12px;font-weight:600;color:#3a5070}
.key-val{font-size:10px;color:#14202e;font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.key-msg{font-size:10px;margin-top:1px}
.key-msg.ok{color:#00c878}
.key-msg.warn{color:#ffa000}
.key-msg.err{color:#ff3c64}
.key-msg.info{color:#4a6080}
.key-actions{display:flex;gap:5px;flex-shrink:0}
.kbtn{padding:0 9px;min-height:26px;border:1px solid #0d1420;background:transparent;border-radius:6px;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:600;cursor:pointer;color:#253050;transition:all .2s;white-space:nowrap}
.kbtn:hover{border-color:#1a2438;color:#4a6080}
.kbtn.danger{color:#ff3c64;border-color:rgba(255,60,100,.2)}
.kbtn.danger:hover{background:rgba(255,60,100,.1)}
.kbtn:disabled{opacity:.3;cursor:not-allowed}

.prov-add{padding:10px 14px 14px;border-top:1px solid #0d1420}
.add-row{display:flex;gap:7px;flex-wrap:wrap}
.add-inp{flex:1 1 180px;background:#050810;border:1px solid #0d1420;border-radius:8px;padding:8px 12px;color:#d0daf0;font-family:monospace;font-size:12px;outline:none;transition:border-color .2s;min-height:36px}
.add-inp:focus{border-color:#00e0ff}
.add-inp::placeholder{color:#0d1420}
.add-btn{padding:0 14px;min-height:36px;border:none;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:600;cursor:pointer;color:#fff;transition:all .2s;white-space:nowrap}
.add-btn:disabled{opacity:.3;cursor:not-allowed}

.km-dbx{margin-top:4px}

@media(max-width:540px){
  .grid,.sg{grid-template-columns:repeat(2,1fr);gap:8px}
  .sr{flex-direction:column}
  .inp{flex:1 1 100%}
  .btn{width:100%}
  .sc{padding:14px}
  .selR{width:100%}
  .selR .btn{flex:1}
  .prov-grid{grid-template-columns:1fr}
}
`

/* ══════════════════════════════════════════════════════ */
export default function App() {
  /* ── tab / mode ─────────────────────────────────────── */
  const [tab,  setTab]  = useState<Tab>('search')
  const [mode, setMode] = useState<Mode>('device')

  /* ── search state ───────────────────────────────────── */
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
  const [dbxUp,    setDbxUp]    = useState<Set<string>>(new Set())
  const [dbxDone,  setDbxDone]  = useState<Set<string>>(new Set())

  /* ── keys state ─────────────────────────────────────── */
  const [keys, setKeys] = useState<ApiKey[]>(() => loadKeys())
  const [testingId, setTestingId] = useState<string|null>(null)
  const [newVals, setNewVals] = useState<Partial<Record<Provider,string>>>({})
  const [newLabels, setNewLabels] = useState<Partial<Record<Provider,string>>>({})

  useEffect(() => { saveKeys(keys) }, [keys])

  /* ── selection ref ───────────────────────────────────── */
  const selRef = useRef<string[]>([])
  const [, rSel] = useState(0)
  const getSel    = () => selRef.current
  const toggleSel = (id:string) => { const c=selRef.current; selRef.current=c.includes(id)?c.filter(x=>x!==id):[...c,id]; rSel(n=>n+1) }
  const selAll    = (vs:Video[]) => { selRef.current=vs.map(v=>String(v.id)); rSel(n=>n+1) }
  const clrSel    = () => { selRef.current=[]; rSel(n=>n+1) }

  /* ── library ref ─────────────────────────────────────── */
  const libRef = useRef<LibItem[]>(lsRead())
  const [, rLib] = useState(0)
  const getLib    = () => libRef.current
  const saveLib   = (items:LibItem[]) => { libRef.current=items; lsWrite(items); rLib(n=>n+1) }
  const addToLib  = (vs:Video[]) => {
    const ex=new Set(libRef.current.map(x=>x.id)); const now=Date.now(); const fr:LibItem[]=[]
    for(const v of vs){ const id=String(v.id); if(!ex.has(id)){ ex.add(id); fr.push({id,cover:v.cover||v.origin_cover,title:v.title||'بدون عنوان',savedAt:now}) } }
    if(fr.length) saveLib([...fr,...libRef.current])
  }
  const rmLib     = (id:string) => saveLib(libRef.current.filter(x=>x.id!==id))
  const isInLib   = (id:string) => libRef.current.some(x=>x.id===id)

  /* ── API call ────────────────────────────────────────── */
  const callFetch = async (params: Record<string,string>) => {
    const qs = new URLSearchParams(params)
    const r = await fetch(`/api/fetch?${qs}`, {
      headers: { 'X-Keys': buildKeysHeader(keys) },
      signal: AbortSignal.timeout(30000),
    })
    const d = await r.json()
    if (!d.ok) throw new Error(d.error || 'فشل جلب البيانات')
    return d
  }

  const fetchProfile = async (username:string, cur='0') => {
    const d = await callFetch({ action:'profile', username, cursor:cur })
    const all:Video[] = d.videos || []
    const filtered = all.filter(v=>!v.duration||v.duration<=MAX_DUR)
    return { filtered, skipped:all.length-filtered.length, nextCursor:d.cursor||null, hasMore:!!d.hasMore }
  }

  const searchProfile = async (username:string) => {
    setLoading(true); setError(''); setVideos([]); setSkipped(0)
    clrSel(); setCursor(null); setHasMore(false); setCurUser(username)
    setStatus(`جاري جلب فيديوهات @${username}...`)
    try {
      const pg = await fetchProfile(username)
      if(!pg.filtered.length) throw new Error('لا توجد فيديوهات مطابقة.')
      setVideos(pg.filtered); setSkipped(pg.skipped)
      setCursor(pg.nextCursor); setHasMore(pg.hasMore)
      setStatus(`تم جلب ${pg.filtered.length} فيديو من @${username}${pg.hasMore?' · اضغط «المزيد»':''}`)
    } catch(e:any){ setError(e.message); setStatus('') }
    finally{ setLoading(false) }
  }

  const loadMore = async () => {
    if(!curUser||!cursor||moreLoad) return
    setMoreLoad(true)
    try {
      const pg = await fetchProfile(curUser, cursor)
      setVideos(prev=>{ const ids=new Set(prev.map(v=>String(v.id))); return [...prev,...pg.filtered.filter(v=>!ids.has(String(v.id)))] })
      setSkipped(s=>s+pg.skipped); setCursor(pg.nextCursor); setHasMore(pg.hasMore)
    } catch(e:any){ setError(e.message) }
    finally{ setMoreLoad(false) }
  }

  const searchVideo = async (vUrl:string) => {
    setLoading(true); setError(''); setStatus('جاري جلب الفيديو...')
    try {
      const d = await callFetch({ action:'video', video_url:vUrl })
      const v:Video = d.videos?.[0]
      if(!v?.id) throw new Error('تعذّر جلب الفيديو.')
      if(v.duration>MAX_DUR) throw new Error(`هذا الفيديو أطول من ${Math.floor(MAX_DUR/60)} دقائق.`)
      setVideos([v]); setHasMore(false); setStatus('تم جلب الفيديو!')
    } catch(e:any){ setError(e.message); setStatus('') }
    finally{ setLoading(false) }
  }

  const handleSearch = () => {
    const v=urlInput.trim(); if(!v) return; setError('')
    if(isVidLink(v)) searchVideo(v)
    else{ const u=parseHandle(v); if(!u){setError('أدخل رابط بروفايل صحيح: @username');return} searchProfile(u) }
  }

  /* ── sort ────────────────────────────────────────────── */
  const sorted=[...videos].sort((a,b)=>{
    if(sort==='views')    return b.play_count-a.play_count
    if(sort==='likes')    return b.digg_count-a.digg_count
    if(sort==='shortest') return a.duration-b.duration
    if(sort==='longest')  return b.duration-a.duration
    return 0
  })

  /* ── Dropbox ─────────────────────────────────────────── */
  const triggerDbx = (video:Video) => {
    const dbxToken = getDropboxToken(keys)
    if(!dbxToken) return
    const id=String(video.id); const dlUrl=video.play||video.wmplay; if(!dlUrl) return
    setDbxUp(p=>new Set(p).add(id))
    fetch('/api/dropbox',{
      method:'POST',
      headers:{ 'X-Video-Url':encodeURIComponent(dlUrl), 'X-File-Name':`tiktok_${id}.mp4`, 'X-Dbx-Token':dbxToken },
    }).then(r=>r.json()).then(d=>{
      if(d.success){ setDbxDone(p=>new Set(p).add(id)) }
    }).catch(()=>{}).finally(()=>{ setDbxUp(p=>{const s=new Set(p);s.delete(id);return s}) })
  }

  /* ── download ────────────────────────────────────────── */
  const dlOne = async (v:Video) => {
    const id=String(v.id); setDlId(id); setError('')
    if(mode==='library'){ addToLib([v]); triggerDbx(v); setDlId(null); return }
    try {
      const r=await fetch(`/api/download?url=${encodeURIComponent(v.play||v.wmplay)}`,{signal:AbortSignal.timeout(60000)})
      if(!r.ok) throw new Error(`HTTP ${r.status}`)
      const blob=await r.blob()
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`tiktok_${id}.mp4`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href)
      addToLib([v]); triggerDbx(v)
    } catch(e:any){ setError('فشل التحميل: '+e.message) }
    setDlId(null)
  }

  const bulkAction = async (currentSel:string[], currentMode:Mode) => {
    if(!currentSel.length) return
    const vMap=new Map(videos.map(v=>[String(v.id),v]))
    const toProcess=currentSel.map(id=>vMap.get(id)).filter(Boolean) as Video[]
    if(!toProcess.length) return
    setBusy(true); setBDone(0); setBTotal(toProcess.length); setError('')
    if(currentMode==='library'){
      setBLabel('جاري الحفظ في المكتبة...')
      addToLib(toProcess); toProcess.forEach(v=>triggerDbx(v))
      setBDone(toProcess.length)
      await new Promise(r=>setTimeout(r,300))
      setBusy(false); setBLabel('')
      setStatus(`✅ تم حفظ ${toProcess.length} فيديو!`); clrSel(); return
    }
    let failed=0
    for(let i=0;i<toProcess.length;i++){
      setBLabel(`فيديو ${i+1} من ${toProcess.length}`)
      const v=toProcess[i]
      try{
        const r=await fetch(`/api/download?url=${encodeURIComponent(v.play||v.wmplay)}`,{signal:AbortSignal.timeout(60000)})
        if(!r.ok) throw new Error(`HTTP ${r.status}`)
        const blob=await r.blob(); const a=document.createElement('a')
        a.href=URL.createObjectURL(blob); a.download=`tiktok_${v.id}.mp4`
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href)
        addToLib([v]); triggerDbx(v)
      }catch{ failed++ }
      setBDone(i+1)
      await new Promise(r=>setTimeout(r,800))
    }
    setBusy(false); setBLabel('')
    setStatus(`✅ تم تحميل ${toProcess.length-failed} فيديو!${failed>0?` (فشل ${failed})`:''}`); clrSel()
  }

  /* ── key manager actions ─────────────────────────────── */
  const doAddKey = (provider:Provider) => {
    const val=(newVals[provider]||'').trim()
    if(!val) return
    const label=(newLabels[provider]||'').trim()
    const updated=addKey(keys, provider, label, val)
    setKeys(updated)
    setNewVals(p=>({...p,[provider]:''}))
    setNewLabels(p=>({...p,[provider]:''}))
  }

  const doTestKey = async (k:ApiKey) => {
    setTestingId(k.id)
    setKeys(prev=>prev.map(x=>x.id===k.id?{...x,status:'testing' as KeyStatus,message:'جاري الاختبار...'}:x))
    try{
      const r=await fetch('/api/test-key',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({provider:k.provider, key:k.value}),
        signal:AbortSignal.timeout(12000),
      })
      const d=await r.json()
      setKeys(prev=>prev.map(x=>x.id===k.id?{...x,status:d.status||'unknown',message:d.message||''}:x))
    }catch(e:any){
      setKeys(prev=>prev.map(x=>x.id===k.id?{...x,status:'unknown',message:'تعذّر الاتصال'}:x))
    }
    setTestingId(null)
  }

  const doRemoveKey = (id:string) => { setKeys(removeKey(keys,id)) }

  /* ── derived ─────────────────────────────────────────── */
  const bPct     = bTotal>0?Math.round((bDone/bTotal)*100):0
  const sel      = getSel()
  const lib      = getLib()
  const selLen   = sel.length
  const expiring = lib.filter(x=>daysAgo(x.savedAt)>=25).length
  const hasDbx   = keys.some(k=>k.provider==='dropbox'&&k.status!=='invalid')
  const tikTokKeysCount = keys.filter(k=>k.provider!=='dropbox'&&k.status!=='invalid').length

  const SORTS:{k:Sort;l:string}[]=[
    {k:'default',l:'الافتراضي'},{k:'views',l:'▶ مشاهدات'},
    {k:'likes',l:'❤ لايكات'},{k:'shortest',l:'⏱ الأقصر'},{k:'longest',l:'⏱ الأطول'},
  ]

  const providers:Provider[] = ['rapidapi','apify','scraperapi','dropbox']

  /* ══════════════════════════════════════════════════════ */
  return (
    <>
      <style>{CSS}</style>
      <div style={{minHeight:'100vh',background:'#050810'}}>
        <div className="blob b1"/><div className="blob b2"/>
        <div className="pg">

          {/* HEADER */}
          <div className="hdr">
            <div className="logo">TIKLOAD</div>
            <div className="logo-sub">تحميل فيديوهات تيك توك · بدون علامة مائية</div>
            <div className="status-pills">
              <span className={`pill ${tikTokKeysCount>0?'on':'neutral'}`}>
                <span className="pill-dot"/>
                {tikTokKeysCount>0?`${tikTokKeysCount} مفتاح TikTok`:'tikwm مجاني (fallback)'}
              </span>
              <span className={`pill ${hasDbx?'on':'off'}`}>
                <span className="pill-dot"/>
                {hasDbx?'☁️ Dropbox متصل':'☁️ Dropbox غير متصل'}
              </span>
            </div>
          </div>

          {/* TABS */}
          <div className="tabs">
            <button className={`tab${tab==='search'?' on':''}`} onClick={()=>setTab('search')}>🔍 البحث</button>
            <button className={`tab${tab==='library'?' on':''}`} onClick={()=>setTab('library')}>
              {lib.length>0&&<span className="tbadge">{lib.length}</span>}
              📁 مكتبتي
            </button>
            <button className={`tab${tab==='keys'?' on':''}`} onClick={()=>setTab('keys')}>
              {keys.length>0&&<span className="tbadge" style={{background:'#7a00ff'}}>{keys.length}</span>}
              🔑 المفاتيح
            </button>
          </div>

          {/* ══ SEARCH ══ */}
          {tab==='search'&&<>
            <div className="mbar">
              <span className="mlab">وضع التحميل:</span>
              <div className="mopts">
                <button className={`mopt${mode==='device'?' on-dev':''}`} onClick={()=>setMode('device')}>💾 على الجهاز</button>
                <button className={`mopt${mode==='library'?' on-lib':''}`} onClick={()=>setMode('library')}>📁 مكتبة فقط</button>
              </div>
              {hasDbx&&<div className="mbar-note">☁️ يُرفع تلقائياً على Dropbox /videos بعد كل تحميل</div>}
            </div>

            <div className="sc">
              <label className="fl">رابط البروفايل أو الفيديو</label>
              <div className="sr">
                <input className="inp" dir="ltr"
                  placeholder="tiktok.com/@username  أو رابط فيديو مباشر"
                  value={urlInput} onChange={e=>setUrlInput(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&handleSearch()}/>
                <button className="btn bfetch" onClick={handleSearch} disabled={loading||!urlInput.trim()}>
                  {loading?'جاري الجلب...':'جلب الفيديوهات'}
                </button>
              </div>
              <div className="chips">
                {['@mrbeast','@khaby.lame','@charlidamelio'].map(ex=>(
                  <span key={ex} className="chip" onClick={()=>setUrlInput(ex)}>{ex}</span>
                ))}
              </div>
            </div>

            {error&&<div className="al ae">⚠ {error}</div>}
            {status&&!error&&<div className="al as"><div className="dot"/>{status}</div>}
            {skipped>0&&<div className="al aw">ℹ تم تخطي {skipped} فيديو أطول من 5 دقائق</div>}

            {busy&&(
              <div className="prc">
                <div className="prh">
                  <span className="prt">{mode==='library'?'📁 جاري الحفظ...':'⬇ جاري التحميل...'} {bLabel}</span>
                  <span className="prn">{bDone}/{bTotal}</span>
                </div>
                <div className="ptr"><div className={`pf ${mode}`} style={{width:`${bPct}%`}}/></div>
                <div className="ps">{bPct}%{hasDbx?' · ☁️ يُرفع على Dropbox':''}</div>
              </div>
            )}

            {loading&&<div className="sg">{Array.from({length:8}).map((_,i)=>(
              <div className="sk" key={i}><div className="skt"/><div className="skl"/><div className="skl s"/></div>
            ))}</div>}

            {!loading&&videos.length>0&&<>
              <div className="frow">
                <span className="flab">ترتيب:</span>
                {SORTS.map(s=><button key={s.k} className={`fb${sort===s.k?' on':''}`} onClick={()=>setSort(s.k)}>{s.l}</button>)}
              </div>
              <div className="tbar">
                <div className="tbl">
                  <div><div className="vcnt">{videos.length}</div><div className="vlab">فيديو</div></div>
                  <button className="btn bghost bsm" onClick={()=>selAll(videos)} disabled={busy}>تحديد الكل</button>
                  {selLen>0&&<button className="btn bghost bsm" onClick={clrSel} disabled={busy}>✕ إلغاء</button>}
                </div>
              </div>
              {selLen>0&&(
                <div className="selbar">
                  <div className="selL">
                    <div>
                      <div className={`seln ${mode}`}>{selLen}</div>
                      <div className="selh">فيديو محدد — اضغط الصورة للتحديد</div>
                    </div>
                  </div>
                  <div className="selR">
                    {mode==='device'
                      ?<button className="btn bdl bsm" onClick={()=>bulkAction([...sel],mode)} disabled={busy}>
                          {busy?`⬇ ${bPct}%`:`⬇ تحميل ${selLen}`}
                        </button>
                      :<button className="btn blib bsm" onClick={()=>bulkAction([...sel],mode)} disabled={busy}>
                          {busy?`📁 ${bPct}%`:`📁 حفظ ${selLen}`}
                        </button>
                    }
                  </div>
                </div>
              )}
              <div className="grid">
                {sorted.map(v=>{
                  const id=String(v.id); const idx=sel.indexOf(id); const isSel=idx!==-1
                  const isDl=dlId===id; const inLib=isInLib(id)
                  const isUp=dbxUp.has(id); const isDone=dbxDone.has(id)
                  return(
                    <div key={id} className={`card${isSel?(mode==='library'?' slib':' sdv'):''}`}>
                      <div className="cth" onClick={()=>{ if(!busy&&!isDl) toggleSel(id) }}>
                        <img src={v.cover||v.origin_cover} alt="" loading="lazy"
                          onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
                        {v.duration>0&&<div className="dur">{sec2str(v.duration)}</div>}
                        <div className="ck"><span className="ct">✓</span></div>
                        {isSel&&<div className="sord">{idx+1}</div>}
                        {isUp&&<div className="dbx-ov up"><div className="dbx-spin"/>Dropbox</div>}
                        {isDone&&!isUp&&<div className="dbx-ov done">☁️ تم</div>}
                      </div>
                      <div className="cbody">
                        <div className="cst"><span>❤ {n2s(v.digg_count)}</span><span>▶ {n2s(v.play_count)}</span></div>
                        <div className="cdesc">{v.title||'بدون عنوان'}</div>
                      </div>
                      <div className="cfoot">
                        {mode==='device'?(
                          inLib?<div className="saved">✓ تم التحميل</div>
                          :<button className="abtn dev" onClick={()=>dlOne(v)} disabled={isDl||busy}>
                              {isDl?'⏳ جاري...':'⬇ تحميل'}
                            </button>
                        ):(
                          inLib?<div className="saved">✓ في المكتبة</div>
                          :<button className="abtn lib" onClick={()=>dlOne(v)} disabled={isDl||busy}>
                              {isDl?'⏳...':'📁 حفظ'}
                            </button>
                        )}
                        {mode==='device'&&!inLib&&(
                          <button className="abtn lib" onClick={()=>{addToLib([v]);triggerDbx(v)}} disabled={busy}>📁 حفظ فقط</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              {hasMore&&<div className="lmw"><button className="btn bmore" onClick={loadMore} disabled={moreLoad}>{moreLoad?'جاري...':'⬇ تحميل المزيد'}</button></div>}
            </>}

            {!loading&&videos.length===0&&!error&&(
              <div className="emp">
                <div className="eico">🎬</div>
                <div className="etit">ابدأ من هنا</div>
                <div className="esub">أدخل رابط بروفايل تيك توك أو فيديو مباشر</div>
              </div>
            )}
          </>}

          {/* ══ LIBRARY ══ */}
          {tab==='library'&&<>
            {expiring>0&&<div className="al aw">⚠ {expiring} فيديو ستُحذف تلقائياً قريباً</div>}
            <div className="lhdr">
              <div className="ltit">📁 مكتبتي ({lib.length})</div>
              {lib.length>0&&<button className="btn bdanger bsm" onClick={()=>{if(confirm('مسح كل المكتبة؟'))saveLib([])}}>🗑 مسح الكل</button>}
            </div>
            {lib.length>0&&<div className="lstats">
              <div className="lstat"><div className="lsn">{lib.length}</div><div className="lsl">محفوظ</div></div>
              <div className="lstat"><div className="lsn">{lib.filter(x=>daysAgo(x.savedAt)<7).length}</div><div className="lsl">هذا الأسبوع</div></div>
              <div className="lstat"><div className="lsn">{expiring}</div><div className="lsl">تنتهي قريباً</div></div>
            </div>}
            {lib.length===0
              ?<div className="lemp"><div className="lei">📭</div><div className="let">لم تحفظ أي فيديو بعد.</div></div>
              :<div className="grid">
                {lib.map(item=>{
                  const d=daysAgo(item.savedAt)
                  return(
                    <div key={item.id} className="li">
                      <div className="lth">
                        <img src={item.cover} alt="" loading="lazy" onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
                        <div className={`la ${d>=25?'old':'ok'}`}>{d===0?'اليوم':`${d} يوم`}</div>
                      </div>
                      <div className="lbd">
                        <div className="ldesc">{item.title}</div>
                        <div className="ldate">📅 منذ {d} يوم</div>
                        <button className="lrm" onClick={()=>rmLib(item.id)}>✕ إزالة</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            }
          </>}

          {/* ══ KEYS ══ */}
          {tab==='keys'&&(
            <div className="km">
              <div className="km-intro">
                <div className="km-intro-title">🔑 إدارة مفاتيح API</div>
                <div className="km-intro-text">
                  أضف مفاتيح من أي مزود — الموقع يجربهم بالترتيب تلقائياً وينتقل للتالي لو فشل أي مفتاح.
                  tikwm.com يعمل مجاناً بدون مفتاح كـ fallback نهائي.
                </div>
              </div>

              <div className="prov-grid">
                {providers.map(provider=>{
                  const info = PROVIDER_INFO[provider]
                  const provKeys = keys.filter(k=>k.provider===provider)
                  const val = newVals[provider]||''
                  const lbl = newLabels[provider]||''
                  const maxReached = provKeys.length>=3

                  return(
                    <div key={provider} className="prov-card" style={{borderColor:info.border}}>
                      {/* head */}
                      <div className="prov-card-head">
                        <div className="prov-icon" style={{background:info.glow}}>{info.icon}</div>
                        <div style={{flex:1}}>
                          <div className="prov-name" style={{color:info.color}}>{info.label}</div>
                          <div className="prov-desc">{info.helpText}</div>
                          <div className="prov-help">
                            <a href={info.helpUrl} target="_blank" rel="noopener noreferrer" style={{color:info.color,opacity:.7,fontSize:'11px'}}>
                              احصل على مفتاح ↗
                            </a>
                          </div>
                        </div>
                        <div style={{fontSize:'12px',color:'#253050'}}>{provKeys.length}/3</div>
                      </div>

                      {/* existing keys */}
                      <div className="prov-keys">
                        {provKeys.length===0&&<div className="prov-no-keys">لا توجد مفاتيح — أضف واحداً أدناه</div>}
                        {provKeys.map((k,i)=>{
                          const msgClass = k.status==='active'?'ok':k.status==='quota'||k.status==='unknown'?'warn':'err'
                          return(
                            <div key={k.id} className={`key-item`}>
                              <div className={`key-status ${k.status}`}/>
                              <div style={{fontSize:'11px',color:'#253050',flexShrink:0,minWidth:'16px'}}>#{i+1}</div>
                              <div className="key-info">
                                <div className="key-label">{k.label}</div>
                                <div className="key-val">{k.value.slice(0,8)}{'•'.repeat(12)}</div>
                                {k.message&&<div className={`key-msg ${msgClass}`}>{k.message}</div>}
                              </div>
                              <div className="key-actions">
                                <button className="kbtn" disabled={testingId===k.id}
                                  onClick={()=>doTestKey(k)}>
                                  {testingId===k.id?'⏳':'اختبار'}
                                </button>
                                <button className="kbtn danger" onClick={()=>doRemoveKey(k.id)}>✕</button>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* add new key */}
                      {!maxReached&&(
                        <div className="prov-add">
                          <div className="add-row">
                            <input className="add-inp" placeholder={info.placeholder}
                              value={val} onChange={e=>setNewVals(p=>({...p,[provider]:e.target.value}))}
                              onKeyDown={e=>e.key==='Enter'&&doAddKey(provider)}
                              type="password" autoComplete="off"/>
                            <button className="add-btn"
                              style={{background:`linear-gradient(135deg,${info.color},${info.color}99)`}}
                              disabled={!val.trim()} onClick={()=>doAddKey(provider)}>
                              + إضافة
                            </button>
                          </div>
                          <input className="add-inp" placeholder="اسم مخصص (اختياري)"
                            style={{marginTop:'6px',fontFamily:'inherit',fontSize:'12px'}}
                            value={lbl} onChange={e=>setNewLabels(p=>({...p,[provider]:e.target.value}))}/>
                        </div>
                      )}
                      {maxReached&&(
                        <div style={{padding:'10px 14px',fontSize:'12px',color:'#253050',borderTop:'1px solid #0d1420'}}>
                          ✓ وصلت للحد الأقصى (3 مفاتيح)
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* test all button */}
              {keys.length>0&&(
                <div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}>
                  <button className="btn bfetch bsm" style={{minHeight:'38px'}}
                    onClick={()=>keys.forEach(k=>doTestKey(k))}
                    disabled={testingId!==null}>
                    🔄 اختبار كل المفاتيح
                  </button>
                  <button className="btn bdanger bsm" style={{minHeight:'38px'}}
                    onClick={()=>{ if(confirm('حذف كل المفاتيح؟')) setKeys([]) }}>
                    🗑 حذف الكل
                  </button>
                </div>
              )}

              {/* provider order note */}
              <div className="al as" style={{marginBottom:0}}>
                ℹ ترتيب المحاولة: <strong>RapidAPI</strong> ← <strong>Apify</strong> ← <strong>ScraperAPI</strong> ← <strong>tikwm مجاني</strong>
                <br/>لو مفتاح فشل أو انتهت حصته ينتقل للتالي تلقائياً.
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
