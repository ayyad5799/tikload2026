import { useState, useCallback, useEffect } from "react";

const TIKWM_API = "/api/tikwm";
const MAX_DURATION = 5 * 60;
const LIBRARY_KEY = "tikload_library";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #080808; color: #e8e8e8; font-family: 'DM Sans', sans-serif; min-height: 100vh; -webkit-font-smoothing: antialiased; }
  .app { min-height: 100vh; background: #080808; position: relative; }
  .glow1 { position: fixed; width: 700px; height: 700px; border-radius: 50%; background: radial-gradient(circle, rgba(0,255,198,0.05) 0%, transparent 65%); top: -250px; left: -250px; pointer-events: none; z-index: 0; }
  .glow2 { position: fixed; width: 500px; height: 500px; border-radius: 50%; background: radial-gradient(circle, rgba(255,0,80,0.04) 0%, transparent 65%); bottom: -150px; right: -150px; pointer-events: none; z-index: 0; }
  .page { max-width: 1140px; margin: 0 auto; padding: 40px 20px 80px; position: relative; z-index: 1; }

  /* NAV TABS */
  .nav { display: flex; gap: 4px; margin-bottom: 40px; background: #0d0d0d; border: 1px solid #1a1a1a; border-radius: 14px; padding: 5px; width: fit-content; }
  .nav-btn { padding: 9px 22px; border-radius: 10px; border: none; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all .2s; background: transparent; color: #444; }
  .nav-btn.active { background: #161616; color: #e8e8e8; }
  .nav-btn .nav-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; border-radius: 99px; background: #00ffc6; color: #000; font-size: 10px; font-weight: 700; margin-right: 6px; padding: 0 5px; }

  /* HEADER */
  .header { text-align: center; margin-bottom: 44px; }
  .logo { font-family: 'Bebas Neue', cursive; font-size: clamp(58px, 9vw, 96px); letter-spacing: 6px; line-height: 1; background: linear-gradient(135deg, #fff 0%, #00ffc6 45%, #ff0050 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 8px; }
  .tagline { font-size: 12px; font-weight: 400; letter-spacing: 3px; text-transform: uppercase; color: #383838; }

  /* SEARCH */
  .search-card { background: #0f0f0f; border: 1px solid #1c1c1c; border-radius: 20px; padding: 26px 30px; margin-bottom: 20px; transition: border-color .25s; }
  .search-card:focus-within { border-color: #00ffc6; }
  .field-label { display: block; font-size: 10px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; color: #323232; margin-bottom: 12px; }
  .row { display: flex; gap: 10px; align-items: stretch; flex-wrap: wrap; }
  .input { flex: 1 1 240px; background: #080808; border: 1px solid #1c1c1c; border-radius: 11px; padding: 12px 16px; color: #e8e8e8; font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; transition: border-color .2s; min-height: 46px; }
  .input:focus { border-color: #00ffc6; }
  .input::placeholder { color: #262626; }
  .chips { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 12px; }
  .chip-label { font-size: 11px; color: #2a2a2a; }
  .chip { font-size: 12px; padding: 4px 13px; background: #0a0a0a; border: 1px solid #181818; border-radius: 99px; color: #333; cursor: pointer; transition: all .2s; }
  .chip:hover { border-color: #2a2a2a; color: #666; }

  /* BUTTONS */
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 0 22px; min-height: 46px; border: none; border-radius: 11px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all .2s; white-space: nowrap; }
  .btn:disabled { opacity: .3; cursor: not-allowed !important; transform: none !important; box-shadow: none !important; }
  .btn-fetch { background: linear-gradient(135deg,#00ffc6,#00b4ff); color: #000; }
  .btn-fetch:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,255,198,.28); }
  .btn-bulk { background: linear-gradient(135deg,#ff0050,#ff4d00); color: #fff; }
  .btn-bulk:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(255,0,80,.28); }
  .btn-more { background: #111; color: #666; border: 1px solid #1e1e1e; }
  .btn-more:not(:disabled):hover { border-color: #333; color: #aaa; }
  .btn-outline { background: transparent; color: #555; border: 1px solid #1c1c1c; }
  .btn-outline:not(:disabled):hover { border-color: #333; color: #999; }
  .btn-sm { padding: 0 14px; min-height: 34px; font-size: 12px; border-radius: 9px; }

  /* FILTERS */
  .filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 20px; }
  .filter-label { font-size: 11px; color: #333; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; margin-left: 4px; }
  .filter-btn { padding: 6px 14px; border-radius: 99px; border: 1px solid #1a1a1a; background: transparent; color: #444; font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 500; cursor: pointer; transition: all .2s; }
  .filter-btn:hover { border-color: #2a2a2a; color: #777; }
  .filter-btn.active { background: #161616; border-color: #00ffc6; color: #00ffc6; }

  /* ALERTS */
  .alert { display: flex; align-items: flex-start; gap: 10px; padding: 12px 16px; border-radius: 11px; font-size: 13px; margin-bottom: 16px; line-height: 1.5; }
  .alert-error { background: rgba(255,0,80,.05); border: 1px solid rgba(255,0,80,.15); color: #ff6685; }
  .alert-info { background: rgba(0,255,198,.04); border: 1px solid rgba(0,255,198,.1); color: #00e6b0; }
  .alert-status { background: #0f0f0f; border: 1px solid #1c1c1c; color: #555; }
  .pulse-dot { width: 7px; height: 7px; border-radius: 50%; background: #00ffc6; flex-shrink: 0; margin-top: 3px; animation: pulse 1.6s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.2} }

  /* PROGRESS */
  .progress-card { background: #0f0f0f; border: 1px solid #1c1c1c; border-radius: 14px; padding: 18px 22px; margin-bottom: 20px; }
  .progress-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .progress-title { font-size: 13px; font-weight: 600; color: #bbb; }
  .progress-pct { font-size: 13px; color: #555; font-variant-numeric: tabular-nums; }
  .progress-track { height: 5px; background: #161616; border-radius: 99px; overflow: hidden; margin-bottom: 6px; }
  .progress-fill { height: 100%; border-radius: 99px; transition: width .35s ease; background: linear-gradient(90deg,#00ffc6,#00b4ff); }
  .progress-sub { font-size: 11px; color: #333; }

  /* TOOLBAR */
  .toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
  .toolbar-left { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .stat-num { font-family: 'Bebas Neue', cursive; font-size: 30px; letter-spacing: 1px; color: #00ffc6; line-height: 1; }
  .stat-label { font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #2e2e2e; }
  .badge { font-size: 12px; padding: 4px 12px; background: #0f0f0f; border: 1px solid #1c1c1c; border-radius: 99px; color: #555; }
  .badge strong { color: #00ffc6; }

  /* GRID */
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(188px, 1fr)); gap: 13px; }
  .card { background: #0d0d0d; border: 2px solid transparent; border-radius: 15px; overflow: hidden; cursor: pointer; transition: border-color .2s, transform .2s, box-shadow .2s; display: flex; flex-direction: column; user-select: none; }
  .card:hover { transform: translateY(-3px); border-color: #1e1e1e; }
  .card.sel { border-color: #00ffc6; box-shadow: 0 0 18px rgba(0,255,198,.12); }
  .thumb { position: relative; aspect-ratio: 9/16; overflow: hidden; background: #111; flex-shrink: 0; }
  .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .3s; }
  .card:hover .thumb img { transform: scale(1.05); }
  .dur { position: absolute; bottom: 7px; left: 7px; background: rgba(0,0,0,.72); backdrop-filter: blur(6px); color: #fff; font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 6px; }
  .check { position: absolute; top: 8px; right: 8px; width: 25px; height: 25px; border-radius: 50%; background: rgba(0,0,0,.55); border: 2px solid #2a2a2a; display: flex; align-items: center; justify-content: center; transition: all .18s; backdrop-filter: blur(4px); z-index: 2; }
  .card.sel .check { background: #00ffc6; border-color: #00ffc6; }
  .check-tick { font-size: 12px; font-weight: 800; color: #000; opacity: 0; transition: opacity .18s; }
  .card.sel .check-tick { opacity: 1; }
  .card-body { padding: 10px 12px 5px; flex: 1; }
  .card-stats { display: flex; gap: 10px; font-size: 11px; color: #333; margin-bottom: 5px; }
  .card-desc { font-size: 12px; color: #3e3e3e; line-height: 1.4; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .card-footer { padding: 7px 11px 11px; }
  .dl-btn { width: 100%; min-height: 34px; border-radius: 9px; font-size: 12px; font-weight: 600; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; background: linear-gradient(135deg,#00ffc6,#00b4ff); color: #000; transition: all .2s; }
  .dl-btn:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,255,198,.2); }
  .dl-btn:disabled { opacity: .3; cursor: not-allowed; }

  /* LOAD MORE */
  .load-more-wrap { display: flex; justify-content: center; margin-top: 28px; }

  /* SKELETONS */
  .skel-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(188px, 1fr)); gap: 13px; }
  .skel { background: #0d0d0d; border-radius: 15px; overflow: hidden; }
  .skel-thumb { aspect-ratio: 9/16; background: linear-gradient(90deg,#0d0d0d 25%,#141414 50%,#0d0d0d 75%); background-size: 200% 100%; animation: shim 1.4s infinite; }
  .skel-line { height: 9px; margin: 10px 12px 0; border-radius: 5px; background: linear-gradient(90deg,#0d0d0d 25%,#141414 50%,#0d0d0d 75%); background-size: 200% 100%; animation: shim 1.4s infinite; }
  .skel-line.s { width: 55%; margin-bottom: 11px; }
  @keyframes shim { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

  /* EMPTY */
  .empty { text-align: center; padding: 80px 20px; }
  .empty-ico { font-size: 50px; margin-bottom: 16px; }
  .empty-title { font-family: 'Bebas Neue', cursive; font-size: 34px; letter-spacing: 2px; color: #1c1c1c; margin-bottom: 6px; }
  .empty-sub { font-size: 13px; color: #282828; }

  /* LIBRARY */
  .lib-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 10px; }
  .lib-title { font-family: 'Bebas Neue', cursive; font-size: 28px; letter-spacing: 2px; color: #444; }
  .lib-item { background: #0d0d0d; border: 1px solid #141414; border-radius: 13px; overflow: hidden; display: flex; flex-direction: column; }
  .lib-thumb-wrap { position: relative; aspect-ratio: 9/16; overflow: hidden; background: #111; }
  .lib-thumb-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .lib-body { padding: 10px 12px; flex: 1; }
  .lib-desc { font-size: 12px; color: #3a3a3a; line-height: 1.4; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; margin-bottom: 6px; }
  .lib-date { font-size: 11px; color: #2a2a2a; }
  .lib-remove { width: 100%; min-height: 32px; border-radius: 8px; border: none; background: rgba(255,0,80,.08); color: #ff4466; font-size: 11px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; margin-top: 6px; transition: background .2s; }
  .lib-remove:hover { background: rgba(255,0,80,.15); }
  .lib-empty { text-align: center; padding: 60px 20px; color: #222; }
  .lib-empty-ico { font-size: 40px; margin-bottom: 12px; }
  .lib-empty-text { font-size: 13px; color: #252525; }

  @media (max-width: 560px) {
    .grid, .skel-grid { grid-template-columns: repeat(2, 1fr); gap: 9px; }
    .row { flex-direction: column; }
    .input { flex: 1 1 100%; }
    .btn { width: 100%; }
    .search-card { padding: 18px; }
    .nav-btn { padding: 8px 14px; font-size: 12px; }
  }
`;

type Video = {
  id: string;
  cover: string;
  origin_cover: string;
  title: string;
  duration: number;
  play: string;
  wmplay: string;
  digg_count: number;
  play_count: number;
};

type LibItem = {
  id: string;
  cover: string;
  title: string;
  downloadedAt: string;
};

type SortKey = "default" | "views" | "likes" | "shortest" | "longest";

function fmt(n: number) {
  if (!n) return "0";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

function fmtDur(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function parseUsername(v: string) {
  v = v.trim();
  const m = v.match(/tiktok\.com\/@([^/?&]+)/);
  if (m) return m[1];
  if (v.startsWith("@")) return v.slice(1);
  if (!v.includes("/") && !v.includes(".")) return v;
  return null;
}

function isVideoUrl(v: string) {
  return v.includes("tiktok.com") && v.includes("/video/");
}

function loadLibrary(): LibItem[] {
  try { return JSON.parse(localStorage.getItem(LIBRARY_KEY) || "[]"); } catch { return []; }
}

function saveLibrary(items: LibItem[]) {
  try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(items)); } catch {}
}

export default function App() {
  const [tab, setTab] = useState<"search" | "library">("search");
  const [url, setUrl] = useState("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [currentUser, setCurrentUser] = useState("");
  const [skipped, setSkipped] = useState(0);
  const [sel, setSel] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [dlId, setDlId] = useState<string | null>(null);
  const [bulkActive, setBulkActive] = useState(false);
  const [bulkDone, setBulkDone] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkCurrent, setBulkCurrent] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [library, setLibrary] = useState<LibItem[]>(() => loadLibrary());

  useEffect(() => { saveLibrary(library); }, [library]);

  const addToLibrary = (v: Video) => {
    setLibrary(prev => {
      if (prev.find(x => x.id === String(v.id))) return prev;
      return [{ id: String(v.id), cover: v.cover || v.origin_cover, title: v.title || "بدون عنوان", downloadedAt: new Date().toLocaleDateString("ar-SA") }, ...prev];
    });
  };

  const removeFromLibrary = (id: string) => setLibrary(prev => prev.filter(x => x.id !== id));

  const fetchVideos = async (username: string, cur?: string) => {
    const params = `endpoint=user/posts&unique_id=${username}&count=35${cur ? `&cursor=${cur}` : ""}`;
    const r = await fetch(`${TIKWM_API}?${params}`);
    const d = await r.json();
    if (!d || d.code !== 0) throw new Error("تعذّر جلب البروفايل. تحقق من اسم المستخدم.");
    const all: Video[] = d.data?.videos || [];
    const nextCursor = d.data?.cursor;
    const more = d.data?.hasMore;
    const filtered = all.filter(v => !v.duration || v.duration <= MAX_DURATION);
    return { filtered, skippedCount: all.length - filtered.length, nextCursor, more };
  };

  const fetchProfile = useCallback(async (username: string) => {
    setLoading(true); setError(""); setVideos([]); setSkipped(0); setSel([]); setCursor(null); setHasMore(false);
    setCurrentUser(username);
    setStatus(`جاري جلب فيديوهات @${username}...`);
    try {
      const { filtered, skippedCount, nextCursor, more } = await fetchVideos(username);
      if (!filtered.length) throw new Error("لا توجد فيديوهات في هذا الحساب.");
      setVideos(filtered);
      setSkipped(skippedCount);
      setCursor(nextCursor || null);
      setHasMore(!!more);
      setStatus(`تم جلب ${filtered.length} فيديو من @${username}`);
    } catch (e: any) { setError(e.message); setStatus(""); }
    finally { setLoading(false); }
  }, []);

  const loadMore = async () => {
    if (!currentUser || !cursor) return;
    setLoadingMore(true);
    try {
      const { filtered, skippedCount, nextCursor, more } = await fetchVideos(currentUser, cursor);
      setVideos(prev => [...prev, ...filtered]);
      setSkipped(prev => prev + skippedCount);
      setCursor(nextCursor || null);
      setHasMore(!!more);
      setStatus(`إجمالي ${videos.length + filtered.length} فيديو من @${currentUser}`);
    } catch (e: any) { setError(e.message); }
    finally { setLoadingMore(false); }
  };

  const fetchSingle = useCallback(async (videoUrl: string) => {
    setLoading(true); setError(""); setStatus("جاري جلب الفيديو...");
    try {
      const r = await fetch(`${TIKWM_API}?endpoint=&url=${encodeURIComponent(videoUrl)}`);
      const d = await r.json();
      if (!d || d.code !== 0) throw new Error("تعذّر جلب الفيديو.");
      if (d.data?.duration > MAX_DURATION) throw new Error("هذا الفيديو أطول من 5 دقائق.");
      setVideos([d.data]); setHasMore(false);
      setStatus("تم جلب الفيديو بنجاح!");
    } catch (e: any) { setError(e.message); setStatus(""); }
    finally { setLoading(false); }
  }, []);

  const handleSearch = () => {
    const v = url.trim(); if (!v) return; setError("");
    if (isVideoUrl(v)) fetchSingle(v);
    else {
      const u = parseUsername(v);
      if (!u) { setError("أدخل رابط بروفايل مثل: tiktok.com/@username أو @username"); return; }
      fetchProfile(u);
    }
  };

  const sortedVideos = [...videos].sort((a, b) => {
    if (sortKey === "views") return b.play_count - a.play_count;
    if (sortKey === "likes") return b.digg_count - a.digg_count;
    if (sortKey === "shortest") return a.duration - b.duration;
    if (sortKey === "longest") return b.duration - a.duration;
    return 0;
  });

  const toggleSel = (id: string) => setSel(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleAll = () => setSel(sel.length === videos.length ? [] : videos.map(v => String(v.id)));

  const downloadVideo = async (video: Video): Promise<boolean> => {
    const dlUrl = video.play || video.wmplay;
    if (!dlUrl) return false;
    try {
      const res = await fetch(`/api/download?url=${encodeURIComponent(dlUrl)}`);
      if (!res.ok) return false;
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `tiktok_${video.id}.mp4`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      addToLibrary(video);
      return true;
    } catch { return false; }
  };

  const downloadOne = async (video: Video) => {
    const id = String(video.id);
    setDlId(id); setError("");
    const ok = await downloadVideo(video);
    if (!ok) setError("فشل تحميل الفيديو، جرّب مرة أخرى.");
    setDlId(null);
  };

  const downloadBulk = async () => {
    const toDownload = sortedVideos.filter(v => sel.includes(String(v.id)));
    if (!toDownload.length) return;
    setBulkActive(true); setBulkDone(0); setBulkTotal(toDownload.length); setError("");
    let failed = 0;
    for (let i = 0; i < toDownload.length; i++) {
      setBulkCurrent(`فيديو ${i + 1} من ${toDownload.length}`);
      const ok = await downloadVideo(toDownload[i]);
      if (!ok) failed++;
      setBulkDone(i + 1);
      await new Promise(r => setTimeout(r, 600));
    }
    setBulkActive(false); setBulkCurrent("");
    const success = toDownload.length - failed;
    setStatus(`✅ تم تحميل ${success} فيديو بنجاح!${failed > 0 ? ` (فشل ${failed})` : ""}`);
    setSel([]);
  };

  const bulkPct = bulkTotal > 0 ? Math.round((bulkDone / bulkTotal) * 100) : 0;

  const sorts: { key: SortKey; label: string }[] = [
    { key: "default", label: "الافتراضي" },
    { key: "views", label: "▶ الأكثر مشاهدة" },
    { key: "likes", label: "❤ الأكثر لايك" },
    { key: "shortest", label: "⏱ الأقصر" },
    { key: "longest", label: "⏱ الأطول" },
  ];

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <div className="glow1" /><div className="glow2" />
        <div className="page">

          <div className="header">
            <div className="logo">TIKLOAD</div>
            <div className="tagline">تحميل فيديوهات تيك توك · بدون علامة مائية · تحت 5 دقائق</div>
          </div>

          {/* TABS */}
          <div className="nav">
            <button className={`nav-btn${tab === "search" ? " active" : ""}`} onClick={() => setTab("search")}>
              🔍 البحث والتحميل
            </button>
            <button className={`nav-btn${tab === "library" ? " active" : ""}`} onClick={() => setTab("library")}>
              {library.length > 0 && <span className="nav-badge">{library.length}</span>}
              📁 مكتبتي
            </button>
          </div>

          {/* ===== SEARCH TAB ===== */}
          {tab === "search" && (
            <>
              <div className="search-card">
                <label className="field-label">رابط البروفايل أو الفيديو</label>
                <div className="row">
                  <input className="input" dir="ltr"
                    placeholder="tiktok.com/@username  أو رابط فيديو مباشر"
                    value={url} onChange={e => setUrl(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSearch()} />
                  <button className="btn btn-fetch" onClick={handleSearch} disabled={loading || !url.trim()}>
                    {loading ? "جاري الجلب..." : "جلب الفيديوهات"}
                  </button>
                </div>
                <div className="chips">
                  <span className="chip-label">أمثلة:</span>
                  {["@mrbeast", "@khaby.lame", "@charlidamelio"].map(ex => (
                    <span key={ex} className="chip" onClick={() => setUrl(ex)}>{ex}</span>
                  ))}
                </div>
              </div>

              {error && <div className="alert alert-error">⚠ {error}</div>}
              {status && !error && <div className="alert alert-status"><div className="pulse-dot" />{status}</div>}
              {skipped > 0 && <div className="alert alert-info">ℹ تم تخطي {skipped} فيديو أطول من 5 دقائق</div>}

              {bulkActive && (
                <div className="progress-card">
                  <div className="progress-head">
                    <span className="progress-title">⬇ جاري التحميل... {bulkCurrent}</span>
                    <span className="progress-pct">{bulkDone}/{bulkTotal}</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${bulkPct}%` }} />
                  </div>
                  <div className="progress-sub">{bulkPct}% مكتمل</div>
                </div>
              )}

              {loading && (
                <div className="skel-grid">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div className="skel" key={i}>
                      <div className="skel-thumb" />
                      <div className="skel-line" />
                      <div className="skel-line s" />
                    </div>
                  ))}
                </div>
              )}

              {!loading && videos.length > 0 && (
                <>
                  {/* FILTERS */}
                  <div className="filters">
                    <span className="filter-label">ترتيب:</span>
                    {sorts.map(s => (
                      <button key={s.key} className={`filter-btn${sortKey === s.key ? " active" : ""}`}
                        onClick={() => setSortKey(s.key)}>
                        {s.label}
                      </button>
                    ))}
                  </div>

                  <div className="toolbar">
                    <div className="toolbar-left">
                      <div>
                        <div className="stat-num">{videos.length}</div>
                        <div className="stat-label">فيديو</div>
                      </div>
                      <button className="btn btn-outline btn-sm" onClick={toggleAll} disabled={bulkActive}>
                        {sel.length === videos.length ? "إلغاء الكل" : "تحديد الكل"}
                      </button>
                      {sel.length > 0 && <div className="badge">محدد: <strong>{sel.length}</strong></div>}
                    </div>
                    {sel.length > 0 && (
                      <button className="btn btn-bulk btn-sm" onClick={downloadBulk} disabled={bulkActive}>
                        {bulkActive ? `⬇ ${bulkPct}%` : `⬇ تحميل ${sel.length} فيديو`}
                      </button>
                    )}
                  </div>

                  <div className="grid">
                    {sortedVideos.map(v => {
                      const id = String(v.id);
                      const isSel = sel.includes(id);
                      const isDling = dlId === id;
                      return (
                        <div key={id} className={`card${isSel ? " sel" : ""}`}
                          onClick={() => !bulkActive && !isDling && toggleSel(id)}>
                          <div className="thumb">
                            <img src={v.cover || v.origin_cover} alt="" loading="lazy"
                              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            {v.duration > 0 && <div className="dur">{fmtDur(v.duration)}</div>}
                            <div className="check"><span className="check-tick">✓</span></div>
                          </div>
                          <div className="card-body">
                            <div className="card-stats">
                              <span>❤ {fmt(v.digg_count)}</span>
                              <span>▶ {fmt(v.play_count)}</span>
                            </div>
                            <div className="card-desc">{v.title || "بدون عنوان"}</div>
                          </div>
                          <div className="card-footer">
                            <button className="dl-btn"
                              onClick={e => { e.stopPropagation(); downloadOne(v); }}
                              disabled={isDling || bulkActive}>
                              {isDling ? "⏳ جاري..." : "⬇ تحميل"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {hasMore && (
                    <div className="load-more-wrap">
                      <button className="btn btn-more" onClick={loadMore} disabled={loadingMore}>
                        {loadingMore ? "جاري التحميل..." : "⬇ تحميل المزيد"}
                      </button>
                    </div>
                  )}
                </>
              )}

              {!loading && videos.length === 0 && !error && (
                <div className="empty">
                  <div className="empty-ico">🎬</div>
                  <div className="empty-title">ابدأ من هنا</div>
                  <div className="empty-sub">أدخل رابط بروفايل تيك توك أو فيديو مباشر</div>
                </div>
              )}
            </>
          )}

          {/* ===== LIBRARY TAB ===== */}
          {tab === "library" && (
            <>
              <div className="lib-header">
                <div className="lib-title">📁 مكتبتي ({library.length} فيديو)</div>
                {library.length > 0 && (
                  <button className="btn btn-outline btn-sm" onClick={() => { if (confirm("هل تريد مسح المكتبة كاملة؟")) setLibrary([]); }}>
                    🗑 مسح الكل
                  </button>
                )}
              </div>

              {library.length === 0 ? (
                <div className="lib-empty">
                  <div className="lib-empty-ico">📭</div>
                  <div className="lib-empty-text">لم تحمّل أي فيديو بعد. ابدأ بتحميل فيديوهات وستظهر هنا تلقائياً.</div>
                </div>
              ) : (
                <div className="grid">
                  {library.map(item => (
                    <div key={item.id} className="lib-item">
                      <div className="lib-thumb-wrap">
                        <img src={item.cover} alt="" loading="lazy"
                          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      </div>
                      <div className="lib-body">
                        <div className="lib-desc">{item.title}</div>
                        <div className="lib-date">📅 {item.downloadedAt}</div>
                        <button className="lib-remove" onClick={() => removeFromLibrary(item.id)}>✕ إزالة</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </>
  );
}
