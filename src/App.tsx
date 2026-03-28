import { useState, useCallback, useEffect, useRef } from "react";

const TIKWM_API = "/api/tikwm";
const MAX_DURATION = 5 * 60;
const LIBRARY_KEY = "tikload_library";
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #080808; color: #e8e8e8; font-family: 'DM Sans', sans-serif; min-height: 100vh; -webkit-font-smoothing: antialiased; }
  .app { min-height: 100vh; background: #080808; }
  .glow1 { position: fixed; width: 700px; height: 700px; border-radius: 50%; background: radial-gradient(circle, rgba(0,255,198,0.05) 0%, transparent 65%); top: -250px; left: -250px; pointer-events: none; z-index: 0; }
  .glow2 { position: fixed; width: 500px; height: 500px; border-radius: 50%; background: radial-gradient(circle, rgba(255,0,80,0.04) 0%, transparent 65%); bottom: -150px; right: -150px; pointer-events: none; z-index: 0; }
  .page { max-width: 1140px; margin: 0 auto; padding: 40px 20px 80px; position: relative; z-index: 1; }

  .header { text-align: center; margin-bottom: 36px; }
  .logo { font-family: 'Bebas Neue', cursive; font-size: clamp(58px, 9vw, 96px); letter-spacing: 6px; line-height: 1; background: linear-gradient(135deg, #fff 0%, #00ffc6 45%, #ff0050 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 8px; }
  .tagline { font-size: 12px; letter-spacing: 3px; text-transform: uppercase; color: #333; }

  .nav { display: flex; gap: 4px; margin-bottom: 28px; background: #0d0d0d; border: 1px solid #1a1a1a; border-radius: 14px; padding: 5px; width: fit-content; }
  .nav-btn { padding: 9px 22px; border-radius: 10px; border: none; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all .2s; background: transparent; color: #444; display: flex; align-items: center; gap: 6px; }
  .nav-btn.active { background: #161616; color: #e8e8e8; }
  .nav-badge { min-width: 18px; height: 18px; border-radius: 99px; background: #00ffc6; color: #000; font-size: 10px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; padding: 0 5px; }

  .mode-bar { display: flex; align-items: center; gap: 10px; background: #0d0d0d; border: 1px solid #1a1a1a; border-radius: 14px; padding: 14px 20px; margin-bottom: 18px; flex-wrap: wrap; }
  .mode-label { font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #2e2e2e; flex-shrink: 0; }
  .mode-options { display: flex; gap: 6px; }
  .mode-opt { padding: 7px 16px; border-radius: 10px; border: 1px solid #1c1c1c; background: transparent; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; color: #444; cursor: pointer; transition: all .2s; }
  .mode-opt:hover { border-color: #2a2a2a; color: #777; }
  .mode-opt.active { background: #111; border-color: #00ffc6; color: #00ffc6; }
  .mode-opt.active.lib { border-color: #a855f7; color: #a855f7; background: rgba(168,85,247,.06); }
  .mode-desc { font-size: 12px; color: #2a2a2a; width: 100%; margin-top: 4px; }

  .search-card { background: #0f0f0f; border: 1px solid #1c1c1c; border-radius: 18px; padding: 24px 28px; margin-bottom: 18px; transition: border-color .25s; }
  .search-card:focus-within { border-color: #00ffc6; }
  .field-label { display: block; font-size: 10px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; color: #2a2a2a; margin-bottom: 12px; }
  .row { display: flex; gap: 10px; align-items: stretch; flex-wrap: wrap; }
  .input { flex: 1 1 240px; background: #080808; border: 1px solid #1c1c1c; border-radius: 11px; padding: 12px 16px; color: #e8e8e8; font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color .2s; min-height: 46px; }
  .input:focus { border-color: #00ffc6; }
  .input::placeholder { color: #222; }
  .chips { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 12px; }
  .chip-label { font-size: 11px; color: #222; }
  .chip { font-size: 12px; padding: 4px 13px; background: #0a0a0a; border: 1px solid #181818; border-radius: 99px; color: #2e2e2e; cursor: pointer; transition: all .2s; }
  .chip:hover { border-color: #2a2a2a; color: #666; }

  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 0 22px; min-height: 46px; border: none; border-radius: 11px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all .2s; white-space: nowrap; }
  .btn:disabled { opacity: .3; cursor: not-allowed !important; transform: none !important; }
  .btn-fetch { background: linear-gradient(135deg,#00ffc6,#00b4ff); color: #000; }
  .btn-fetch:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,255,198,.28); }
  .btn-bulk { background: linear-gradient(135deg,#ff0050,#ff4d00); color: #fff; }
  .btn-bulk:not(:disabled):hover { transform: translateY(-1px); }
  .btn-lib-bulk { background: linear-gradient(135deg,#a855f7,#6366f1); color: #fff; }
  .btn-lib-bulk:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(168,85,247,.28); }
  .btn-more { background: #111; color: #555; border: 1px solid #1e1e1e; }
  .btn-more:not(:disabled):hover { border-color: #333; color: #999; }
  .btn-outline { background: transparent; color: #555; border: 1px solid #1c1c1c; }
  .btn-outline:not(:disabled):hover { border-color: #333; color: #999; }
  .btn-sm { padding: 0 14px; min-height: 34px; font-size: 12px; border-radius: 9px; }

  .filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 18px; }
  .filter-label { font-size: 10px; color: #2a2a2a; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; }
  .filter-btn { padding: 6px 13px; border-radius: 99px; border: 1px solid #181818; background: transparent; color: #383838; font-family: 'DM Sans', sans-serif; font-size: 12px; cursor: pointer; transition: all .2s; }
  .filter-btn:hover { border-color: #2a2a2a; color: #777; }
  .filter-btn.active { background: #141414; border-color: #00ffc6; color: #00ffc6; }

  .alert { display: flex; align-items: flex-start; gap: 10px; padding: 12px 16px; border-radius: 11px; font-size: 13px; margin-bottom: 14px; line-height: 1.5; }
  .alert-error { background: rgba(255,0,80,.05); border: 1px solid rgba(255,0,80,.15); color: #ff6685; }
  .alert-info { background: rgba(0,255,198,.04); border: 1px solid rgba(0,255,198,.1); color: #00e6b0; }
  .alert-status { background: #0f0f0f; border: 1px solid #1c1c1c; color: #555; }
  .alert-warn { background: rgba(255,180,0,.04); border: 1px solid rgba(255,180,0,.12); color: #c8950a; }
  .pulse-dot { width: 7px; height: 7px; border-radius: 50%; background: #00ffc6; flex-shrink: 0; margin-top: 3px; animation: pulse 1.6s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.2} }

  .progress-card { background: #0f0f0f; border: 1px solid #1c1c1c; border-radius: 14px; padding: 18px 22px; margin-bottom: 18px; }
  .progress-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .progress-title { font-size: 13px; font-weight: 600; color: #bbb; }
  .progress-pct-txt { font-size: 13px; color: #555; }
  .progress-track { height: 5px; background: #161616; border-radius: 99px; overflow: hidden; margin-bottom: 6px; }
  .progress-fill { height: 100%; border-radius: 99px; transition: width .3s; }
  .progress-fill.device { background: linear-gradient(90deg,#00ffc6,#00b4ff); }
  .progress-fill.library { background: linear-gradient(90deg,#a855f7,#6366f1); }
  .progress-sub { font-size: 11px; color: #2e2e2e; }

  /* SELECTION BAR */
  .sel-bar { background: #0d0d0d; border: 1px solid #1a1a1a; border-radius: 14px; padding: 14px 18px; margin-bottom: 18px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
  .sel-bar-left { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .sel-bar-right { display: flex; gap: 8px; flex-wrap: wrap; }
  .sel-count { font-family: 'Bebas Neue', cursive; font-size: 22px; color: #00ffc6; letter-spacing: 1px; }
  .sel-label { font-size: 12px; color: #333; }
  .sel-hint { font-size: 11px; color: #252525; width: 100%; margin-top: 2px; }

  .toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 18px; }
  .toolbar-left { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .stat-num { font-family: 'Bebas Neue', cursive; font-size: 30px; letter-spacing: 1px; color: #00ffc6; line-height: 1; }
  .stat-label { font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #252525; }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(188px, 1fr)); gap: 13px; }

  /* CARD */
  .card { background: #0d0d0d; border: 2px solid transparent; border-radius: 15px; overflow: hidden; cursor: pointer; transition: border-color .2s, transform .2s, box-shadow .2s; display: flex; flex-direction: column; user-select: none; position: relative; }
  .card:hover { transform: translateY(-2px); border-color: #1e1e1e; }
  .card.sel { border-color: #00ffc6; box-shadow: 0 0 18px rgba(0,255,198,.12); }
  .card.sel-lib { border-color: #a855f7; box-shadow: 0 0 18px rgba(168,85,247,.12); }

  .thumb { position: relative; aspect-ratio: 9/16; overflow: hidden; background: #111; flex-shrink: 0; }
  .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .3s; }
  .card:hover .thumb img { transform: scale(1.05); }
  .dur { position: absolute; bottom: 7px; left: 7px; background: rgba(0,0,0,.72); backdrop-filter: blur(6px); color: #fff; font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 6px; }

  /* CHECK CIRCLE */
  .check { position: absolute; top: 8px; right: 8px; width: 26px; height: 26px; border-radius: 50%; background: rgba(0,0,0,.55); border: 2px solid #2a2a2a; display: flex; align-items: center; justify-content: center; transition: all .18s; z-index: 2; }
  .card.sel .check { background: #00ffc6; border-color: #00ffc6; }
  .card.sel-lib .check { background: #a855f7; border-color: #a855f7; }
  .check-tick { font-size: 13px; font-weight: 800; color: #000; opacity: 0; transition: opacity .18s; }
  .card.sel .check-tick, .card.sel-lib .check-tick { opacity: 1; }

  /* SEL NUMBER on card */
  .sel-num { position: absolute; top: 8px; left: 8px; min-width: 22px; height: 22px; border-radius: 99px; background: #00ffc6; color: #000; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; padding: 0 5px; z-index: 2; }
  .card.sel-lib .sel-num { background: #a855f7; color: #fff; }

  .card-body { padding: 10px 12px 5px; flex: 1; }
  .card-stats { display: flex; gap: 10px; font-size: 11px; color: #333; margin-bottom: 5px; }
  .card-desc { font-size: 12px; color: #3e3e3e; line-height: 1.4; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .card-footer { padding: 7px 11px 11px; display: flex; flex-direction: column; gap: 5px; }
  .dl-btn { width: 100%; min-height: 34px; border-radius: 9px; font-size: 12px; font-weight: 600; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all .2s; }
  .dl-btn:disabled { opacity: .3; cursor: not-allowed; }
  .dl-btn.device { background: linear-gradient(135deg,#00ffc6,#00b4ff); color: #000; }
  .dl-btn.device:not(:disabled):hover { transform: translateY(-1px); }
  .dl-btn.lib-only { background: rgba(168,85,247,.1); color: #a855f7; border: 1px solid rgba(168,85,247,.2); }
  .dl-btn.lib-only:not(:disabled):hover { background: rgba(168,85,247,.18); }
  .in-lib-tag { width: 100%; min-height: 28px; border-radius: 8px; font-size: 11px; font-weight: 600; border: 1px solid rgba(0,255,198,.15); background: rgba(0,255,198,.04); color: #00a87a; display: flex; align-items: center; justify-content: center; gap: 5px; }

  .load-more-wrap { display: flex; justify-content: center; margin-top: 28px; }

  .skel-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(188px, 1fr)); gap: 13px; }
  .skel { background: #0d0d0d; border-radius: 15px; overflow: hidden; }
  .skel-thumb { aspect-ratio: 9/16; background: linear-gradient(90deg,#0d0d0d 25%,#141414 50%,#0d0d0d 75%); background-size: 200% 100%; animation: shim 1.4s infinite; }
  .skel-line { height: 9px; margin: 10px 12px 0; border-radius: 5px; background: linear-gradient(90deg,#0d0d0d 25%,#141414 50%,#0d0d0d 75%); background-size: 200% 100%; animation: shim 1.4s infinite; }
  .skel-line.s { width: 55%; margin-bottom: 11px; }
  @keyframes shim { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

  .empty { text-align: center; padding: 80px 20px; }
  .empty-ico { font-size: 50px; margin-bottom: 16px; }
  .empty-title { font-family: 'Bebas Neue', cursive; font-size: 34px; letter-spacing: 2px; color: #1c1c1c; margin-bottom: 6px; }
  .empty-sub { font-size: 13px; color: #222; }

  .lib-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 10px; }
  .lib-title { font-family: 'Bebas Neue', cursive; font-size: 26px; letter-spacing: 2px; color: #3a3a3a; }
  .lib-stats { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
  .lib-stat { background: #0d0d0d; border: 1px solid #141414; border-radius: 11px; padding: 12px 18px; }
  .lib-stat-num { font-family: 'Bebas Neue', cursive; font-size: 24px; color: #a855f7; }
  .lib-stat-label { font-size: 11px; color: #2a2a2a; }
  .lib-item { background: #0d0d0d; border: 1px solid #141414; border-radius: 13px; overflow: hidden; display: flex; flex-direction: column; transition: border-color .2s; }
  .lib-item:hover { border-color: rgba(168,85,247,.25); }
  .lib-thumb { position: relative; aspect-ratio: 9/16; overflow: hidden; background: #111; }
  .lib-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .lib-age { position: absolute; top: 7px; left: 7px; font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 6px; }
  .lib-age.old { background: rgba(255,0,80,.75); color: #fff; }
  .lib-age.ok { background: rgba(0,255,198,.15); color: #00ffc6; }
  .lib-body { padding: 10px 12px 12px; flex: 1; display: flex; flex-direction: column; gap: 6px; }
  .lib-desc { font-size: 12px; color: #3a3a3a; line-height: 1.4; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; flex: 1; }
  .lib-date { font-size: 11px; color: #232323; }
  .lib-remove { min-height: 30px; border-radius: 8px; border: none; background: rgba(255,0,80,.07); color: #ff4466; font-size: 11px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: background .2s; }
  .lib-remove:hover { background: rgba(255,0,80,.14); }
  .lib-empty { text-align: center; padding: 60px 20px; }
  .lib-empty-ico { font-size: 42px; margin-bottom: 14px; }
  .lib-empty-text { font-size: 13px; color: #1e1e1e; line-height: 1.7; }

  @media (max-width: 560px) {
    .grid, .skel-grid { grid-template-columns: repeat(2, 1fr); gap: 9px; }
    .row { flex-direction: column; }
    .input { flex: 1 1 100%; }
    .btn { width: 100%; }
    .search-card { padding: 16px; }
    .sel-bar-right { width: 100%; }
    .sel-bar-right .btn { flex: 1; }
  }
`;

type Video = { id: string; cover: string; origin_cover: string; title: string; duration: number; play: string; wmplay: string; digg_count: number; play_count: number; };
type LibItem = { id: string; cover: string; title: string; savedAt: number; };
type SortKey = "default"|"views"|"likes"|"shortest"|"longest";
type DlMode = "device"|"library";

const fmt = (n: number) => !n?"0":n>=1e6?(n/1e6).toFixed(1)+"M":n>=1000?(n/1000).toFixed(1)+"K":String(n);
const fmtDur = (s: number) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,"0")}`;
const daysAgo = (ts: number) => Math.floor((Date.now()-ts)/86400000);

function parseUsername(v: string) {
  v = v.trim();
  const m = v.match(/tiktok\.com\/@([^/?&]+)/);
  if (m) return m[1];
  if (v.startsWith("@")) return v.slice(1);
  if (!v.includes("/")&&!v.includes(".")) return v;
  return null;
}
const isVideoUrl = (v: string) => v.includes("tiktok.com")&&v.includes("/video/");

function loadLibrary(): LibItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LIBRARY_KEY)||"[]") as LibItem[];
    return raw.filter(x=>(Date.now()-x.savedAt)<ONE_MONTH_MS);
  } catch { return []; }
}

export default function App() {
  const [tab, setTab] = useState<"search"|"library">("search");
  const [dlMode, setDlMode] = useState<DlMode>("device");
  const [url, setUrl] = useState("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [cursor, setCursor] = useState<string|null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [currentUser, setCurrentUser] = useState("");
  const [skipped, setSkipped] = useState(0);

  // ===== SELECTION: مصفوفة مرتبة بترتيب التحديد =====
  const [selOrder, setSelOrder] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [dlId, setDlId] = useState<string|null>(null);
  const [bulkActive, setBulkActive] = useState(false);
  const [bulkDone, setBulkDone] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkLabel, setBulkLabel] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [library, setLibrary] = useState<LibItem[]>(()=>loadLibrary());

  const libraryRef = useRef(library);
  useEffect(()=>{ libraryRef.current=library; },[library]);

  useEffect(()=>{
    const cleaned = library.filter(x=>(Date.now()-x.savedAt)<ONE_MONTH_MS);
    try { localStorage.setItem(LIBRARY_KEY,JSON.stringify(cleaned)); } catch {}
  },[library]);

  const isInLib = (id: string) => libraryRef.current.some(x=>x.id===id);

  const addBatchToLib = useCallback((vs: Video[]) => {
    const now = Date.now();
    setLibrary(prev=>{
      const existIds = new Set(prev.map(x=>x.id));
      const newItems: LibItem[] = [];
      for (const v of vs) {
        const id = String(v.id);
        if (!existIds.has(id)) {
          existIds.add(id);
          newItems.push({ id, cover: v.cover||v.origin_cover, title: v.title||"بدون عنوان", savedAt: now });
        }
      }
      return newItems.length ? [...newItems,...prev] : prev;
    });
  },[]);

  const addToLib = useCallback((v: Video) => { addBatchToLib([v]); },[addBatchToLib]);

  // ===== تحديد/إلغاء فيديو واحد =====
  const toggleSel = (id: string) => {
    setSelOrder(prev =>
      prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]
    );
  };

  // ===== تحديد الكل / إلغاء الكل =====
  const toggleAll = () => {
    if (selOrder.length === videos.length) {
      setSelOrder([]);
    } else {
      setSelOrder(videos.map(v=>String(v.id)));
    }
  };

  // ===== إلغاء التحديد =====
  const clearSel = () => setSelOrder([]);

  const fetchPage = async (username: string, cur?: string) => {
    const params = `endpoint=user/posts&unique_id=${username}&count=35${cur?`&cursor=${cur}`:""}`;
    const r = await fetch(`${TIKWM_API}?${params}`);
    const d = await r.json();
    if (!d||d.code!==0) throw new Error("تعذّر جلب البروفايل.");
    const all: Video[] = d.data?.videos||[];
    const filtered = all.filter(v=>!v.duration||v.duration<=MAX_DURATION);
    return { filtered, skippedCount: all.length-filtered.length, nextCursor: d.data?.cursor, more: !!d.data?.hasMore };
  };

  const fetchProfile = useCallback(async (username: string) => {
    setLoading(true); setError(""); setVideos([]); setSkipped(0); setSelOrder([]);
    setCursor(null); setHasMore(false); setCurrentUser(username);
    setStatus(`جاري جلب فيديوهات @${username}...`);
    try {
      const {filtered,skippedCount,nextCursor,more} = await fetchPage(username);
      if (!filtered.length) throw new Error("لا توجد فيديوهات في هذا الحساب.");
      setVideos(filtered); setSkipped(skippedCount);
      setCursor(nextCursor||null); setHasMore(more);
      setStatus(`تم جلب ${filtered.length} فيديو من @${username}${more?" · اضغط تحميل المزيد":""}`);
    } catch(e:any){ setError(e.message); setStatus(""); }
    finally { setLoading(false); }
  },[]);

  const loadMore = async () => {
    if (!currentUser||!cursor||loadingMore) return;
    setLoadingMore(true);
    try {
      const {filtered,skippedCount,nextCursor,more} = await fetchPage(currentUser,cursor);
      setVideos(prev=>{
        const existIds = new Set(prev.map(v=>String(v.id)));
        return [...prev,...filtered.filter(v=>!existIds.has(String(v.id)))];
      });
      setSkipped(p=>p+skippedCount);
      setCursor(nextCursor||null); setHasMore(more);
    } catch(e:any){ setError(e.message); }
    finally { setLoadingMore(false); }
  };

  const fetchSingle = useCallback(async (videoUrl: string) => {
    setLoading(true); setError(""); setStatus("جاري جلب الفيديو...");
    try {
      const r = await fetch(`${TIKWM_API}?endpoint=&url=${encodeURIComponent(videoUrl)}`);
      const d = await r.json();
      if (!d||d.code!==0) throw new Error("تعذّر جلب الفيديو.");
      if (d.data?.duration>MAX_DURATION) throw new Error("هذا الفيديو أطول من 5 دقائق.");
      setVideos([d.data]); setHasMore(false); setStatus("تم جلب الفيديو بنجاح!");
    } catch(e:any){ setError(e.message); setStatus(""); }
    finally { setLoading(false); }
  },[]);

  const handleSearch = () => {
    const v=url.trim(); if (!v) return; setError("");
    if (isVideoUrl(v)) fetchSingle(v);
    else { const u=parseUsername(v); if (!u){setError("أدخل رابط بروفايل مثل: @username");return;} fetchProfile(u); }
  };

  const sortedVideos = [...videos].sort((a,b)=>{
    if (sortKey==="views") return b.play_count-a.play_count;
    if (sortKey==="likes") return b.digg_count-a.digg_count;
    if (sortKey==="shortest") return a.duration-b.duration;
    if (sortKey==="longest") return b.duration-a.duration;
    return 0;
  });

  const downloadToDevice = async (video: Video): Promise<boolean> => {
    const dlUrl = video.play||video.wmplay;
    if (!dlUrl) return false;
    try {
      const res = await fetch(`/api/download?url=${encodeURIComponent(dlUrl)}`);
      if (!res.ok) return false;
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `tiktok_${video.id}.mp4`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(a.href);
      return true;
    } catch { return false; }
  };

  const downloadOne = async (video: Video) => {
    const id = String(video.id);
    setDlId(id); setError("");
    if (dlMode==="library") { addToLib(video); setDlId(null); return; }
    const ok = await downloadToDevice(video);
    if (ok) addToLib(video); else setError("فشل تحميل الفيديو.");
    setDlId(null);
  };

  // ===== تحميل/حفظ المحدد =====
  const downloadBulk = async () => {
    // الفيديوهات المحددة بترتيب التحديد
    const videoMap = new Map(videos.map(v=>[String(v.id),v]));
    const toProcess = selOrder.map(id=>videoMap.get(id)).filter(Boolean) as Video[];
    if (!toProcess.length) return;

    setBulkActive(true); setBulkDone(0); setBulkTotal(toProcess.length); setError("");

    if (dlMode==="library") {
      setBulkLabel("جاري الحفظ في المكتبة...");
      // حفظ كل المحدد دفعة واحدة فوراً
      addBatchToLib(toProcess);
      setBulkDone(toProcess.length);
      await new Promise(r=>setTimeout(r,500));
      setBulkActive(false); setBulkLabel("");
      setStatus(`✅ تم حفظ ${toProcess.length} فيديو في المكتبة!`);
      setSelOrder([]);
      return;
    }

    // تحميل على الجهاز واحد ورا واحد
    let failed = 0;
    for (let i=0; i<toProcess.length; i++) {
      setBulkLabel(`فيديو ${i+1} من ${toProcess.length}`);
      const ok = await downloadToDevice(toProcess[i]);
      if (ok) addToLib(toProcess[i]); else failed++;
      setBulkDone(i+1);
      await new Promise(r=>setTimeout(r,700));
    }
    setBulkActive(false); setBulkLabel("");
    setStatus(`✅ تم تحميل ${toProcess.length-failed} فيديو!${failed>0?` (فشل ${failed})`:""}`);
    setSelOrder([]);
  };

  const bulkPct = bulkTotal>0 ? Math.round((bulkDone/bulkTotal)*100) : 0;
  const sorts: {key:SortKey;label:string}[] = [
    {key:"default",label:"الافتراضي"},{key:"views",label:"▶ الأكثر مشاهدة"},
    {key:"likes",label:"❤ الأكثر لايك"},{key:"shortest",label:"⏱ الأقصر"},{key:"longest",label:"⏱ الأطول"},
  ];
  const expiringSoon = library.filter(x=>daysAgo(x.savedAt)>=25).length;

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <div className="glow1"/><div className="glow2"/>
        <div className="page">
          <div className="header">
            <div className="logo">TIKLOAD</div>
            <div className="tagline">تحميل فيديوهات تيك توك · بدون علامة مائية · تحت 5 دقائق</div>
          </div>

          <div className="nav">
            <button className={`nav-btn${tab==="search"?" active":""}`} onClick={()=>setTab("search")}>🔍 البحث</button>
            <button className={`nav-btn${tab==="library"?" active":""}`} onClick={()=>setTab("library")}>
              {library.length>0&&<span className="nav-badge">{library.length}</span>}
              📁 مكتبتي
            </button>
          </div>

          {tab==="search" && <>
            <div className="mode-bar">
              <span className="mode-label">وضع التحميل:</span>
              <div className="mode-options">
                <button className={`mode-opt${dlMode==="device"?" active":""}`} onClick={()=>setDlMode("device")}>💾 على الجهاز</button>
                <button className={`mode-opt${dlMode==="library"?" active lib":""}`} onClick={()=>setDlMode("library")}>📁 في المكتبة فقط</button>
              </div>
              <div className="mode-desc">
                {dlMode==="device"?"⬇ يحمّل على جهازك ويضيفه للمكتبة تلقائياً":"📁 يحفظ في المكتبة فقط — فوري لكل الفيديوهات المحددة"}
              </div>
            </div>

            <div className="search-card">
              <label className="field-label">رابط البروفايل أو الفيديو</label>
              <div className="row">
                <input className="input" dir="ltr" placeholder="tiktok.com/@username  أو رابط فيديو مباشر"
                  value={url} onChange={e=>setUrl(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&handleSearch()}/>
                <button className="btn btn-fetch" onClick={handleSearch} disabled={loading||!url.trim()}>
                  {loading?"جاري الجلب...":"جلب الفيديوهات"}
                </button>
              </div>
              <div className="chips">
                <span className="chip-label">أمثلة:</span>
                {["@mrbeast","@khaby.lame","@charlidamelio"].map(ex=>(
                  <span key={ex} className="chip" onClick={()=>setUrl(ex)}>{ex}</span>
                ))}
              </div>
            </div>

            {error&&<div className="alert alert-error">⚠ {error}</div>}
            {status&&!error&&<div className="alert alert-status"><div className="pulse-dot"/>{status}</div>}
            {skipped>0&&<div className="alert alert-info">ℹ تم تخطي {skipped} فيديو أطول من 5 دقائق</div>}

            {bulkActive&&(
              <div className="progress-card">
                <div className="progress-head">
                  <span className="progress-title">{dlMode==="library"?"📁 جاري الحفظ...":"⬇ جاري التحميل..."} {bulkLabel}</span>
                  <span className="progress-pct-txt">{bulkDone}/{bulkTotal}</span>
                </div>
                <div className="progress-track">
                  <div className={`progress-fill ${dlMode}`} style={{width:`${bulkPct}%`}}/>
                </div>
                <div className="progress-sub">{bulkPct}% مكتمل</div>
              </div>
            )}

            {loading&&(
              <div className="skel-grid">
                {Array.from({length:8}).map((_,i)=>(
                  <div className="skel" key={i}><div className="skel-thumb"/><div className="skel-line"/><div className="skel-line s"/></div>
                ))}
              </div>
            )}

            {!loading&&videos.length>0&&<>
              <div className="filters">
                <span className="filter-label">ترتيب:</span>
                {sorts.map(s=>(
                  <button key={s.key} className={`filter-btn${sortKey===s.key?" active":""}`} onClick={()=>setSortKey(s.key)}>{s.label}</button>
                ))}
              </div>

              <div className="toolbar">
                <div className="toolbar-left">
                  <div><div className="stat-num">{videos.length}</div><div className="stat-label">فيديو</div></div>
                  <button className="btn btn-outline btn-sm" onClick={toggleAll} disabled={bulkActive}>
                    {selOrder.length===videos.length?"إلغاء الكل":"تحديد الكل"}
                  </button>
                  {selOrder.length>0&&(
                    <button className="btn btn-outline btn-sm" onClick={clearSel} disabled={bulkActive}>✕ إلغاء التحديد</button>
                  )}
                </div>
              </div>

              {/* شريط التحديد والعمليات */}
              {selOrder.length>0&&(
                <div className="sel-bar">
                  <div className="sel-bar-left">
                    <div>
                      <div className="sel-count">{selOrder.length}</div>
                      <div className="sel-label">فيديو محدد</div>
                    </div>
                    <div className="sel-hint">اضغط على الفيديو لإضافته أو إزالته من التحديد</div>
                  </div>
                  <div className="sel-bar-right">
                    {dlMode==="library"?(
                      <button className="btn btn-lib-bulk btn-sm" onClick={downloadBulk} disabled={bulkActive}>
                        {bulkActive?`📁 ${bulkPct}%`:`📁 حفظ ${selOrder.length} في المكتبة`}
                      </button>
                    ):(
                      <button className="btn btn-bulk btn-sm" onClick={downloadBulk} disabled={bulkActive}>
                        {bulkActive?`⬇ ${bulkPct}%`:`⬇ تحميل ${selOrder.length} فيديو`}
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="grid">
                {sortedVideos.map(v=>{
                  const id=String(v.id);
                  const selIdx = selOrder.indexOf(id); // ترتيب التحديد (-1 لو مش محدد)
                  const isSel = selIdx !== -1;
                  const isDling = dlId===id;
                  const inLib = isInLib(id);
                  const cardClass = `card${isSel?(dlMode==="library"?" sel-lib":" sel"):""}`;
                  return (
                    <div key={id} className={cardClass}
                      onClick={()=>!bulkActive&&!isDling&&toggleSel(id)}>
                      <div className="thumb">
                        <img src={v.cover||v.origin_cover} alt="" loading="lazy"
                          onError={e=>{(e.target as HTMLImageElement).style.display="none";}}/>
                        {v.duration>0&&<div className="dur">{fmtDur(v.duration)}</div>}
                        <div className="check"><span className="check-tick">✓</span></div>
                        {/* رقم ترتيب التحديد */}
                        {isSel&&<div className="sel-num">{selIdx+1}</div>}
                      </div>
                      <div className="card-body">
                        <div className="card-stats"><span>❤ {fmt(v.digg_count)}</span><span>▶ {fmt(v.play_count)}</span></div>
                        <div className="card-desc">{v.title||"بدون عنوان"}</div>
                      </div>
                      <div className="card-footer">
                        <button className={`dl-btn ${dlMode==="library"?"lib-only":"device"}`}
                          onClick={e=>{e.stopPropagation();downloadOne(v);}}
                          disabled={isDling||bulkActive||(dlMode==="library"&&inLib)}>
                          {isDling?"⏳ جاري...":dlMode==="library"?(inLib?"✓ محفوظ":"📁 حفظ في المكتبة"):"⬇ تحميل"}
                        </button>
                        {dlMode==="device"&&(
                          inLib
                            ?<div className="in-lib-tag">✓ في المكتبة</div>
                            :<button className="dl-btn lib-only"
                                onClick={e=>{e.stopPropagation();addToLib(v);}}
                                disabled={bulkActive}>
                                📁 حفظ في المكتبة فقط
                              </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {hasMore&&(
                <div className="load-more-wrap">
                  <button className="btn btn-more" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore?"جاري التحميل...":"⬇ تحميل المزيد"}
                  </button>
                </div>
              )}
            </>}

            {!loading&&videos.length===0&&!error&&(
              <div className="empty">
                <div className="empty-ico">🎬</div>
                <div className="empty-title">ابدأ من هنا</div>
                <div className="empty-sub">أدخل رابط بروفايل تيك توك أو فيديو مباشر</div>
              </div>
            )}
          </>}

          {tab==="library"&&<>
            {expiringSoon>0&&(
              <div className="alert alert-warn">⚠ {expiringSoon} فيديو ستُحذف تلقائياً خلال أقل من 5 أيام</div>
            )}
            <div className="lib-header">
              <div className="lib-title">📁 مكتبتي ({library.length})</div>
              {library.length>0&&(
                <button className="btn btn-outline btn-sm"
                  onClick={()=>{if(confirm("مسح المكتبة كاملة؟"))setLibrary([]);}}>
                  🗑 مسح الكل
                </button>
              )}
            </div>
            {library.length>0&&(
              <div className="lib-stats">
                <div className="lib-stat"><div className="lib-stat-num">{library.length}</div><div className="lib-stat-label">محفوظ</div></div>
                <div className="lib-stat"><div className="lib-stat-num">{library.filter(x=>daysAgo(x.savedAt)<7).length}</div><div className="lib-stat-label">هذا الأسبوع</div></div>
                <div className="lib-stat"><div className="lib-stat-num">{expiringSoon}</div><div className="lib-stat-label">تنتهي قريباً</div></div>
              </div>
            )}
            {library.length===0?(
              <div className="lib-empty">
                <div className="lib-empty-ico">📭</div>
                <div className="lib-empty-text">لم تحفظ أي فيديو بعد.<br/>استخدم "حفظ في المكتبة" وستظهر هنا.</div>
              </div>
            ):(
              <div className="grid">
                {library.map(item=>{
                  const days=daysAgo(item.savedAt);
                  return (
                    <div key={item.id} className="lib-item">
                      <div className="lib-thumb">
                        <img src={item.cover} alt="" loading="lazy"
                          onError={e=>{(e.target as HTMLImageElement).style.display="none";}}/>
                        <div className={`lib-age ${days>=25?"old":"ok"}`}>{days===0?"اليوم":`${days} يوم`}</div>
                      </div>
                      <div className="lib-body">
                        <div className="lib-desc">{item.title}</div>
                        <div className="lib-date">📅 منذ {days} يوم</div>
                        <button className="lib-remove" onClick={()=>setLibrary(p=>p.filter(x=>x.id!==item.id))}>✕ إزالة</button>
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
