import { useMemo, useRef, useState } from 'react';
import type { Score } from './types/score';
import { analyzeScore } from './lib/harmonica';
import {
  loadLibrary, allScores, findScore, saveUserScore, deleteUserScore,
  importScoreJson, uniqueScoreId, type Library,
} from './lib/store';
import { exportSvg, exportPng, exportPdf, exportJson } from './lib/export';
import ScoreSheet from './components/ScoreSheet';
import { scoreFromObject } from './lib/scoreImport';

function ScoreItem({ s, active, onClick }: { s: Score; active: boolean; onClick: () => void }) {
  return (
    <button className={`score-item${active ? ' active' : ''}`} onClick={onClick}>
      <div className="t">{s.title}</div>
      <div className="meta">
        <span>1={s.key}</span>
        <span>{s.timeSignature}</span>
        <span className="stars">{'★'.repeat(s.difficulty)}</span>
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
      : score.sourceFormat === 'original'
        ? '原创'
        : '';
  return (
    <div className="analysis">
      <b>{score.title}</b>　音符 <b>{a.totalNotes}</b> 个　
      音域 <b>{a.minMidi ?? '—'} ~ {a.maxMidi ?? '—'}</b>（MIDI）　
      压音音 <b className={a.bendNotes ? 'warn' : ''}>{a.bendNotes}</b> 个　
      {a.overblowNotes > 0 && <>超吹 <b className="warn">{a.overblowNotes}</b> 个　</>}
      {errs.length === 0
        ? <span className="ok">· 可完整演奏</span>
        : <span className="err">· {errs.length} 个音超出能力范围</span>}
      {notationWarnings.length > 0 && <div className="warn">记谱提示：{notationWarnings.join('；')}</div>}
      {errs.length > 0 && <div className="err">{errs.map((e, i) =>
        <span key={i}>第{e.lineIndex + 1}行第{e.measureIndex + 1}小节第{e.noteIndex + 1}音：{e.reason}；</span>)}</div>}
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
            <span key={i}>第{w.lineIndex + 1}行第{w.measureIndex + 1}小节 {w.reason}；</span>
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
  const [query, setQuery] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [notice, setNotice] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [actionError, setActionError] = useState('');
  const runAction = async (action: () => void | Promise<void>) => {
    setActionError('');
    try { await action(); } catch (error) {
      setActionError(error instanceof Error ? error.message : '操作失败，请重试');
    }
  };

  const scores = useMemo(() => {
    const all = allScores(lib);
    if (!query.trim()) return all;
    const q = query.trim().toLowerCase();
    return all.filter((s) =>
      s.title.toLowerCase().includes(q) ||
      (s.subtitle ?? '').toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [lib, query]);

  const current = currentId ? findScore(lib, currentId) : undefined;

  const doImport = (text: string) => {
    const { score: parsedScore, error, warnings } = importScoreJson(text);
    if (error || !parsedScore) {
      setImportError(error ?? '导入失败');
      return;
    }
    const score = uniqueScoreId(parsedScore, allScores(lib).map((item) => item.id));
    let newLib: Library;
    try { newLib = saveUserScore(lib, score); } catch {
      setImportError('未保存：浏览器存储不可用或空间不足。请保留曲谱 JSON，释放空间后重试。');
      return;
    }
    setLib(newLib);
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
          <input placeholder="搜索曲名 / 标签…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="score-list">
          <div className="group-title">内置曲谱（{lib.builtin.length}）</div>
          {scores.filter((s) => s.builtin).map((s) => (
            <ScoreItem key={s.id} s={s} active={s.id === currentId}
              onClick={() => { setCurrentId(s.id); setSidebarOpen(false); }} />
          ))}
          <div className="group-title">我的曲谱（{lib.user.length}）</div>
          {scores.filter((s) => !s.builtin).map((s) => (
            <ScoreItem key={s.id} s={s} active={s.id === currentId}
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
        {current ? (
          <>
            <div className="toolbar">
              <button className="btn menu-btn" onClick={() => setSidebarOpen(true)}>曲库</button>
              <button className="btn primary" onClick={() => runAction(() => exportPng(current))}>导出 PNG</button>
              <button className="btn" onClick={() => runAction(() => exportSvg(current))}>导出 SVG</button>
              <button className="btn" onClick={() => runAction(() => exportPdf(current))}>打印 / PDF</button>
              <button className="btn" onClick={() => runAction(() => exportJson(current))}>导出 JSON</button>
              <div className="spacer" />
              <button className="btn" onClick={() => setImportOpen(true)}>导入曲谱</button>
              {!current.builtin && (
                <button className="btn danger" onClick={() => {
                  if (confirm(`确定删除《${current.title}》吗？`)) {
                    void runAction(() => {
                      setLib(deleteUserScore(lib, current.id));
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
        <div className="modal-mask" onClick={() => setImportOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="import-title" onClick={(e) => e.stopPropagation()}>
            <h3 id="import-title">导入曲谱</h3>
            <p className="modal-help">支持 HarpScore 完整 JSON，以及含 <code>melody</code> 字段的旋律 DSL JSON。</p>
            <textarea
              placeholder='粘贴曲谱 JSON… 或点击下方按钮选择文件'
              value={importText}
              aria-label="曲谱 JSON"
              onChange={(e) => { setImportText(e.target.value); setImportError(''); }}
            />
            {importError && <div className="error">{importError}</div>}
            <div className="row">
              <button className="btn" onClick={() => fileRef.current?.click()}>选择文件…</button>
              <button className="btn" onClick={() => setImportOpen(false)}>取消</button>
              <button className="btn primary" onClick={() => {
                const preview = importScoreJson(importText);
                if (preview.error || !preview.score) {
                  setImportError(preview.error ?? '导入失败');
                  return;
                }
                doImport(importText);
              }}>导入</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
