import { useState, useRef, useEffect } from 'react'
import {
  ApiKey, Provider, KeyStatus, loadKeys, saveKeys,
  addKey, removeKey, buildKeysHeader,
  getDropboxToken, PROVIDER_INFO
} from './keys'

/* ── constants ───────────────────────────────────────── */
const MAX_DUR  = 5 * 60
const LIB_KEY  = 'tikload_lib_v3'
const MONTH_MS = 30 * 24 * 60 * 60 * 1000

/* ── types ───────────────────────────────────────────── */
type Video   = { id:string; cover:string; origin_cover:string; title:string; duration:number; play:string; wmplay:string; digg_count:number; play_count:number }
type LibItem = { id:string; cover:string; title:string; savedAt:number }
type Sort    = 'default'|'views'|'likes'|'shortest'|'longest'
type Mode    = 'device'|'dropbox'|'library'
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

/* ══════════════════════════════════════════════════════ */
/* CSS                                                     */
/* ══════════════════════════════════════════════════════ */
const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Cairo:wght@400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#0d0d14;color:#e8eaf6;font-family:'Cairo',sans-serif;min-height:100vh;-webkit-font-smoothing:antialiased;font-size:15px}

.blob{position:fixed;border-radius:50%;pointer-events:none;z-index:0}
.b1{width:800px;height:800px;background:radial-gradient(circle,rgba(99,102,241,.07),transparent 60%);top:-300px;left:-300px}
.b2{width:600px;height:600px;background:radial-gradient(circle,rgba(236,72,153,.05),transparent 60%);bottom:-200px;right:-200px}

.pg{max-width:1240px;margin:0 auto;padding:48px 24px 100px;position:relative;z-index:1}

