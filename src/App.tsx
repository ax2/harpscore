import { useMemo, useRef, useState } from 'react';
import type { Score } from './types/score';
import { analyzeScore } from './lib/harmonica';
import {
  loadLibrary, allScores, findScore, saveUserScore, deleteUserScore,
  importScoreJson, userLibraryBackup, type Library,
} from './lib/store';
import { exportSvg, exportPng, exportPdf, exportJson, exportLibraryBackup } from './lib/export';
import ScoreSheet from './components/ScoreSheet';
import LibraryRestoreDialog from './components/LibraryRestoreDialog';
import { scoreFromObject } from './lib/scoreImport';
import { DEFAULT_FILTERS, filterScores, loadFavorites, saveFavorites, type LibraryFilters } from './lib/libraryView';

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

function AnalysisPanel({ score }: { score: Score }) {
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
      {errs.length === 0
        ? <span className="ok">· 可完整演奏</span>
        : <span className="err">· {errs.length} 个音超出能力范围</span>}
      {notationWarnings.length > 0 && <div className="warn">记谱提示：{notationWarnings.join('；')}</div>}
      {errs.length > 0 && <div className="err">{errs.map((e, i) =>
        <span key={i}>第{e.lineIndex + 1}行第{e.measureIndex + 1}小节第{e.noteIndex + 1}音{e.graceIndex !== undefined ? `的倚音${e.graceIndex + 1}` : e.ornament ? '的波音辅助音' : ''}：{e.reason}；</span>)}</div>}
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
      {warns.length > 0 && warns.length <= 12 && (
        <div className="warn">
          {warns.map((w, i) => (
            <span key={i}>第{w.lineIndex + 1}行第{w.measureIndex + 1}小节{w.graceIndex !== undefined ? `第${w.noteIndex + 1}音的倚音${w.graceIndex + 1}` : w.ornament ? `第${w.noteIndex + 1}音的波音辅助音` : ''} {w.reason}；</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [lib, setLib] = useState<Library>(() => loadLibrary());
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filters, setFilters] = useState<LibraryFilters>(DEFAULT_FILTERS);
  const [favorites, setFavorites] = useState(loadFavorites);
  const [importOpen, setImportOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [importSaving, setImportSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [actionError, setActionError] = useState('');
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
        <input ref={fileRef} type="file" accept=".json,application/json" className="visually-hidden"
          aria-label="选择曲谱 JSON 文件"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) {
              try {
                setImportText(await file.text());
                setImportError('');
              } catch { setImportError('无法读取文件，请重新选择或粘贴 JSON'); }
            }
            e.target.value = '';
          }} />
        {notice && <div className="notice" role="status">{notice}</div>}
        {actionError && <div className="action-error" role="alert">{actionError}</div>}
        {lib.storageIssue && <div className="action-error" role="alert">{lib.storageIssue}</div>}
        {current ? (
          <>
            <div className="toolbar">
              <button className="btn menu-btn" onClick={() => setSidebarOpen(true)}>曲库</button>
              <button className="btn" aria-pressed={favorites.includes(current.id)} onClick={() => runAction(() => {
                const next = favorites.includes(current.id) ? favorites.filter((id) => id !== current.id) : [...favorites, current.id];
                saveFavorites(next);
                setFavorites(next);
              })}>{favorites.includes(current.id) ? '★ 已收藏' : '☆ 收藏'}</button>
              <button className="btn primary" onClick={() => runAction(() => exportPng(current))}>导出 PNG</button>
              <button className="btn" onClick={() => runAction(() => exportSvg(current))}>导出 SVG</button>
              <button className="btn" onClick={() => runAction(() => exportPdf(current))}>打印 / PDF</button>
              <button className="btn" onClick={() => runAction(() => exportJson(current))}>导出 JSON</button>
              <div className="spacer" />
              <button className="btn" onClick={() => setImportOpen(true)}>导入曲谱</button>
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
            <ScoreSheet score={current} />
            <AnalysisPanel score={current} />
          </>
        ) : (
          <>
            <div className="toolbar">
              <button className="btn menu-btn" onClick={() => setSidebarOpen(true)}>曲库</button>
              <div className="spacer" />
              <button className="btn" onClick={() => setImportOpen(true)}>导入曲谱</button>
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

      {importOpen && (
        <div className="modal-mask" onClick={() => { if (!importSaving) setImportOpen(false); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="import-title" onClick={(e) => e.stopPropagation()}>
            <h3 id="import-title">导入曲谱</h3>
            <p className="modal-help">支持 HarpScore 完整 JSON，以及含 <code>melody</code> 字段的旋律 DSL JSON。</p>
            <textarea
              placeholder='粘贴曲谱 JSON… 或点击下方按钮选择文件'
              value={importText}
              disabled={importSaving}
              aria-label="曲谱 JSON"
              onChange={(e) => { setImportText(e.target.value); setImportError(''); }}
            />
            {importError && <div className="error">{importError}</div>}
            <div className="row">
              <button className="btn" disabled={importSaving} onClick={() => fileRef.current?.click()}>选择文件…</button>
              <button className="btn" disabled={importSaving} onClick={() => setImportOpen(false)}>取消</button>
              <button className="btn primary" disabled={importSaving} onClick={() => void doImport(importText)}>{importSaving ? '正在保存…' : '导入'}</button>
            </div>
          </div>
        </div>
      )}
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
