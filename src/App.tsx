import { useState, useEffect, useCallback } from "react";

const API      = "/api/tikwm";
const MAX_DUR  = 5 * 60;
const LS_KEY   = "tl_lib_v4";
const MONTH    = 30 * 24 * 60 * 60 * 1000;

type Video   = { id:string; cover:string; origin_cover:string; title:string; duration:number; play:string; wmplay:string; digg_count:number; play_count:number; };
type LibItem = { id:string; cover:string; title:string; savedAt:number; };
type Sort    = "default"|"views"|"likes"|"shortest"|"longest";
type Mode    = "device"|"library";

const fmt    = (n:number) => !n?"0":n>=1e6?(n/1e6).toFixed(1)+"M":n>=1000?(n/1000).toFixed(1)+"K":String(n);
const fmtDur = (s:number) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,"0")}`;
const ago    = (ts:number) => Math.floor((Date.now()-ts)/86400000);

function parseUser(v:string){
  v=v.trim();
  const m=v.match(/tiktok\.com\/@([^/?&]+)/);
  if(m)return m[1];
  if(v.startsWith("@"))return v.slice(1);
  if(!v.includes("/")&&!v.includes("."))return v;
  return null;
}
const isVidUrl=(v:string)=>v.includes("tiktok.com")&&v.includes("/video/");

/* ── localStorage ── */
function lsRead():LibItem[]{
  try{ return (JSON.parse(localStorage.getItem(LS_KEY)||"[]") as LibItem[]).filter(x=>Date.now()-x.savedAt<MONTH); }
  catch{ return []; }
}

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#080808;color:#e8e8e8;font-family:'DM Sans',sans-serif;min-height:100vh;-webkit-font-smoothing:antialiased}
.root{min-height:100vh;background:#080808;position:relative}
.g1{position:fixed;width:700px;height:700px;border-radius:50%;background:radial-gradient(circle,rgba(0,255,198,.05),transparent 65%);top:-250px;left:-250px;pointer-events:none;z-index:0}
.g2{position:fixed;width:500px;height:500px;border-radius:50%;background:radial-gradient(circle,rgba(255,0,80,.04),transparent 65%);bottom:-150px;right:-150px;pointer-events:none;z-index:0}
.pg{max-width:1140px;margin:0 auto;padding:40px 20px 80px;position:relative;z-index:1}
.hdr{text-align:center;margin-bottom:36px}
.logo{font-family:'Bebas Neue',cursive;font-size:clamp(56px,9vw,94px);letter-spacing:6px;line-height:1;background:linear-gradient(135deg,#fff 0%,#00ffc6 45%,#ff0050 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.sub{font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#333;margin-top:8px}
.tabs{display:flex;gap:4px;margin-bottom:28px;background:#0d0d0d;border:1px solid #1a1a1a;border-radius:14px;padding:5px;width:fit-content}
.tab{padding:9px 22px;border-radius:10px;border:none;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;background:transparent;color:#444;display:flex;align-items:center;gap:6px}
.tab.on{background:#161616;color:#e8e8e8}
.tbadge{min-width:18px;height:18px;border-radius:99px;background:#00ffc6;color:#000;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;padding:0 5px}
.mbar{display:flex;align-items:center;gap:10px;background:#0d0d0d;border:1px solid #1a1a1a;border-radius:14px;padding:14px 20px;margin-bottom:18px;flex-wrap:wrap}
.mlab{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#2e2e2e}
.mopts{display:flex;gap:6px}
.mopt{padding:7px 16px;border-radius:10px;border:1px solid #1c1c1c;background:transparent;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;color:#444;cursor:pointer;transition:all .2s}
.mopt:hover{border-color:#2a2a2a;color:#777}
.mopt.on{background:#111;border-color:#00ffc6;color:#00ffc6}
.mopt.on.lb{border-color:#a855f7;color:#a855f7;background:rgba(168,85,247,.06)}
.mdesc{font-size:12px;color:#2a2a2a;width:100%;margin-top:4px}
.sc{background:#0f0f0f;border:1px solid #1c1c1c;border-radius:18px;padding:24px 28px;margin-bottom:18px;transition:border-color .25s}
.sc:focus-within{border-color:#00ffc6}
.fl{display:block;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#2a2a2a;margin-bottom:12px}
.row{display:flex;gap:10px;align-items:stretch;flex-wrap:wrap}
.inp{flex:1 1 240px;background:#080808;border:1px solid #1c1c1c;border-radius:11px;padding:12px 16px;color:#e8e8e8;font-family:'DM Sans',sans-serif;font-size:14px;outline:none;transition:border-color .2s;min-height:46px}
.inp:focus{border-color:#00ffc6}
.inp::placeholder{color:#222}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.chip{font-size:12px;padding:4px 13px;background:#0a0a0a;border:1px solid #181818;border-radius:99px;color:#2e2e2e;cursor:pointer;transition:all .2s}
.chip:hover{border-color:#2a2a2a;color:#666}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:0 22px;min-height:46px;border:none;border-radius:11px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;white-space:nowrap}
.btn:disabled{opacity:.3;cursor:not-allowed!important;transform:none!important}
.bfe{background:linear-gradient(135deg,#00ffc6,#00b4ff);color:#000}
.bfe:not(:disabled):hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(0,255,198,.28)}
.bdv{background:linear-gradient(135deg,#ff0050,#ff4d00);color:#fff}
.bdv:not(:disabled):hover{transform:translateY(-1px)}
.blb{background:linear-gradient(135deg,#a855f7,#6366f1);color:#fff}
.blb:not(:disabled):hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(168,85,247,.28)}
.bmo{background:#111;color:#555;border:1px solid #1e1e1e}
.bmo:not(:disabled):hover{border-color:#333;color:#999}
.bot{background:transparent;color:#555;border:1px solid #1c1c1c}
.bot:not(:disabled):hover{border-color:#333;color:#999}
.bsm{padding:0 14px;min-height:34px;font-size:12px;border-radius:9px}
.al{display:flex;align-items:flex-start;gap:10px;padding:12px 16px;border-radius:11px;font-size:13px;margin-bottom:14px;line-height:1.5}
.ae{background:rgba(255,0,80,.05);border:1px solid rgba(255,0,80,.15);color:#ff6685}
.ai{background:rgba(0,255,198,.04);border:1px solid rgba(0,255,198,.1);color:#00e6b0}
.as{background:#0f0f0f;border:1px solid #1c1c1c;color:#555}
.aw{background:rgba(255,180,0,.04);border:1px solid rgba(255,180,0,.12);color:#c8950a}
.dot{width:7px;height:7px;border-radius:50%;background:#00ffc6;flex-shrink:0;margin-top:3px;animation:pu 1.6s infinite}
@keyframes pu{0%,100%{opacity:1}50%{opacity:.2}}
.pcard{background:#0f0f0f;border:1px solid #1c1c1c;border-radius:14px;padding:18px 22px;margin-bottom:18px}
.ph{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.pt{font-size:13px;font-weight:600;color:#bbb}
.pp{font-size:13px;color:#555}
.ptr{height:5px;background:#161616;border-radius:99px;overflow:hidden;margin-bottom:6px}
.pf{height:100%;border-radius:99px;transition:width .3s}
.pf.dv{background:linear-gradient(90deg,#00ffc6,#00b4ff)}
.pf.lb{background:linear-gradient(90deg,#a855f7,#6366f1)}
.ps{font-size:11px;color:#2e2e2e}
.frow{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:18px}
.flab{font-size:10px;color:#2a2a2a;font-weight:700;letter-spacing:1.5px;text-transform:uppercase}
.fb{padding:6px 13px;border-radius:99px;border:1px solid #181818;background:transparent;color:#383838;font-family:'DM Sans',sans-serif;font-size:12px;cursor:pointer;transition:all .2s}
.fb:hover{border-color:#2a2a2a;color:#777}
.fb.on{background:#141414;border-color:#00ffc6;color:#00ffc6}
.tbar{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px}
.tbl{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.vn{font-family:'Bebas Neue',cursive;font-size:30px;letter-spacing:1px;color:#00ffc6;line-height:1}
.vl{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#252525}
.sbar{background:#0d0d0d;border:1px solid #1a1a1a;border-radius:14px;padding:14px 18px;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
.sbL{display:flex;align-items:center;gap:10px}
.sc2{font-family:'Bebas Neue',cursive;font-size:24px;letter-spacing:1px}
.sc2.dv{color:#00ffc6}
.sc2.lb{color:#a855f7}
.st{font-size:12px;color:#333}
.sbR{display:flex;gap:8px;flex-wrap:wrap}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(188px,1fr));gap:13px}
.card{background:#0d0d0d;border:2px solid transparent;border-radius:15px;overflow:hidden;display:flex;flex-direction:column;user-select:none;transition:border-color .15s,transform .15s,box-shadow .15s}
.card:hover{transform:translateY(-2px);border-color:#1e1e1e}
.card.sdv{border-color:#00ffc6;box-shadow:0 0 18px rgba(0,255,198,.12)}
.card.slb{border-color:#a855f7;box-shadow:0 0 18px rgba(168,85,247,.12)}
.thumb{position:relative;aspect-ratio:9/16;overflow:hidden;background:#111;flex-shrink:0;cursor:pointer}
.thumb img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s}
.card:hover .thumb img{transform:scale(1.04)}
.dur{position:absolute;bottom:7px;left:7px;background:rgba(0,0,0,.72);backdrop-filter:blur(6px);color:#fff;font-size:11px;font-weight:600;padding:2px 7px;border-radius:6px;pointer-events:none}
.ck{position:absolute;top:8px;right:8px;width:26px;height:26px;border-radius:50%;background:rgba(0,0,0,.55);border:2px solid #2a2a2a;display:flex;align-items:center;justify-content:center;transition:all .15s;pointer-events:none}
.card.sdv .ck{background:#00ffc6;border-color:#00ffc6}
.card.slb .ck{background:#a855f7;border-color:#a855f7}
.ct{font-size:13px;font-weight:800;color:#000;opacity:0;transition:opacity .15s}
.card.sdv .ct,.card.slb .ct{opacity:1}
.sord{position:absolute;top:8px;left:8px;min-width:22px;height:22px;border-radius:99px;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 5px;pointer-events:none}
.card.sdv .sord{background:#00ffc6;color:#000}
.card.slb .sord{background:#a855f7;color:#fff}
.cbody{padding:10px 12px 5px;flex:1}
.cst{display:flex;gap:10px;font-size:11px;color:#333;margin-bottom:5px}
.cdesc{font-size:12px;color:#3e3e3e;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.cfoot{padding:7px 11px 11px;display:flex;flex-direction:column;gap:5px}
.dlb{width:100%;min-height:34px;border-radius:9px;font-size:12px;font-weight:600;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .2s}
.dlb:disabled{opacity:.3;cursor:not-allowed}
.dlb.dv{background:linear-gradient(135deg,#00ffc6,#00b4ff);color:#000}
.dlb.dv:not(:disabled):hover{transform:translateY(-1px)}
.dlb.lo{background:rgba(168,85,247,.1);color:#a855f7;border:1px solid rgba(168,85,247,.2)}
.dlb.lo:not(:disabled):hover{background:rgba(168,85,247,.18)}
.ilt{width:100%;min-height:28px;border-radius:8px;font-size:11px;font-weight:600;border:1px solid rgba(0,255,198,.15);background:rgba(0,255,198,.04);color:#00a87a;display:flex;align-items:center;justify-content:center;gap:5px}
.lmw{display:flex;justify-content:center;margin-top:28px}
.sg{display:grid;grid-template-columns:repeat(auto-fill,minmax(188px,1fr));gap:13px}
.sk{background:#0d0d0d;border-radius:15px;overflow:hidden}
.skt{aspect-ratio:9/16;background:linear-gradient(90deg,#0d0d0d 25%,#141414 50%,#0d0d0d 75%);background-size:200% 100%;animation:shim 1.4s infinite}
.skl{height:9px;margin:10px 12px 0;border-radius:5px;background:linear-gradient(90deg,#0d0d0d 25%,#141414 50%,#0d0d0d 75%);background-size:200% 100%;animation:shim 1.4s infinite}
.skl.s{width:55%;margin-bottom:11px}
@keyframes shim{0%{background-position:200% 0}100%{background-position:-200% 0}}
.emp{text-align:center;padding:80px 20px}
.ei{font-size:50px;margin-bottom:16px}
.et{font-family:'Bebas Neue',cursive;font-size:34px;letter-spacing:2px;color:#1c1c1c;margin-bottom:6px}
.es{font-size:13px;color:#222}
.lhdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px}
.lt{font-family:'Bebas Neue',cursive;font-size:26px;letter-spacing:2px;color:#3a3a3a}
.lstats{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px}
.lstat{background:#0d0d0d;border:1px solid #141414;border-radius:11px;padding:12px 18px}
.lsn{font-family:'Bebas Neue',cursive;font-size:24px;color:#a855f7}
.lsl{font-size:11px;color:#2a2a2a}
.li{background:#0d0d0d;border:1px solid #141414;border-radius:13px;overflow:hidden;display:flex;flex-direction:column;transition:border-color .2s}
.li:hover{border-color:rgba(168,85,247,.25)}
.lth{position:relative;aspect-ratio:9/16;overflow:hidden;background:#111}
.lth img{width:100%;height:100%;object-fit:cover;display:block}
.la{position:absolute;top:7px;left:7px;font-size:10px;font-weight:600;padding:2px 7px;border-radius:6px}
.la.old{background:rgba(255,0,80,.75);color:#fff}
.la.ok{background:rgba(0,255,198,.15);color:#00ffc6}
.lbd{padding:10px 12px 12px;flex:1;display:flex;flex-direction:column;gap:6px}
.ldesc{font-size:12px;color:#3a3a3a;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;flex:1}
.ldate{font-size:11px;color:#232323}
.lrm{min-height:30px;border-radius:8px;border:none;background:rgba(255,0,80,.07);color:#ff4466;font-size:11px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background .2s}
.lrm:hover{background:rgba(255,0,80,.14)}
.lemp{text-align:center;padding:60px 20px}
.lei{font-size:42px;margin-bottom:14px}
.let{font-size:13px;color:#1e1e1e;line-height:1.7}
@media(max-width:560px){
  .grid,.sg{grid-template-columns:repeat(2,1fr);gap:9px}
  .row{flex-direction:column}
  .inp{flex:1 1 100%}
  .btn{width:100%}
  .sc{padding:16px}
  .sbR{width:100%}
  .sbR .btn{flex:1}
}`;

