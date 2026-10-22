import { useEffect, useMemo, useRef, useState } from 'react';
import { importLibraryBackup } from '../lib/scoreImport';
import { recoveryLibraryBackup, restoreUserLibrary, type Library } from '../lib/store';
import { exportLibraryBackup } from '../lib/export';

export default function LibraryRestoreDialog({ library, onRestored, onClose }: {
  library: Library;
  onRestored: (library: Library, count: number, mode: 'merge' | 'replace') => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => text.trim() ? importLibraryBackup(text) : undefined, [text]);
  const ready = preview && preview.errors.length === 0 && (mode === 'replace' || preview.scores.length > 0)
    && library.storageSnapshot !== undefined && !(mode === 'merge' && library.storageIssue);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector('textarea')?.focus();
    return () => {
      if (previous && previous.getBoundingClientRect().right > 0) previous.focus();
      else document.querySelector<HTMLButtonElement>('.menu-btn')?.focus();
    };
  }, []);

  const restore = async () => {
    if (!ready || saving) return;
    if (mode === 'replace' && !confirm(`将当前个人曲库替换为备份中的 ${preview.scores.length} 首曲谱。系统会先保存恢复前副本（仅保留最近一次）。继续？`)) return;
    setSaving(true);
    setError('');
    try {
      const next = await restoreUserLibrary(library, text, mode);
      onRestored(next, preview.scores.length, mode);
    } catch (error) {
      setError(error instanceof Error ? error.message : '恢复失败，原始备份仍保留在输入框中');
    } finally { setSaving(false); }
  };

  return <div className="modal-mask" onClick={() => { if (!saving) onClose(); }}>
    <div ref={dialogRef} className="modal restore-modal" role="dialog" aria-modal="true" aria-labelledby="restore-title"
      onClick={e => e.stopPropagation()} onKeyDown={e => {
        if (e.key === 'Escape' && !saving) { e.stopPropagation(); onClose(); }
        if (e.key === 'Tab') {
          if (saving) { e.preventDefault(); return; }
          const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), input:not(:disabled):not([type="file"])') ?? [])];
          const first = focusable[0], last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
        }
      }}>
      <h3 id="restore-title">恢复个人曲库</h3>
      <div className="restore-body">
        <p className="modal-help">选择「备份个人曲库」生成的 JSON 文件，或粘贴完整数组。全部曲谱通过检查后才会保存。</p>
        <input ref={fileRef} type="file" accept=".json,application/json" className="visually-hidden" tabIndex={-1}
          aria-label="选择曲库备份文件" disabled={saving} onChange={async e => {
            const file = e.target.files?.[0];
            if (file) {
              try { setText(await file.text()); setError(''); }
              catch { setError('无法读取备份文件，请重试或粘贴 JSON'); }
            }
            e.target.value = '';
          }} />
        <textarea aria-label="曲库备份 JSON" placeholder="粘贴曲库备份 JSON 数组…" value={text} disabled={saving}
          onChange={e => { setText(e.target.value); setError(''); }} />
        <fieldset disabled={saving} className="restore-modes">
          <legend>恢复方式</legend>
          <label><input type="radio" name="restore-mode" checked={mode === 'merge'} onChange={() => setMode('merge')} /> 合并到个人曲库（同 ID 保留两首）</label>
          <label><input type="radio" name="restore-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} /> 替换个人曲库（先保存恢复前副本）</label>
        </fieldset>
        {library.storageIssue && <p className="restore-hint">{library.storageSnapshot === undefined
          ? '浏览器存储目前不可读取，请恢复权限并重新读取曲库后再操作。'
          : '当前曲库存在损坏数据，合并不可用。请先导出原始备份，再用有效备份替换。'}</p>}
        {mode === 'replace' && <p className="restore-hint">用于完整还原或修复损坏的曲库。恢复前副本仅保留最近一次；再次替换前，请先导出需要保留的旧副本。内置曲谱不受影响，收藏列表单独保留。</p>}
        {preview && <div className="restore-preview" role="status">
          <b>检查结果：{preview.scores.length} 首可读取，{preview.errors.length} 首有错误</b>
          {preview.scores.length > 0 && <p>{preview.scores.slice(0, 6).map(s => s.title).join('、')}{preview.scores.length > 6 ? '…' : ''}</p>}
          {preview.errors.length > 0 && <p className="error">{preview.errors.slice(0, 3).join('；')}{preview.errors.length > 3 ? '；其余错误请修复后重新检查' : ''}。不会部分恢复。</p>}
          {preview.warnings.length > 0 && <p className="restore-hint">另有 {preview.warnings.length} 条记谱提示，恢复后请检查谱面：{preview.warnings.slice(0, 2).join('；')}</p>}
        </div>}
        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn" disabled={saving} onClick={() => {
          try { exportLibraryBackup(recoveryLibraryBackup(), true); setError(''); }
          catch (error) { setError(error instanceof Error ? error.message : '副本读取失败'); }
        }}>导出恢复前副本</button>
      </div>
      <div className="row">
        <button className="btn" disabled={saving} onClick={() => fileRef.current?.click()}>选择备份…</button>
        <button className="btn" disabled={saving} onClick={onClose}>取消</button>
        <button className={`btn ${mode === 'replace' ? 'danger' : 'primary'}`} disabled={!ready || saving} onClick={() => void restore()}>
          {saving ? '正在恢复…' : mode === 'replace' ? '替换并恢复' : '合并恢复'}
        </button>
      </div>
    </div>
  </div>;
}
