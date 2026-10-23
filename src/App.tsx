import { useEffect, useMemo, useState } from 'react';
import type { Score } from './types/score';
import { analyzeScore } from './lib/harmonica';
import { formatScoreLocation } from './lib/scoreLocation';
import {
  loadLibrary, allScores, findScore, saveUserScore, deleteUserScore,
  importScoreJson, userLibraryBackup, type Library,
} from './lib/store';
import { exportSvg, exportPng, exportPdf, exportJson, exportLibraryBackup } from './lib/export';
import ScoreSheet from './components/ScoreSheet';
import LibraryRestoreDialog from './components/LibraryRestoreDialog';
import ImportScoreDialog from './components/ImportScoreDialog';
import { scoreFromObject } from './lib/scoreImport';
import { DEFAULT_FILTERS, FAVORITES_KEY, filterScores, loadFavorites, setFavorite, type LibraryFilters } from './lib/libraryView';

function ScoreItem({ s, active, favorite, onClick }: { s: Score; active: boolean; favorite: boolean; onClick: () => void }) {
  return (
    <button className={`score-item${active ? ' active' : ''}`} onClick={onClick}>
      <div className="t">{s.title}</div>
      <div className="meta">
        <span>1={s.key}</span>
        <span>{s.timeSignature}</span>
        <span className="stars">{'★'.repeat(s.difficulty)}</span>
        {favorite && <span className="favorite-mark">已收藏</span>}
        {s.tags.slice(0, 2).map((t) => <span key={t}>#{t}</span>)}
      </div>
    </button>
  );
}

function AnalysisPanel({ score, showMeasureNumbers, onShowMeasureNumbers }: {
  score: Score; showMeasureNumbers: boolean; onShowMeasureNumbers: () => void;
}) {
  const a = useMemo(() => analyzeScore(score, false), [score]);
  const warns = a.issues.filter((i) => i.severity === 'warning');
  const errs = a.issues.filter((i) => i.severity === 'error');
  const notationWarnings = useMemo(() => scoreFromObject(score).warnings, [score]);
  const sourceFormat = score.sourceFormat === 'jianpu-text'
    ? '文字简谱'
    : score.sourceFormat === 'jianpu-image'
      ? '数字简谱'
      : score.sourceFormat === 'music-text'
        ? '音符文本（ABC / LilyPond）'
      : score.sourceFormat === 'original'
        ? '原创'
        : '';
  return (
    <div className="analysis">
      <b>{score.title}</b>　音符 <b>{a.totalNotes}</b> 个　
      {a.graceNotes > 0 && <span>（含 {a.graceNotes} 个前倚音）　</span>}
      {a.ornamentNotes > 0 && <span>（含 {a.ornamentNotes} 个波音辅助音）　</span>}
      音域 <b>{a.minMidi ?? '—'} ~ {a.maxMidi ?? '—'}</b>（MIDI）　
      压音 <b className={a.bendNotes ? 'warn' : ''}>{a.bendNotes}</b> 个　
      {a.overblowNotes > 0 && <>超吹 <b className="warn">{a.overblowNotes}</b> 个　</>}
      {a.totalNotes === 0 ? <span>· 无有声音符</span> : errs.length === 0
        ? <span className="ok">· 已记音高均有孔位</span>
        : <span className="err">· {errs.length} 个已记音高暂无孔位（当前不含超吹/超吸）</span>}
      {(notationWarnings.length > 0 || errs.length > 0 || warns.length > 0) && (
        <div className="location-help">以下按书写小节编号，弱起计入；音符序号包含休止符。
          {!showMeasureNumbers && <button className="btn" onClick={onShowMeasureNumbers}>显示小节号</button>}
        </div>
      )}
      {notationWarnings.length > 0 && <div className="warn">记谱提示：{notationWarnings.join('；')}</div>}
      {errs.length > 0 && <div className="err">{errs.map((e, i) =>
        <span key={i}>{formatScoreLocation(score, e)}：{e.reason}；</span>)}</div>}
      {score.notes && <div>演奏提示：{score.notes}</div>}
      {score.source && (
        <div className="score-source">
          来源：{score.sourceUrl
            ? <a href={score.sourceUrl} target="_blank" rel="noreferrer">{score.source}</a>
            : score.source}
          {(sourceFormat || score.sourceCheckedAt) && (
            <span>（{[sourceFormat, score.sourceCheckedAt ? `${score.sourceCheckedAt} 核对` : ''].filter(Boolean).join(' · ')}）</span>
          )}
        </div>
      )}
      {warns.length > 0 && (
        <details className="warn" open={warns.length <= 12}>
          <summary>压音与进阶技巧位置（{warns.length} 处）</summary>
          {warns.map((w, i) => (
            <span key={i}>{formatScoreLocation(score, w)}：{w.reason}；</span>
          ))}
        </details>
      )}
    </div>
  );
}

export default function App() {
  const [lib, setLib] = useState<Library>(() => loadLibrary());
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showMeasureNumbers, setShowMeasureNumbers] = useState(false);
  const [filters, setFilters] = useState<LibraryFilters>(DEFAULT_FILTERS);
  const [favorites, setFavorites] = useState(loadFavorites);
  const [favoriteSaving, setFavoriteSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [importSaving, setImportSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  useEffect(() => {
    const refreshFavorites = (event: StorageEvent) => {
      if (event.key === FAVORITES_KEY || event.key === null) setFavorites(loadFavorites());
    };
    window.addEventListener('storage', refreshFavorites);
    return () => window.removeEventListener('storage', refreshFavorites);
  }, []);
  const runAction = async (action: () => void | Promise<void>) => {
    setActionError('');
    try { await action(); } catch (error) {
      setActionError(error instanceof Error ? error.message : '操作失败，请重试');
    }
  };

  const scores = useMemo(() => filterScores(allScores(lib), filters, favorites), [lib, filters, favorites]);
  const tags = useMemo(() => [...new Set(allScores(lib).flatMap((s) => s.tags))].sort((a, b) => a.localeCompare(b, 'zh-CN')), [lib]);
  const changeFilter = <K extends keyof LibraryFilters>(key: K, value: LibraryFilters[K]) =>
    setFilters((old) => ({ ...old, [key]: value }));

  const current = currentId ? findScore(lib, currentId) : undefined;

  const doImport = async (text: string) => {
    if (importSaving) return;
    const { score: parsedScore, error, warnings } = importScoreJson(text);
    if (error || !parsedScore) {
      setImportError(error ?? '导入失败');
      return;
    }
    setImportSaving(true);
    let saved: Awaited<ReturnType<typeof saveUserScore>>;
    try { saved = await saveUserScore(lib, parsedScore); } catch (error) {
      setImportError(`未保存：${error instanceof Error ? error.message : '保存失败，请保留曲谱 JSON 后重试'}`);
      return;
    } finally {
      setImportSaving(false);
    }
    const score = saved.savedScore;
    setLib(saved.library);
    setCurrentId(score.id);
    setImportOpen(false);
    setImportText('');
    setImportError('');
    setNotice(warnings.length
      ? `已导入《${score.title}》，另有 ${warnings.length} 个记谱提示，详见谱面下方`
      : `已导入《${score.title}》`);
  };

  return (
    <div className="app">
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="brand">
          <h1><span className="harp">Harp</span>Score</h1>
          <div className="sub">布鲁斯口琴乐谱 · 十孔口琴专用</div>
        </div>
        <div className="search-box">
          <input aria-label="搜索曲谱" placeholder="搜索曲名 / 标签…" value={filters.query} onChange={(e) => changeFilter('query', e.target.value)} />
        </div>
        <div className="library-filters">
          <label>最高难度<select aria-label="最高难度" value={filters.maxDifficulty} onChange={(e) => changeFilter('maxDifficulty', Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n === 5 ? '不限难度' : `${n} 星及以下`}</option>)}
          </select></label>
          <label>演奏技巧<select aria-label="演奏技巧" value={filters.technique} onChange={(e) => changeFilter('technique', e.target.value as LibraryFilters['technique'])}>
            <option value="all">全部技巧</option><option value="natural">无需压音</option><option value="bends">需要压音</option>
          </select></label>
          <label>曲目标签<select aria-label="曲目标签" value={filters.tag} onChange={(e) => changeFilter('tag', e.target.value)}>
            <option value="">全部标签</option>{tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
          </select></label>
          <label>排序<select aria-label="排序" value={filters.sort} onChange={(e) => changeFilter('sort', e.target.value as LibraryFilters['sort'])}>
            <option value="default">曲库顺序</option><option value="difficulty">从易到难</option><option value="title">曲名顺序</option>
          </select></label>
          <label className="favorites-filter"><input type="checkbox" checked={filters.favoritesOnly} onChange={(e) => changeFilter('favoritesOnly', e.target.checked)} />仅看收藏</label>
          <button className="filter-reset" onClick={() => setFilters(DEFAULT_FILTERS)}>清除筛选</button>
          <div className="filter-count" role="status">找到 {scores.length} / {lib.builtin.length + lib.user.length} 首曲谱</div>
          {filters.technique === 'natural' && <div className="filter-note">未明确交替音、过程音或和声音的技巧曲谱暂不列入。</div>}
        </div>
        <div className="library-tools">
          <button className="btn" onClick={() => { setSidebarOpen(false); setRestoreOpen(true); }}>恢复个人曲库</button>
          <button className="btn" onClick={() => runAction(() => {
            setSidebarOpen(false);
            exportLibraryBackup(userLibraryBackup());
          })}>备份个人曲库</button>
          <button className="btn" onClick={() => {
            const next = loadLibrary();
            setLib(next);
            setFavorites(loadFavorites());
            // Clear personal selections: repaired duplicate IDs may have changed.
            if (!current?.builtin) setCurrentId(null);
            setActionError('');
            setSidebarOpen(false);
            setNotice(next.storageIssue ? '' : '已重新读取个人曲库');
          }}>重新读取曲库</button>
        </div>
        <div className="score-list">
          {scores.length === 0 && <p className="no-results">没有符合条件的曲谱。试试清除筛选，或打开一首曲谱后点击「收藏」。</p>}
          <div className="group-title">内置曲谱（{scores.filter((s) => s.builtin).length} / {lib.builtin.length}）</div>
          {scores.filter((s) => s.builtin).map((s) => (
            <ScoreItem key={s.id} s={s} active={s.id === currentId} favorite={favorites.includes(s.id)}
              onClick={() => { setCurrentId(s.id); setSidebarOpen(false); }} />
          ))}
          <div className="group-title">我的曲谱（{scores.filter((s) => !s.builtin).length} / {lib.user.length}）</div>
          {scores.filter((s) => !s.builtin).map((s) => (
            <ScoreItem key={s.id} s={s} active={s.id === currentId} favorite={favorites.includes(s.id)}
              onClick={() => { setCurrentId(s.id); setSidebarOpen(false); }} />
          ))}
          {lib.user.length === 0 && (
            <div style={{ color: 'var(--text-dim)', fontSize: 12, padding: '4px 12px' }}>
              还没有自己的曲谱，点击「导入曲谱」添加
            </div>
          )}
        </div>
      </aside>

      <main className="main">
        {notice && <div className="notice" role="status">{notice}</div>}
        {actionError && <div className="action-error" role="alert">{actionError}</div>}
        {lib.storageIssue && <div className="action-error" role="alert">{lib.storageIssue}</div>}
        {current ? (
          <>
            <div className="toolbar">
              <button className="btn menu-btn" onClick={() => setSidebarOpen(true)}>曲库</button>
              <button className="btn" aria-pressed={favorites.includes(current.id)} disabled={favoriteSaving} onClick={() => runAction(async () => {
                setFavoriteSaving(true);
                try { await setFavorite(current.id, !favorites.includes(current.id)); setFavorites(loadFavorites()); }
                finally { setFavoriteSaving(false); }
              })}>{favorites.includes(current.id) ? '★ 已收藏' : '☆ 收藏'}</button>
              <button className="btn primary" onClick={() => runAction(() => exportPng(current, 2, { showMeasureNumbers }))}>导出 PNG</button>
              <button className="btn" onClick={() => runAction(() => exportSvg(current, { showMeasureNumbers }))}>导出 SVG</button>
              <button className="btn" onClick={() => runAction(() => exportPdf(current, { showMeasureNumbers }))}>打印 / PDF</button>
              <button className="btn" onClick={() => runAction(() => exportJson(current))}>导出 JSON</button>
              <label className="btn display-option" title="从第1个书写小节编号，弱起计入；续行沿用原编号。SVG、PNG和打印同步显示。">
                <input type="checkbox" checked={showMeasureNumbers} onChange={event => setShowMeasureNumbers(event.target.checked)} />小节号
              </label>
              <div className="spacer" />
              <button className="btn" data-import-trigger onClick={() => setImportOpen(true)}>导入曲谱</button>
              {!current.builtin && (
                <button className="btn danger" onClick={() => {
                  if (confirm(`确定删除《${current.title}》吗？`)) {
                    void runAction(async () => {
                      setLib(await deleteUserScore(lib, current.id));
                      setCurrentId(null);
                    });
                  }
                }}>删除</button>
              )}
            </div>
            <ScoreSheet score={current} showMeasureNumbers={showMeasureNumbers} />
            <AnalysisPanel score={current} showMeasureNumbers={showMeasureNumbers} onShowMeasureNumbers={() => setShowMeasureNumbers(true)} />
          </>
        ) : (
          <>
            <div className="toolbar">
              <button className="btn menu-btn" onClick={() => setSidebarOpen(true)}>曲库</button>
              <div className="spacer" />
              <button className="btn" data-import-trigger onClick={() => setImportOpen(true)}>导入曲谱</button>
            </div>
            <div className="empty">
              <div className="big">🎵</div>
              从左侧选择一首曲谱开始<br />
              <span style={{ fontSize: 12.5 }}>
                上行简谱 · 下行口琴孔位（<b style={{ color: '#c0392b' }}>↑ 吹气</b> / <b style={{ color: '#1f618d' }}>↓ 吸气</b>）
              </span>
            </div>
          </>
        )}
      </main>

      {sidebarOpen && (
        <div className="sidebar-mask" onClick={() => setSidebarOpen(false)} />
      )}

      {importOpen && <ImportScoreDialog text={importText} error={importError} saving={importSaving}
        onText={setImportText} onError={setImportError} onImport={() => void doImport(importText)}
        onClose={() => setImportOpen(false)} />}
      {restoreOpen && <LibraryRestoreDialog library={lib} onClose={() => setRestoreOpen(false)} onRestored={(next, count, mode) => {
        setLib(next);
        setCurrentId(null);
        setFilters(DEFAULT_FILTERS);
        setActionError('');
        setRestoreOpen(false);
        setNotice(mode === 'merge' ? `已合并恢复 ${count} 首曲谱` : `已替换个人曲库并恢复 ${count} 首曲谱；恢复前副本可在恢复窗口导出`);
      }} />}
    </div>
  );
}