export default function App() {
  const [tab,   setTab]   = useState<"search"|"library">("search");
  const [mode,  setMode]  = useState<Mode>("device");
  const [url,   setUrl]   = useState("");
  const [videos,setVideos]= useState<Video[]>([]);
  const [cursor,setCursor]= useState<string|null>(null);
  const [more,  setMore]  = useState(false);
  const [user,  setUser]  = useState("");
  const [skip,  setSkip]  = useState(0);
  const [loading, setLoading]   = useState(false);
  const [moreLoading, setMoreL] = useState(false);
  const [status,setStatus]= useState("");
  const [error, setError] = useState("");
  const [dlId,  setDlId]  = useState<string|null>(null);
  const [busy,  setBusy]  = useState(false);
  const [bDone, setBDone] = useState(0);
  const [bTotal,setBTotal]= useState(0);
  const [bLabel,setBLabel]= useState("");
  const [sort,  setSort]  = useState<Sort>("default");

  // ── SELECTION ─────────────────────────────────────────
  // مصفوفة بترتيب التحديد — functional updates فقط
  const [sel, setSel] = useState<string[]>([]);

  const toggleSel = useCallback((id: string) => {
    setSel(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const selectAll  = useCallback((vids: Video[]) => setSel(vids.map(v => String(v.id))), []);
  const clearSel   = useCallback(() => setSel([]), []);

  // ── LIBRARY ───────────────────────────────────────────
  // الحالة الوحيدة — functional updates + useEffect للحفظ
  const [lib, setLib] = useState<LibItem[]>(() => lsRead());

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(lib)); } catch {}
  }, [lib]);

  // إضافة دفعة — functional update يضمن قراءة أحدث قيمة
  const addBatch = useCallback((vs: Video[]) => {
    setLib(prev => {
      const existIds = new Set(prev.map(x => x.id));
      const now = Date.now();
      const fresh: LibItem[] = [];
      for (const v of vs) {
        const id = String(v.id);
        if (!existIds.has(id)) {
          existIds.add(id);
          fresh.push({ id, cover: v.cover || v.origin_cover, title: v.title || "بدون عنوان", savedAt: now });
        }
      }
      return fresh.length ? [...fresh, ...prev] : prev;
    });
  }, []);

  const addOne    = useCallback((v: Video) => addBatch([v]), [addBatch]);
  const isInLib   = useCallback((id: string) => lib.some(x => x.id === id), [lib]);
  const removeLib = useCallback((id: string) => setLib(prev => prev.filter(x => x.id !== id)), []);

  // ── fetch ─────────────────────────────────────────────
  const fetchPage = async (u: string, cur?: string) => {
    const qs = `endpoint=user/posts&unique_id=${u}&count=35${cur ? `&cursor=${cur}` : ""}`;
    const r = await fetch(`${API}?${qs}`);
    const d = await r.json();
    if (!d || d.code !== 0) throw new Error("تعذّر جلب البروفايل.");
    const all: Video[] = d.data?.videos || [];
    const filtered = all.filter(v => !v.duration || v.duration <= MAX_DUR);
    return { filtered, skipped: all.length - filtered.length, nextCursor: d.data?.cursor, hasMore: !!d.data?.hasMore };
  };

  const fetchProfile = useCallback(async (u: string) => {
    setLoading(true); setError(""); setVideos([]); setSkip(0);
    clearSel(); setCursor(null); setMore(false); setUser(u);
    setStatus(`جاري جلب فيديوهات @${u}...`);
    try {
      const pg = await fetchPage(u);
      if (!pg.filtered.length) throw new Error("لا توجد فيديوهات.");
      setVideos(pg.filtered); setSkip(pg.skipped);
      setCursor(pg.nextCursor || null); setMore(pg.hasMore);
      setStatus(`تم جلب ${pg.filtered.length} فيديو${pg.hasMore ? " · اضغط «تحميل المزيد»" : ""}`);
    } catch (e: any) { setError(e.message); setStatus(""); }
    finally { setLoading(false); }
  }, [clearSel]);

  const handleMore = async () => {
    if (!user || !cursor || moreLoading) return;
    setMoreL(true);
    try {
      const pg = await fetchPage(user, cursor);
      setVideos(prev => { const ids = new Set(prev.map(v => String(v.id))); return [...prev, ...pg.filtered.filter(v => !ids.has(String(v.id)))]; });
      setSkip(s => s + pg.skipped); setCursor(pg.nextCursor || null); setMore(pg.hasMore);
    } catch (e: any) { setError(e.message); }
    finally { setMoreL(false); }
  };

  const fetchSingle = useCallback(async (vUrl: string) => {
    setLoading(true); setError(""); setStatus("جاري جلب الفيديو...");
    try {
      const r = await fetch(`${API}?endpoint=&url=${encodeURIComponent(vUrl)}`);
      const d = await r.json();
      if (!d || d.code !== 0) throw new Error("تعذّر جلب الفيديو.");
      if (d.data?.duration > MAX_DUR) throw new Error("هذا الفيديو أطول من 5 دقائق.");
      setVideos([d.data]); setMore(false); setStatus("تم جلب الفيديو!");
    } catch (e: any) { setError(e.message); setStatus(""); }
    finally { setLoading(false); }
  }, []);

  const handleSearch = () => {
    const v = url.trim(); if (!v) return; setError("");
    if (isVidUrl(v)) fetchSingle(v);
    else { const u = parseUser(v); if (!u) { setError("أدخل رابط بروفايل: @username"); return; } fetchProfile(u); }
  };

  const sorted = [...videos].sort((a, b) => {
    if (sort === "views")    return b.play_count - a.play_count;
    if (sort === "likes")    return b.digg_count - a.digg_count;
    if (sort === "shortest") return a.duration - b.duration;
    if (sort === "longest")  return b.duration - a.duration;
    return 0;
  });

  // ── download ──────────────────────────────────────────
  const dlDevice = async (v: Video): Promise<boolean> => {
    const dlUrl = v.play || v.wmplay; if (!dlUrl) return false;
    try {
      const res = await fetch(`/api/download?url=${encodeURIComponent(dlUrl)}`);
      if (!res.ok) return false;
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = `tiktok_${v.id}.mp4`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(a.href); return true;
    } catch { return false; }
  };

  const dlOne = async (v: Video) => {
    setDlId(String(v.id)); setError("");
    if (mode === "library") { addOne(v); setDlId(null); return; }
    const ok = await dlDevice(v);
    if (ok) addOne(v); else setError("فشل التحميل.");
    setDlId(null);
  };

  // ── BULK: يستقبل currentSel كـ parameter ────────────
  // هذا الحل يضمن قراءة أحدث قيمة للتحديد وقت الضغط
  const bulkAction = async (currentSel: string[], currentMode: Mode) => {
    if (!currentSel.length) return;
    const vMap = new Map(videos.map(v => [String(v.id), v]));
    const toProcess = currentSel.map(id => vMap.get(id)).filter(Boolean) as Video[];
    if (!toProcess.length) return;

    setBusy(true); setBDone(0); setBTotal(toProcess.length); setError("");

    if (currentMode === "library") {
      setBLabel("جاري الحفظ في المكتبة...");
      addBatch(toProcess);           // functional update — يحفظ الكل
      setBDone(toProcess.length);
      await new Promise(r => setTimeout(r, 400));
      setBusy(false); setBLabel("");
      setStatus(`✅ تم حفظ ${toProcess.length} فيديو في المكتبة!`);
      clearSel();
      return;
    }

    let failed = 0;
    for (let i = 0; i < toProcess.length; i++) {
      setBLabel(`فيديو ${i + 1} من ${toProcess.length}`);
      const ok = await dlDevice(toProcess[i]);
      if (ok) addOne(toProcess[i]); else failed++;
      setBDone(i + 1);
      await new Promise(r => setTimeout(r, 700));
    }
    setBusy(false); setBLabel("");
    setStatus(`✅ تم تحميل ${toProcess.length - failed} فيديو!${failed > 0 ? ` (فشل ${failed})` : ""}`);
    clearSel();
  };

  const bPct     = bTotal > 0 ? Math.round((bDone / bTotal) * 100) : 0;
  const expiring = lib.filter(x => ago(x.savedAt) >= 25).length;
  const sorts: { k: Sort; l: string }[] = [
    { k: "default", l: "الافتراضي" }, { k: "views", l: "▶ الأكثر مشاهدة" },
    { k: "likes", l: "❤ الأكثر لايك" }, { k: "shortest", l: "⏱ الأقصر" }, { k: "longest", l: "⏱ الأطول" },
  ];

  return (
    <>
      <style>{CSS}</style>
      <div className="root">
        <div className="g1" /><div className="g2" />
        <div className="pg">
          <div className="hdr">
            <div className="logo">TIKLOAD</div>
            <div className="sub">تحميل فيديوهات تيك توك · بدون علامة مائية · تحت 5 دقائق</div>
          </div>

          <div className="tabs">
            <button className={`tab${tab === "search" ? " on" : ""}`} onClick={() => setTab("search")}>🔍 البحث</button>
            <button className={`tab${tab === "library" ? " on" : ""}`} onClick={() => setTab("library")}>
              {lib.length > 0 && <span className="tbadge">{lib.length}</span>}
              📁 مكتبتي
            </button>
          </div>

          {tab === "search" && <>
            <div className="mbar">
              <span className="mlab">وضع التحميل:</span>
              <div className="mopts">
                <button className={`mopt${mode === "device" ? " on" : ""}`} onClick={() => setMode("device")}>💾 على الجهاز</button>
                <button className={`mopt${mode === "library" ? " on lb" : ""}`} onClick={() => setMode("library")}>📁 في المكتبة</button>
              </div>
              <div className="mdesc">
                {mode === "device" ? "⬇ يحمّل على جهازك ويضيفه للمكتبة" : "📁 يحفظ في المكتبة — كل المحدد يُحفظ دفعة واحدة فوراً"}
              </div>
            </div>

            <div className="sc">
              <label className="fl">رابط البروفايل أو الفيديو</label>
              <div className="row">
                <input className="inp" dir="ltr" placeholder="tiktok.com/@username  أو رابط فيديو مباشر"
                  value={url} onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()} />
                <button className="btn bfe" onClick={handleSearch} disabled={loading || !url.trim()}>
                  {loading ? "جاري الجلب..." : "جلب الفيديوهات"}
                </button>
              </div>
              <div className="chips">
                {["@mrbeast", "@khaby.lame", "@charlidamelio"].map(ex => (
                  <span key={ex} className="chip" onClick={() => setUrl(ex)}>{ex}</span>
                ))}
              </div>
            </div>

            {error && <div className="al ae">⚠ {error}</div>}
            {status && !error && <div className="al as"><div className="dot" />{status}</div>}
            {skip > 0 && <div className="al ai">ℹ تم تخطي {skip} فيديو أطول من 5 دقائق</div>}

            {busy && (
              <div className="pcard">
                <div className="ph">
                  <span className="pt">{mode === "library" ? "📁 جاري الحفظ..." : "⬇ جاري التحميل..."} {bLabel}</span>
                  <span className="pp">{bDone}/{bTotal}</span>
                </div>
                <div className="ptr"><div className={`pf ${mode === "library" ? "lb" : "dv"}`} style={{ width: `${bPct}%` }} /></div>
                <div className="ps">{bPct}% مكتمل</div>
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
                {sorts.map(s => <button key={s.k} className={`fb${sort === s.k ? " on" : ""}`} onClick={() => setSort(s.k)}>{s.l}</button>)}
              </div>

              <div className="tbar">
                <div className="tbl">
                  <div><div className="vn">{videos.length}</div><div className="vl">فيديو</div></div>
                  <button className="btn bot bsm" onClick={() => selectAll(videos)} disabled={busy}>تحديد الكل</button>
                  {sel.length > 0 && <button className="btn bot bsm" onClick={clearSel} disabled={busy}>✕ إلغاء</button>}
                </div>
              </div>

              {sel.length > 0 && (
                <div className="sbar">
                  <div className="sbL">
                    <div>
                      <div className={`sc2 ${mode === "library" ? "lb" : "dv"}`}>{sel.length}</div>
                      <div className="st">فيديو محدد — اضغط الصورة لإضافة/إزالة</div>
                    </div>
                  </div>
                  <div className="sbR">
                    {mode === "library"
                      ? <button className="btn blb bsm" onClick={() => bulkAction(sel, mode)} disabled={busy}>
                          {busy ? `📁 ${bPct}%` : `📁 حفظ ${sel.length} في المكتبة`}
                        </button>
                      : <button className="btn bdv bsm" onClick={() => bulkAction(sel, mode)} disabled={busy}>
                          {busy ? `⬇ ${bPct}%` : `⬇ تحميل ${sel.length} فيديو`}
                        </button>
                    }
                  </div>
                </div>
              )}

              <div className="grid">
                {sorted.map(v => {
                  const id   = String(v.id);
                  const idx  = sel.indexOf(id);
                  const isSel = idx !== -1;
                  const isDl  = dlId === id;
                  const inLib = isInLib(id);
                  return (
                    <div key={id} className={`card${isSel ? (mode === "library" ? " slb" : " sdv") : ""}`}>
                      {/* الصورة = منطقة التحديد */}
                      <div className="thumb" onClick={() => { if (!busy && !isDl) toggleSel(id); }}>
                        <img src={v.cover || v.origin_cover} alt="" loading="lazy"
                          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        {v.duration > 0 && <div className="dur">{fmtDur(v.duration)}</div>}
                        <div className="ck"><span className="ct">✓</span></div>
                        {isSel && <div className="sord">{idx + 1}</div>}
                      </div>
                      <div className="cbody">
                        <div className="cst"><span>❤ {fmt(v.digg_count)}</span><span>▶ {fmt(v.play_count)}</span></div>
                        <div className="cdesc">{v.title || "بدون عنوان"}</div>
                      </div>
                      <div className="cfoot">
                        {mode === "library" ? (
                          inLib
                            ? <div className="ilt">✓ محفوظ</div>
                            : <button className="dlb lo" onClick={() => dlOne(v)} disabled={isDl || busy}>
                                {isDl ? "⏳..." : "📁 حفظ"}
                              </button>
                        ) : (
                          <>
                            <button className="dlb dv" onClick={() => dlOne(v)} disabled={isDl || busy}>
                              {isDl ? "⏳ جاري..." : "⬇ تحميل"}
                            </button>
                            {inLib
                              ? <div className="ilt">✓ في المكتبة</div>
                              : <button className="dlb lo" onClick={() => addOne(v)} disabled={busy}>📁 حفظ فقط</button>
                            }
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {more && (
                <div className="lmw">
                  <button className="btn bmo" onClick={handleMore} disabled={moreLoading}>
                    {moreLoading ? "جاري التحميل..." : "⬇ تحميل المزيد"}
                  </button>
                </div>
              )}
            </>}

            {!loading && videos.length === 0 && !error && (
              <div className="emp">
                <div className="ei">🎬</div>
                <div className="et">ابدأ من هنا</div>
                <div className="es">أدخل رابط بروفايل تيك توك أو فيديو مباشر</div>
              </div>
            )}
          </>}

          {tab === "library" && <>
            {expiring > 0 && <div className="al aw">⚠ {expiring} فيديو ستُحذف تلقائياً خلال أقل من 5 أيام</div>}
            <div className="lhdr">
              <div className="lt">📁 مكتبتي ({lib.length})</div>
              {lib.length > 0 && (
                <button className="btn bot bsm" onClick={() => { if (confirm("مسح المكتبة كاملة؟")) setLib([]); }}>🗑 مسح الكل</button>
              )}
            </div>
            {lib.length > 0 && (
              <div className="lstats">
                <div className="lstat"><div className="lsn">{lib.length}</div><div className="lsl">محفوظ</div></div>
                <div className="lstat"><div className="lsn">{lib.filter(x => ago(x.savedAt) < 7).length}</div><div className="lsl">هذا الأسبوع</div></div>
                <div className="lstat"><div className="lsn">{expiring}</div><div className="lsl">تنتهي قريباً</div></div>
              </div>
            )}
            {lib.length === 0 ? (
              <div className="lemp">
                <div className="lei">📭</div>
                <div className="let">لم تحفظ أي فيديو بعد.<br />استخدم "حفظ في المكتبة" وستظهر هنا.</div>
              </div>
            ) : (
              <div className="grid">
                {lib.map(item => {
                  const d = ago(item.savedAt);
                  return (
                    <div key={item.id} className="li">
                      <div className="lth">
                        <img src={item.cover} alt="" loading="lazy"
                          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        <div className={`la ${d >= 25 ? "old" : "ok"}`}>{d === 0 ? "اليوم" : `${d} يوم`}</div>
                      </div>
                      <div className="lbd">
                        <div className="ldesc">{item.title}</div>
                        <div className="ldate">📅 منذ {d} يوم</div>
                        <button className="lrm" onClick={() => removeLib(item.id)}>✕ إزالة</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>}
        </div>
      </div>
    </>
  );
}