/* header */
.hdr{text-align:center;margin-bottom:44px}
.logo{font-family:'Bebas Neue',cursive;font-size:clamp(64px,10vw,108px);letter-spacing:8px;line-height:1;background:linear-gradient(135deg,#a5b4fc 0%,#818cf8 40%,#ec4899 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.logo-sub{font-size:14px;letter-spacing:2px;color:#4b5680;margin-top:8px;font-weight:500}
.status-pills{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:14px}
.pill{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:99px;font-size:13px;font-weight:600;border:1px solid}
.pill-dot{width:7px;height:7px;border-radius:50%;background:currentColor}
.pill.on{background:rgba(34,197,94,.08);border-color:rgba(34,197,94,.25);color:#22c55e}
.pill.off{background:rgba(239,68,68,.06);border-color:rgba(239,68,68,.18);color:#f87171}
.pill.neutral{background:rgba(99,102,241,.06);border-color:rgba(99,102,241,.18);color:#818cf8}

/* tabs */
.tabs{display:flex;gap:3px;margin-bottom:24px;background:#131320;border:1px solid #1e1e35;border-radius:14px;padding:4px;width:fit-content}
.tab{padding:10px 22px;border-radius:10px;border:none;font-family:'Cairo',sans-serif;font-size:14px;font-weight:700;cursor:pointer;transition:all .2s;background:transparent;color:#3a3f60;display:flex;align-items:center;gap:7px}
.tab.on{background:#1c1c34;color:#e8eaf6;box-shadow:0 2px 8px rgba(0,0,0,.3)}
.tbadge{min-width:18px;height:18px;border-radius:99px;background:#818cf8;color:#fff;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;padding:0 5px}

/* mode bar */
.mbar{display:flex;align-items:center;gap:12px;background:#131320;border:1px solid #1e1e35;border-radius:14px;padding:14px 20px;margin-bottom:16px;flex-wrap:wrap}
.mlab{font-size:12px;font-weight:700;letter-spacing:1px;color:#2a3050}
.mopts{display:flex;gap:6px;flex-wrap:wrap}
.mopt{padding:8px 16px;border-radius:10px;border:1px solid #1e1e35;background:transparent;font-family:'Cairo',sans-serif;font-size:14px;font-weight:600;color:#3a3f60;cursor:pointer;transition:all .2s}
.mopt:hover{border-color:#2e2e55;color:#6b7280}
.mopt.on-dev{background:rgba(239,68,68,.08);border-color:#ef4444;color:#f87171}
.mopt.on-dbx{background:rgba(59,130,246,.08);border-color:#3b82f6;color:#60a5fa}
.mopt.on-lib{background:rgba(139,92,246,.08);border-color:#8b5cf6;color:#a78bfa}
.mbar-note{font-size:13px;color:#2a3050;width:100%;margin-top:4px;font-weight:500}

/* search card */
.sc{background:#131320;border:1px solid #1e1e35;border-radius:16px;padding:24px 28px;margin-bottom:16px;transition:border-color .25s}
.sc:focus-within{border-color:#818cf8}
.fl{display:block;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#2a3050;margin-bottom:12px}
.sr{display:flex;gap:10px;align-items:stretch;flex-wrap:wrap}
.inp{flex:1 1 260px;background:#0d0d14;border:1px solid #1e1e35;border-radius:11px;padding:12px 18px;color:#e8eaf6;font-family:'Cairo',sans-serif;font-size:15px;font-weight:500;outline:none;transition:border-color .2s;min-height:48px}
.inp:focus{border-color:#818cf8}
.inp::placeholder{color:#1e2040}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.chip{font-size:13px;font-weight:600;padding:5px 14px;background:#0d0d14;border:1px solid #1a1a30;border-radius:99px;color:#2a3060;cursor:pointer;transition:all .2s}
.chip:hover{border-color:#2e2e55;color:#6b7280}

/* buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:0 22px;min-height:48px;border:none;border-radius:12px;font-family:'Cairo',sans-serif;font-size:14px;font-weight:700;cursor:pointer;transition:all .2s;white-space:nowrap}
.btn:disabled{opacity:.22;cursor:not-allowed!important;transform:none!important;box-shadow:none!important}
.bfetch{background:linear-gradient(135deg,#6366f1,#818cf8);color:#fff}
.bfetch:not(:disabled):hover{transform:translateY(-1px);box-shadow:0 6px 24px rgba(99,102,241,.4)}
.bdl{background:linear-gradient(135deg,#ef4444,#f97316);color:#fff}
.bdl:not(:disabled):hover{transform:translateY(-1px);box-shadow:0 6px 24px rgba(239,68,68,.35)}
.bdbx{background:linear-gradient(135deg,#3b82f6,#06b6d4);color:#fff}
.bdbx:not(:disabled):hover{transform:translateY(-1px);box-shadow:0 6px 24px rgba(59,130,246,.35)}
.blib{background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff}
.blib:not(:disabled):hover{transform:translateY(-1px);box-shadow:0 6px 24px rgba(139,92,246,.35)}
.bmore{background:#131320;color:#4b5680;border:1px solid #1e1e35;font-size:14px}
.bmore:not(:disabled):hover{border-color:#2e2e55;color:#818cf8}
.bghost{background:transparent;color:#4b5680;border:1px solid #1e1e35}
.bghost:not(:disabled):hover{border-color:#2e2e55;color:#818cf8}
.bsm{padding:0 14px;min-height:36px;font-size:13px;border-radius:9px}
.bdanger{background:rgba(239,68,68,.1);color:#f87171;border:1px solid rgba(239,68,68,.25)}
.bdanger:not(:disabled):hover{background:rgba(239,68,68,.18)}

/* alerts */
.al{display:flex;align-items:flex-start;gap:10px;padding:13px 18px;border-radius:12px;font-size:14px;font-weight:500;margin-bottom:14px;line-height:1.6}
.ae{background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.2);color:#fca5a5}
.ao{background:rgba(99,102,241,.06);border:1px solid rgba(99,102,241,.18);color:#a5b4fc}
.as{background:#131320;border:1px solid #1e1e35;color:#4b5680}
.aw{background:rgba(234,179,8,.05);border:1px solid rgba(234,179,8,.18);color:#fbbf24}
.ag{background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.18);color:#4ade80}
.dot{width:8px;height:8px;border-radius:50%;background:#818cf8;flex-shrink:0;margin-top:4px;animation:pu 1.6s infinite}
@keyframes pu{0%,100%{opacity:1}50%{opacity:.15}}

/* progress */
.prc{background:#131320;border:1px solid #1e1e35;border-radius:14px;padding:18px 22px;margin-bottom:16px}
.prh{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.prt{font-size:14px;font-weight:700;color:#6b7280}
.prn{font-size:14px;font-weight:700;color:#4b5680}
.ptr{height:6px;background:#0d0d14;border-radius:99px;overflow:hidden;margin-bottom:6px}
.pf{height:100%;border-radius:99px;transition:width .4s}
.pf.dev{background:linear-gradient(90deg,#ef4444,#f97316)}
.pf.dbx{background:linear-gradient(90deg,#3b82f6,#06b6d4)}
.pf.lib{background:linear-gradient(90deg,#8b5cf6,#ec4899)}
.ps{font-size:13px;color:#2a3050;font-weight:500}

/* filters + toolbar */
.frow{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:16px}
.flab{font-size:12px;color:#2a3050;font-weight:700;letter-spacing:1px;text-transform:uppercase}
.fb{padding:6px 14px;border-radius:99px;border:1px solid #1a1a30;background:transparent;color:#2e3855;font-family:'Cairo',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s}
.fb:hover{border-color:#2e2e55;color:#6b7280}
.fb.on{background:#1c1c34;border-color:#818cf8;color:#a5b4fc}
.tbar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px}
.tbl{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.vcnt{font-family:'Bebas Neue',cursive;font-size:34px;letter-spacing:2px;color:#818cf8;line-height:1}
.vlab{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#1e2040}

/* selection bar */
.selbar{background:#131320;border:1px solid #1e1e35;border-radius:14px;padding:14px 20px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
.selL{display:flex;align-items:center;gap:12px}
.seln{font-family:'Bebas Neue',cursive;font-size:28px;letter-spacing:2px}
.seln.dev{color:#f87171}
.seln.dbx{color:#60a5fa}
.seln.lib{color:#a78bfa}
.selh{font-size:13px;font-weight:600;color:#2a3050}
.selR{display:flex;gap:8px;flex-wrap:wrap}

/* grid */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(185px,1fr));gap:14px}

/* card */
.card{background:#111120;border:2px solid #1a1a30;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;user-select:none;transition:border-color .2s,transform .15s,box-shadow .15s}
.card:hover{transform:translateY(-3px);border-color:#2e2e55;box-shadow:0 8px 24px rgba(0,0,0,.3)}
.card.sdv{border-color:#ef4444!important;box-shadow:0 0 20px rgba(239,68,68,.18)!important}
.card.sdbx{border-color:#3b82f6!important;box-shadow:0 0 20px rgba(59,130,246,.18)!important}
.card.slib{border-color:#8b5cf6!important;box-shadow:0 0 20px rgba(139,92,246,.18)!important}

/* thumbnail */
.cth{position:relative;aspect-ratio:9/16;overflow:hidden;background:#0d0d1a;flex-shrink:0;cursor:pointer}
.cth img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s}
.card:hover .cth img{transform:scale(1.05)}
.dur{position:absolute;bottom:8px;left:8px;background:rgba(0,0,0,.78);backdrop-filter:blur(6px);color:#fff;font-size:12px;font-weight:700;padding:3px 9px;border-radius:7px;pointer-events:none;font-family:'Cairo',sans-serif}
.ck{position:absolute;top:9px;right:9px;width:27px;height:27px;border-radius:50%;background:rgba(0,0,0,.65);border:2px solid #2a2a45;display:flex;align-items:center;justify-content:center;transition:all .15s;pointer-events:none}
.card.sdv .ck{background:#ef4444;border-color:#ef4444}
.card.sdbx .ck{background:#3b82f6;border-color:#3b82f6}
.card.slib .ck{background:#8b5cf6;border-color:#8b5cf6}
.ct{font-size:13px;font-weight:800;color:#fff;opacity:0;transition:opacity .15s}
.card.sdv .ct,.card.sdbx .ct,.card.slib .ct{opacity:1}
.sord{position:absolute;top:9px;left:9px;min-width:22px;height:22px;border-radius:99px;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 5px;pointer-events:none;font-family:'Cairo',sans-serif}
.card.sdv .sord{background:#ef4444;color:#fff}
.card.sdbx .sord{background:#3b82f6;color:#fff}
.card.slib .sord{background:#8b5cf6;color:#fff}

/* dropbox status overlay */
.dbx-ov{position:absolute;bottom:8px;right:8px;font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;pointer-events:none;display:flex;align-items:center;gap:4px;font-family:'Cairo',sans-serif}
.dbx-ov.up{background:rgba(59,130,246,.3);color:#93c5fd}
.dbx-ov.done{background:rgba(34,197,94,.25);color:#4ade80}
.dbx-ov.fail{background:rgba(239,68,68,.25);color:#fca5a5}
.dbx-spin{width:8px;height:8px;border-radius:50%;border:2px solid #93c5fd44;border-top-color:#93c5fd;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

.cbody{padding:11px 13px 6px;flex:1}
.cst{display:flex;gap:10px;font-size:12px;color:#2a3050;margin-bottom:5px;font-weight:600}
.cdesc{font-size:13px;font-weight:500;color:#3a4060;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.cfoot{padding:7px 12px 12px;display:flex;flex-direction:column;gap:6px}
.abtn{width:100%;min-height:34px;border-radius:9px;font-size:13px;font-weight:700;border:none;cursor:pointer;font-family:'Cairo',sans-serif;transition:all .2s}
.abtn:disabled{opacity:.22;cursor:not-allowed}
.abtn.dev{background:linear-gradient(135deg,#ef4444,#f97316);color:#fff}
.abtn.dev:not(:disabled):hover{transform:translateY(-1px)}
.abtn.dbx{background:linear-gradient(135deg,#3b82f6,#06b6d4);color:#fff}
.abtn.dbx:not(:disabled):hover{transform:translateY(-1px)}
.abtn.lib{background:rgba(139,92,246,.12);color:#a78bfa;border:1px solid rgba(139,92,246,.25)}
.abtn.lib:not(:disabled):hover{background:rgba(139,92,246,.2)}
.saved{width:100%;min-height:30px;border-radius:8px;font-size:13px;font-weight:700;border:1px solid rgba(99,102,241,.2);background:rgba(99,102,241,.07);color:#818cf8;display:flex;align-items:center;justify-content:center;gap:5px;font-family:'Cairo',sans-serif}

.lmw{display:flex;justify-content:center;margin-top:28px}

/* skeletons */
.sg{display:grid;grid-template-columns:repeat(auto-fill,minmax(185px,1fr));gap:14px}
.sk{background:#111120;border-radius:16px;overflow:hidden;border:2px solid #1a1a30}
.skt{aspect-ratio:9/16;background:linear-gradient(90deg,#111120 25%,#181830 50%,#111120 75%);background-size:200% 100%;animation:shim 1.4s infinite}
.skl{height:11px;margin:11px 13px 0;border-radius:6px;background:linear-gradient(90deg,#111120 25%,#181830 50%,#111120 75%);background-size:200% 100%;animation:shim 1.4s infinite}
.skl.s{width:55%;margin-bottom:12px}
@keyframes shim{0%{background-position:200% 0}100%{background-position:-200% 0}}

.emp{text-align:center;padding:80px 20px}
.eico{font-size:56px;margin-bottom:18px}
.etit{font-family:'Bebas Neue',cursive;font-size:38px;letter-spacing:3px;color:#1a1a30;margin-bottom:8px}
.esub{font-size:15px;color:#1e2040;font-weight:500}

/* library */
.lhdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px}
.ltit{font-family:'Bebas Neue',cursive;font-size:28px;letter-spacing:2px;color:#3a4060}
.lstats{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px}
.lstat{background:#111120;border:1px solid #1a1a30;border-radius:12px;padding:14px 20px}
.lsn{font-family:'Bebas Neue',cursive;font-size:26px;color:#818cf8}
.lsl{font-size:12px;color:#2a3050;font-weight:600;margin-top:2px}
.li{background:#111120;border:2px solid #1a1a30;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;transition:border-color .2s}
.li:hover{border-color:#2e2e55}
.lth{position:relative;aspect-ratio:9/16;overflow:hidden;background:#0d0d1a}
.lth img{width:100%;height:100%;object-fit:cover;display:block}
.la{position:absolute;top:8px;left:8px;font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;font-family:'Cairo',sans-serif}
.la.old{background:rgba(239,68,68,.75);color:#fff}
.la.ok{background:rgba(99,102,241,.2);color:#a5b4fc}
.lbd{padding:11px 13px 13px;flex:1;display:flex;flex-direction:column;gap:6px}
.ldesc{font-size:13px;font-weight:500;color:#3a4060;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;flex:1}
.ldate{font-size:12px;color:#1e2040;font-weight:600}
.lrm{min-height:30px;border-radius:8px;border:none;background:rgba(239,68,68,.08);color:#f87171;font-size:13px;font-weight:700;cursor:pointer;font-family:'Cairo',sans-serif;transition:background .2s}
.lrm:hover{background:rgba(239,68,68,.16)}
.lemp{text-align:center;padding:60px 20px}
.lei{font-size:44px;margin-bottom:14px}
.let{font-size:15px;color:#1e2040;font-weight:600;line-height:1.7}

/* ── KEY MANAGER ─────────────────────────────────────── */
.km-intro{background:#131320;border:1px solid #1e1e35;border-radius:14px;padding:20px 24px;margin-bottom:20px}
.km-intro-title{font-size:15px;font-weight:700;color:#5a6090;margin-bottom:8px}
.km-intro-text{font-size:14px;color:#2a3050;line-height:1.7;font-weight:500}
.km-intro-text a{color:#818cf8;text-decoration:none}
.km-order-note{font-size:13px;color:#3a4060;margin-top:8px;font-weight:600}

.prov-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:16px;margin-bottom:20px}
.prov-card{background:#131320;border:1px solid #1e1e35;border-radius:16px;overflow:hidden;transition:border-color .2s}
.prov-card-head{padding:16px 18px 12px;display:flex;align-items:center;gap:12px;border-bottom:1px solid #1a1a30}
.prov-icon{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.prov-name{font-size:16px;font-weight:800;line-height:1}
.prov-desc{font-size:12px;color:#2a3050;margin-top:3px;font-weight:600}
.prov-help a{font-size:12px;text-decoration:none;opacity:.75;font-weight:600}
.prov-keys{padding:12px 16px;display:flex;flex-direction:column;gap:8px;min-height:44px}
.prov-no-keys{font-size:14px;color:#1e2040;text-align:center;padding:10px 0;font-weight:600}

.key-item{display:flex;align-items:center;gap:9px;background:#0d0d14;border:1px solid #1a1a30;border-radius:10px;padding:10px 13px;transition:border-color .2s}
.key-item:hover{border-color:#2e2e55}
.key-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
.key-dot.active{background:#22c55e}
.key-dot.quota{background:#f59e0b}
.key-dot.invalid{background:#ef4444}
.key-dot.unknown{background:#374060}
.key-dot.testing{background:#818cf8;animation:pu .8s infinite}
.key-info{flex:1;min-width:0}
.key-label{font-size:13px;font-weight:700;color:#5a6090}
.key-val{font-size:11px;color:#1e2040;font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px}
.key-msg{font-size:11px;margin-top:2px;font-weight:600}
.key-msg.ok{color:#4ade80}
.key-msg.warn{color:#fbbf24}
.key-msg.err{color:#f87171}
.key-msg.info{color:#60a5fa}
.key-actions{display:flex;gap:5px;flex-shrink:0}
.kbtn{padding:0 10px;min-height:28px;border:1px solid #1a1a30;background:transparent;border-radius:7px;font-family:'Cairo',sans-serif;font-size:12px;font-weight:700;cursor:pointer;color:#374060;transition:all .2s}
.kbtn:hover{border-color:#2e2e55;color:#6b7280}
.kbtn.danger{color:#f87171;border-color:rgba(239,68,68,.25)}
.kbtn.danger:hover{background:rgba(239,68,68,.12)}
.kbtn:disabled{opacity:.3;cursor:not-allowed}

.prov-add{padding:12px 16px 16px;border-top:1px solid #1a1a30;display:flex;flex-direction:column;gap:8px}
.add-row{display:flex;gap:8px;flex-wrap:wrap}
.add-inp{flex:1 1 180px;background:#0d0d14;border:1px solid #1a1a30;border-radius:9px;padding:9px 13px;color:#e8eaf6;font-family:monospace;font-size:12px;outline:none;transition:border-color .2s;min-height:38px}
.add-inp:focus{border-color:#818cf8}
.add-inp::placeholder{color:#1a1a30}
.add-inp.lbl{font-family:'Cairo',sans-serif;font-size:13px}
.add-btn{padding:0 16px;min-height:38px;border:none;border-radius:9px;font-family:'Cairo',sans-serif;font-size:13px;font-weight:700;cursor:pointer;color:#fff;transition:all .2s}
.add-btn:disabled{opacity:.3;cursor:not-allowed}
.add-btn:not(:disabled):hover{transform:translateY(-1px)}

@media(max-width:560px){
  .grid,.sg{grid-template-columns:repeat(2,1fr);gap:9px}
  .sr{flex-direction:column}
  .inp{flex:1 1 100%}
  .btn{width:100%}
  .sc{padding:16px}
  .selR{width:100%}
  .selR .btn{flex:1}
  .prov-grid{grid-template-columns:1fr}
}
`

/* ══════════════════════════════════════════════════════ */
export default function App() {
  const [tab,  setTab]  = useState<Tab>('search')
  const [mode, setMode] = useState<Mode>('dropbox')

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

  // per-card dropbox status
  const [dbxStatus, setDbxStatus] = useState<Record<string,'up'|'done'|'fail'>>({})

  const [keys,      setKeys]      = useState<ApiKey[]>(()=>loadKeys())
  const [testingId, setTestingId] = useState<string|null>(null)
  const [newVals,   setNewVals]   = useState<Partial<Record<Provider,string>>>({})
  const [newLabels, setNewLabels] = useState<Partial<Record<Provider,string>>>({})

  useEffect(()=>{ saveKeys(keys) },[keys])

  // selection ref
  const selRef = useRef<string[]>([])
  const [,rSel] = useState(0)
  const getSel    = () => selRef.current
  const toggleSel = (id:string) => { const c=selRef.current; selRef.current=c.includes(id)?c.filter(x=>x!==id):[...c,id]; rSel(n=>n+1) }
  const selAll    = (vs:Video[]) => { selRef.current=vs.map(v=>String(v.id)); rSel(n=>n+1) }
  const clrSel    = () => { selRef.current=[]; rSel(n=>n+1) }

  // library ref
  const libRef = useRef<LibItem[]>(lsRead())
  const [,rLib] = useState(0)
  const getLib   = () => libRef.current
  const saveLib  = (items:LibItem[]) => { libRef.current=items; lsWrite(items); rLib(n=>n+1) }
  const addToLib = (vs:Video[]) => {
    const ex=new Set(libRef.current.map(x=>x.id)); const now=Date.now(); const fr:LibItem[]=[]
    for(const v of vs){ const id=String(v.id); if(!ex.has(id)){ ex.add(id); fr.push({id,cover:v.cover||v.origin_cover,title:v.title||'بدون عنوان',savedAt:now}) } }
    if(fr.length) saveLib([...fr,...libRef.current])
  }
  const rmLib    = (id:string) => saveLib(libRef.current.filter(x=>x.id!==id))
  const isInLib  = (id:string) => libRef.current.some(x=>x.id===id)

  // fetch
  const callApi = async (params:Record<string,string>) => {
    const qs=new URLSearchParams(params)
    const r=await fetch(`/api/fetch?${qs}`,{
      headers:{'X-Keys':buildKeysHeader(keys)},
      signal:AbortSignal.timeout(30000),
    })
    const d=await r.json()
    if(!d.ok) throw new Error(d.error||'فشل جلب البيانات')
    return d
  }

  const fetchProfile = async (username:string,cur='0') => {
    const d=await callApi({action:'profile',username,cursor:cur})
    const all:Video[]=d.videos||[]
    const filtered=all.filter(v=>!v.duration||v.duration<=MAX_DUR)
    return {filtered,skipped:all.length-filtered.length,nextCursor:d.cursor||null,hasMore:!!d.hasMore}
  }

  const searchProfile = async (username:string) => {
    setLoading(true); setError(''); setVideos([]); setSkipped(0)
    clrSel(); setCursor(null); setHasMore(false); setCurUser(username)
    setStatus(`جاري جلب فيديوهات @${username}...`)
    try{
      const pg=await fetchProfile(username)
      if(!pg.filtered.length) throw new Error('لا توجد فيديوهات مطابقة.')
      setVideos(pg.filtered); setSkipped(pg.skipped)
      setCursor(pg.nextCursor); setHasMore(pg.hasMore)
      setStatus(`تم جلب ${pg.filtered.length} فيديو من @${username}${pg.hasMore?' · اضغط «المزيد»':''}`)
    }catch(e:any){setError(e.message);setStatus('')}
    finally{setLoading(false)}
  }

  const loadMore=async()=>{
    if(!curUser||!cursor||moreLoad) return
    setMoreLoad(true)
    try{
      const pg=await fetchProfile(curUser,cursor)
      setVideos(prev=>{const ids=new Set(prev.map(v=>String(v.id)));return[...prev,...pg.filtered.filter(v=>!ids.has(String(v.id)))]})
      setSkipped(s=>s+pg.skipped); setCursor(pg.nextCursor); setHasMore(pg.hasMore)
    }catch(e:any){setError(e.message)}
    finally{setMoreLoad(false)}
  }

  const searchVideo=async(vUrl:string)=>{
    setLoading(true); setError(''); setStatus('جاري جلب الفيديو...')
    try{
      const d=await callApi({action:'video',video_url:vUrl})
      const v:Video=d.videos?.[0]
      if(!v?.id) throw new Error('تعذّر جلب الفيديو.')
      if(v.duration>MAX_DUR) throw new Error(`هذا الفيديو أطول من ${Math.floor(MAX_DUR/60)} دقائق.`)
      setVideos([v]); setHasMore(false); setStatus('تم جلب الفيديو!')
    }catch(e:any){setError(e.message);setStatus('')}
    finally{setLoading(false)}
  }

  const handleSearch=()=>{
    const v=urlInput.trim(); if(!v) return; setError('')
    if(isVidLink(v)) searchVideo(v)
    else{ const u=parseHandle(v); if(!u){setError('أدخل رابط بروفايل صحيح: @username');return} searchProfile(u) }
  }

  const sorted=[...videos].sort((a,b)=>{
    if(sort==='views')    return b.play_count-a.play_count
    if(sort==='likes')    return b.digg_count-a.digg_count
    if(sort==='shortest') return a.duration-b.duration
    if(sort==='longest')  return b.duration-a.duration
    return 0
  })

  // upload ONE video to Dropbox — awaitable, sequential
  const uploadToDropbox=async(video:Video):Promise<boolean>=>{
    const token=getDropboxToken(keys)
    if(!token) return false
    const dlUrl=video.play||video.wmplay
    if(!dlUrl) return false
    const id=String(video.id)
    setDbxStatus(p=>({...p,[id]:'up'}))
    try{
      const r=await fetch('/api/dropbox',{
        method:'POST',
        headers:{
          'X-Video-Url':encodeURIComponent(dlUrl),
          'X-File-Name':`tiktok_${id}.mp4`,
          'X-Dbx-Token':token,
        },
        signal:AbortSignal.timeout(120000),
      })
      const d=await r.json()
      if(d.success){
        setDbxStatus(p=>({...p,[id]:'done'}))
        return true
      }
      setDbxStatus(p=>({...p,[id]:'fail'}))
      return false
    }catch{
      setDbxStatus(p=>({...p,[id]:'fail'}))
      return false
    }
  }

  // download to device
  const downloadToDevice=async(video:Video):Promise<boolean>=>{
    const dlUrl=video.play||video.wmplay; if(!dlUrl) return false
    try{
      const r=await fetch(`/api/download?url=${encodeURIComponent(dlUrl)}`,{signal:AbortSignal.timeout(120000)})
      if(!r.ok) throw new Error(`HTTP ${r.status}`)
      const blob=await r.blob()
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`tiktok_${video.id}.mp4`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href)
      return true
    }catch{return false}
  }

  // process single video from card button
  const processOne=async(v:Video)=>{
    const id=String(v.id); setDlId(id); setError('')
    if(mode==='dropbox'){
      const ok=await uploadToDropbox(v)
      if(ok) addToLib([v]); else setError('فشل الرفع على Dropbox.')
    } else if(mode==='device'){
      const ok=await downloadToDevice(v)
      if(ok){ addToLib([v]); uploadToDropbox(v) }
      else setError('فشل التحميل.')
    } else {
      addToLib([v])
    }
    setDlId(null)
  }

  // bulk action — passes sel + mode as params to avoid stale closure
  const bulkAction=async(currentSel:string[],currentMode:Mode)=>{
    if(!currentSel.length) return
    const vMap=new Map(videos.map(v=>[String(v.id),v]))
    const toProcess=currentSel.map(id=>vMap.get(id)).filter(Boolean) as Video[]
    if(!toProcess.length) return

    setBusy(true); setBDone(0); setBTotal(toProcess.length); setError('')

    if(currentMode==='library'){
      setBLabel('جاري الحفظ في المكتبة...')
      addToLib(toProcess)
      setBDone(toProcess.length)
      await new Promise(r=>setTimeout(r,300))
      setBusy(false); setBLabel('')
      setStatus(`✅ تم حفظ ${toProcess.length} فيديو في المكتبة!`)
      clrSel(); return
    }

    let failed=0
    for(let i=0;i<toProcess.length;i++){
      const v=toProcess[i]
      setBLabel(`${i+1} من ${toProcess.length}: ${v.title?.slice(0,30)||'...'}`);

      if(currentMode==='dropbox'){
        const ok=await uploadToDropbox(v)
        if(ok) addToLib([v]); else failed++
      } else {
        // device: download then upload to dropbox in background
        const ok=await downloadToDevice(v)
        if(ok){ addToLib([v]); uploadToDropbox(v) }
        else failed++
        await new Promise(r=>setTimeout(r,600))
      }
      setBDone(i+1)
    }

    setBusy(false); setBLabel('')
    const success=toProcess.length-failed
    if(currentMode==='dropbox')
      setStatus(`✅ تم رفع ${success} فيديو على Dropbox /videos!${failed>0?` (فشل ${failed})`:''}`)
    else
      setStatus(`✅ تم تحميل ${success} فيديو!${failed>0?` (فشل ${failed})`:''}`)
    clrSel()
  }

  // key manager
  const doAddKey=(provider:Provider)=>{
    const val=(newVals[provider]||'').trim(); if(!val) return
    const updated=addKey(keys,provider,(newLabels[provider]||'').trim(),val)
    setKeys(updated)
    setNewVals(p=>({...p,[provider]:''}))
    setNewLabels(p=>({...p,[provider]:''}))
  }

  const doTestKey=async(k:ApiKey)=>{
    setTestingId(k.id)
    setKeys(prev=>prev.map(x=>x.id===k.id?{...x,status:'testing' as KeyStatus,message:'جاري الاختبار...'}:x))
    try{
      const r=await fetch('/api/test-key',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({provider:k.provider,key:k.value}),
        signal:AbortSignal.timeout(12000),
      })
      const d=await r.json()
      setKeys(prev=>prev.map(x=>x.id===k.id?{...x,status:d.status||'unknown',message:d.message||''}:x))
    }catch(e:any){
      setKeys(prev=>prev.map(x=>x.id===k.id?{...x,status:'unknown',message:'تعذّر الاتصال'}:x))
    }
    setTestingId(null)
  }

  const doRemoveKey=(id:string)=>{ setKeys(removeKey(keys,id)) }

  // derived
  const bPct     = bTotal>0?Math.round((bDone/bTotal)*100):0
  const sel      = getSel()
  const lib      = getLib()
  const selLen   = sel.length
  const expiring = lib.filter(x=>daysAgo(x.savedAt)>=25).length
  const hasDbx   = keys.some(k=>k.provider==='dropbox'&&k.status!=='invalid')
  const tikKeys  = keys.filter(k=>k.provider!=='dropbox'&&k.status!=='invalid').length

  const SORTS:{k:Sort;l:string}[]=[
    {k:'default',l:'الافتراضي'},{k:'views',l:'▶ مشاهدات'},
    {k:'likes',l:'❤ لايكات'},{k:'shortest',l:'⏱ الأقصر'},{k:'longest',l:'⏱ الأطول'},
  ]
  const providers:Provider[]=['rapidapi','apify','scraperapi','dropbox']

  /* ════════════ RENDER ════════════ */
  return(
    <>
      <style>{CSS}</style>
      <div style={{minHeight:'100vh',background:'#0d0d14'}}>
        <div className="blob b1"/><div className="blob b2"/>
        <div className="pg">

          {/* HEADER */}
          <div className="hdr">
            <div className="logo">TIKLOAD</div>
            <div className="logo-sub">تحميل فيديوهات تيك توك · بدون علامة مائية · تحت 5 دقائق</div>
            <div className="status-pills">
              <span className={`pill ${tikKeys>0?'on':'neutral'}`}>
                <span className="pill-dot"/>
                {tikKeys>0?`${tikKeys} مفتاح TikTok نشط`:'tikwm مجاني (احتياطي)'}
              </span>
              <span className={`pill ${hasDbx?'on':'off'}`}>
                <span className="pill-dot"/>
                {hasDbx?'☁️ Dropbox متصل':'☁️ Dropbox غير متصل'}
              </span>
            </div>
          </div>

          {/* TABS */}
          <div className="tabs">
            <button className={`tab${tab==='search'?' on':''}`} onClick={()=>setTab('search')}>🔍 البحث والتحميل</button>
            <button className={`tab${tab==='library'?' on':''}`} onClick={()=>setTab('library')}>
              {lib.length>0&&<span className="tbadge">{lib.length}</span>}
              📁 مكتبتي
            </button>
            <button className={`tab${tab==='keys'?' on':''}`} onClick={()=>setTab('keys')}>
              {keys.length>0&&<span className="tbadge" style={{background:'#8b5cf6'}}>{keys.length}</span>}
              🔑 المفاتيح
            </button>
          </div>

          {/* ══ SEARCH ══ */}
          {tab==='search'&&<>
            <div className="mbar">
              <span className="mlab">وضع التحميل:</span>
              <div className="mopts">
                <button className={`mopt${mode==='dropbox'?' on-dbx':''}`} onClick={()=>setMode('dropbox')}>
                  ☁️ Dropbox مباشر
                </button>
                <button className={`mopt${mode==='device'?' on-dev':''}`} onClick={()=>setMode('device')}>
                  💾 على الجهاز
                </button>
                <button className={`mopt${mode==='library'?' on-lib':''}`} onClick={()=>setMode('library')}>
                  📁 مكتبة فقط
                </button>
              </div>
              <div className="mbar-note">
                {mode==='dropbox'&&'☁️ الفيديوهات تُرفع مباشرة على Dropbox في مجلد /videos — واحد ورا واحد بشكل متسلسل'}
                {mode==='device'&&`💾 يحمّل على جهازك${hasDbx?' + يرفع على Dropbox في الخلفية':''}`}
                {mode==='library'&&'📁 يحفظ في مكتبة الموقع فقط'}
              </div>
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
            {mode==='dropbox'&&!hasDbx&&<div className="al aw">⚠ لم يتم إضافة Dropbox Token — أضفه من تبويب المفاتيح</div>}

            {busy&&(
              <div className="prc">
                <div className="prh">
                  <span className="prt">
                    {mode==='dropbox'?'☁️ جاري الرفع على Dropbox...':mode==='library'?'📁 جاري الحفظ...':'⬇ جاري التحميل...'} {bLabel}
                  </span>
                  <span className="prn">{bDone}/{bTotal}</span>
                </div>
                <div className="ptr"><div className={`pf ${mode}`} style={{width:`${bPct}%`}}/></div>
                <div className="ps">{bPct}% مكتمل</div>
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
                      <div className="selh">فيديو محدد — اضغط الصورة للتحديد أو الإلغاء</div>
                    </div>
                  </div>
                  <div className="selR">
                    {mode==='dropbox'&&(
                      <button className="btn bdbx bsm" onClick={()=>bulkAction([...sel],mode)} disabled={busy||!hasDbx}>
                        {busy?`☁️ ${bPct}%`:`☁️ رفع ${selLen} على Dropbox`}
                      </button>
                    )}
                    {mode==='device'&&(
                      <button className="btn bdl bsm" onClick={()=>bulkAction([...sel],mode)} disabled={busy}>
                        {busy?`⬇ ${bPct}%`:`⬇ تحميل ${selLen} فيديو`}
                      </button>
                    )}
                    {mode==='library'&&(
                      <button className="btn blib bsm" onClick={()=>bulkAction([...sel],mode)} disabled={busy}>
                        {busy?`📁 ${bPct}%`:`📁 حفظ ${selLen} في المكتبة`}
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="grid">
                {sorted.map(v=>{
                  const id=String(v.id); const idx=sel.indexOf(id); const isSel=idx!==-1
                  const isDl=dlId===id; const inLib=isInLib(id)
                  const dSt=dbxStatus[id]
                  const cardCls=`card${isSel?(mode==='dropbox'?' sdbx':mode==='library'?' slib':' sdv'):''}`
                  return(
                    <div key={id} className={cardCls}>
                      <div className="cth" onClick={()=>{if(!busy&&!isDl)toggleSel(id)}}>
                        <img src={v.cover||v.origin_cover} alt="" loading="lazy"
                          onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
                        {v.duration>0&&<div className="dur">{sec2str(v.duration)}</div>}
                        <div className="ck"><span className="ct">✓</span></div>
                        {isSel&&<div className="sord">{idx+1}</div>}
                        {dSt==='up'&&<div className="dbx-ov up"><div className="dbx-spin"/>رفع...</div>}
                        {dSt==='done'&&<div className="dbx-ov done">☁️ تم</div>}
                        {dSt==='fail'&&<div className="dbx-ov fail">✕ فشل</div>}
                      </div>
                      <div className="cbody">
                        <div className="cst"><span>❤ {n2s(v.digg_count)}</span><span>▶ {n2s(v.play_count)}</span></div>
                        <div className="cdesc">{v.title||'بدون عنوان'}</div>
                      </div>
                      <div className="cfoot">
                        {mode==='dropbox'&&(
                          dSt==='done'
                            ?<div className="saved">☁️ تم الرفع على Dropbox</div>
                            :<button className="abtn dbx" onClick={()=>processOne(v)} disabled={isDl||busy||!hasDbx}>
                                {isDl?'⏳ جاري الرفع...':'☁️ رفع على Dropbox'}
                              </button>
                        )}
                        {mode==='device'&&(
                          <>
                            {inLib?<div className="saved">✓ تم التحميل</div>
                              :<button className="abtn dev" onClick={()=>processOne(v)} disabled={isDl||busy}>
                                  {isDl?'⏳ جاري...':'⬇ تحميل'}
                                </button>}
                            {!inLib&&<button className="abtn lib" onClick={()=>{addToLib([v])}} disabled={busy}>📁 حفظ فقط</button>}
                          </>
                        )}
                        {mode==='library'&&(
                          inLib?<div className="saved">✓ في المكتبة</div>
                          :<button className="abtn lib" onClick={()=>processOne(v)} disabled={isDl||busy}>
                              {isDl?'⏳...':'📁 حفظ في المكتبة'}
                            </button>
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
            {expiring>0&&<div className="al aw">⚠ {expiring} فيديو ستُحذف تلقائياً خلال أقل من 5 أيام</div>}
            <div className="lhdr">
              <div className="ltit">📁 مكتبتي ({lib.length})</div>
              {lib.length>0&&<button className="btn bdanger bsm" onClick={()=>{if(confirm('مسح المكتبة كاملة؟'))saveLib([])}}>🗑 مسح الكل</button>}
            </div>
            {lib.length>0&&<div className="lstats">
              <div className="lstat"><div className="lsn">{lib.length}</div><div className="lsl">محفوظ إجمالاً</div></div>
              <div className="lstat"><div className="lsn">{lib.filter(x=>daysAgo(x.savedAt)<7).length}</div><div className="lsl">هذا الأسبوع</div></div>
              <div className="lstat"><div className="lsn">{expiring}</div><div className="lsl">تنتهي قريباً</div></div>
            </div>}
            {lib.length===0
              ?<div className="lemp"><div className="lei">📭</div><div className="let">لم تحفظ أي فيديو بعد.<br/>استخدم وضع «مكتبة» أو «Dropbox» وستظهر هنا.</div></div>
              :<div className="grid">{lib.map(item=>{
                const d=daysAgo(item.savedAt)
                return(<div key={item.id} className="li">
                  <div className="lth">
                    <img src={item.cover} alt="" loading="lazy" onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
                    <div className={`la ${d>=25?'old':'ok'}`}>{d===0?'اليوم':`${d} يوم`}</div>
                  </div>
                  <div className="lbd">
                    <div className="ldesc">{item.title}</div>
                    <div className="ldate">📅 منذ {d} يوم</div>
                    <button className="lrm" onClick={()=>rmLib(item.id)}>✕ إزالة</button>
                  </div>
                </div>)
              })}</div>
            }
          </>}

          {/* ══ KEYS ══ */}
          {tab==='keys'&&<>
            <div className="km-intro">
              <div className="km-intro-title">🔑 إدارة مفاتيح API</div>
              <div className="km-intro-text">
                أضف مفاتيح من أي مزود — يتم تجريبها تلقائياً بالترتيب وينتقل للتالي عند الفشل.<br/>
                <strong className="km-order-note">ترتيب المحاولة: RapidAPI ← Apify ← ScraperAPI ← tikwm مجاني</strong>
              </div>
            </div>
            <div className="prov-grid">
              {providers.map(provider=>{
                const info=PROVIDER_INFO[provider]
                const provKeys=keys.filter(k=>k.provider===provider)
                const val=newVals[provider]||''
                const lbl=newLabels[provider]||''
                const maxReached=provKeys.length>=3
                return(
                  <div key={provider} className="prov-card" style={{borderColor:info.border}}>
                    <div className="prov-card-head">
                      <div className="prov-icon" style={{background:info.glow}}>{info.icon}</div>
                      <div style={{flex:1}}>
                        <div className="prov-name" style={{color:info.color}}>{info.label}</div>
                        <div className="prov-desc">{info.helpText}</div>
                        <div className="prov-help"><a href={info.helpUrl} target="_blank" rel="noopener noreferrer" style={{color:info.color}}>احصل على مفتاح مجاني ↗</a></div>
                      </div>
                      <div style={{fontSize:'13px',color:'#374060',fontWeight:'700'}}>{provKeys.length}/3</div>
                    </div>
                    <div className="prov-keys">
                      {provKeys.length===0&&<div className="prov-no-keys">لا توجد مفاتيح — أضف واحداً أدناه</div>}
                      {provKeys.map((k,i)=>{
                        const msgCls=k.status==='active'?'ok':k.status==='quota'||k.status==='unknown'?'warn':'err'
                        return(<div key={k.id} className="key-item">
                          <div className={`key-dot ${k.status}`}/>
                          <div style={{fontSize:'12px',color:'#374060',flexShrink:0,fontWeight:'700',minWidth:'20px'}}>#{i+1}</div>
                          <div className="key-info">
                            <div className="key-label">{k.label}</div>
                            <div className="key-val">{k.value.slice(0,10)}{'•'.repeat(10)}</div>
                            {k.message&&<div className={`key-msg ${msgCls}`}>{k.message}</div>}
                          </div>
                          <div className="key-actions">
                            <button className="kbtn" disabled={testingId===k.id} onClick={()=>doTestKey(k)}>
                              {testingId===k.id?'⏳':'اختبار'}
                            </button>
                            <button className="kbtn danger" onClick={()=>doRemoveKey(k.id)}>✕</button>
                          </div>
                        </div>)
                      })}
                    </div>
                    {!maxReached&&(
                      <div className="prov-add">
                        <div className="add-row">
                          <input className="add-inp" placeholder={info.placeholder} type="password" autoComplete="off"
                            value={val} onChange={e=>setNewVals(p=>({...p,[provider]:e.target.value}))}
                            onKeyDown={e=>e.key==='Enter'&&doAddKey(provider)}/>
                          <button className="add-btn" style={{background:`linear-gradient(135deg,${info.color},${info.color}bb)`}}
                            disabled={!val.trim()} onClick={()=>doAddKey(provider)}>+ إضافة</button>
                        </div>
                        <input className="add-inp lbl" placeholder="اسم مخصص (اختياري — اضغط Enter للإضافة)"
                          value={lbl} onChange={e=>setNewLabels(p=>({...p,[provider]:e.target.value}))}/>
                      </div>
                    )}
                    {maxReached&&<div style={{padding:'12px 16px',fontSize:'13px',color:'#374060',borderTop:'1px solid #1a1a30',fontWeight:'600'}}>✓ الحد الأقصى 3 مفاتيح</div>}
                  </div>
                )
              })}
            </div>
            {keys.length>0&&(
              <div style={{display:'flex',gap:'10px',flexWrap:'wrap',marginTop:'4px'}}>
                <button className="btn bfetch bsm" style={{minHeight:'40px'}}
                  onClick={()=>keys.forEach(k=>doTestKey(k))} disabled={testingId!==null}>
                  🔄 اختبار كل المفاتيح
                </button>
                <button className="btn bdanger bsm" style={{minHeight:'40px'}}
                  onClick={()=>{if(confirm('حذف كل المفاتيح؟'))setKeys([])}}>
                  🗑 حذف الكل
                </button>
              </div>
            )}
          </>}

        </div>
      </div>
    </>
  )
}
