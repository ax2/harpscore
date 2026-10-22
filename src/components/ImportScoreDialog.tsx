import { useEffect, useRef, useState } from 'react';

export default function ImportScoreDialog({ text, error, saving, onText, onError, onImport, onClose }: {
  text: string;
  error: string;
  saving: boolean;
  onText: (text: string) => void;
  onError: (error: string) => void;
  onImport: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const readVersion = useRef(0);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    dialogRef.current?.querySelector('textarea')?.focus();
    return () => {
      readVersion.current += 1;
      // The empty and selected-score toolbars reuse DOM nodes for different actions.
      document.querySelector<HTMLButtonElement>('[data-import-trigger]')?.focus();
    };
  }, []);

  useEffect(() => {
    if (saving) {
      readVersion.current += 1;
      dialogRef.current?.focus();
    } else if (document.activeElement === dialogRef.current) {
      dialogRef.current?.querySelector('textarea')?.focus();
    }
  }, [saving]);

  return <div className="modal-mask" onClick={() => { if (!saving) onClose(); }}
    onMouseDown={e => { if (saving && e.target === e.currentTarget) e.preventDefault(); }}>
    <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="import-title"
      aria-busy={saving} tabIndex={-1} onClick={e => e.stopPropagation()} onKeyDown={e => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          if (!saving) onClose();
        }
        if (e.key === 'Tab') {
          if (saving) { e.preventDefault(); return; }
          const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>('textarea:not(:disabled), button:not(:disabled)') ?? [])];
          const first = controls[0], last = controls[controls.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
        }
      }}>
      <h3 id="import-title">导入曲谱</h3>
      <p className="modal-help">支持 HarpScore 完整 JSON，以及含 <code>melody</code> 字段的旋律 DSL JSON。</p>
      <input ref={fileRef} type="file" accept=".json,application/json" className="visually-hidden" tabIndex={-1}
        aria-label="选择曲谱 JSON 文件" disabled={saving} onChange={async e => {
          const input = e.currentTarget;
          const file = input.files?.[0];
          input.value = '';
          if (!file) return;
          const version = ++readVersion.current;
          setReading(true);
          onError('');
          try {
            const content = await file.text();
            if (version === readVersion.current) { onText(content); onError(''); }
          } catch {
            if (version === readVersion.current) onError('无法读取文件，请重新选择或粘贴 JSON');
          } finally {
            if (version === readVersion.current) setReading(false);
          }
        }} />
      <textarea placeholder="粘贴曲谱 JSON… 或点击下方按钮选择文件" value={text} disabled={saving}
        aria-label="曲谱 JSON" aria-invalid={!!error} aria-describedby={error ? 'import-error' : undefined}
        onChange={e => { readVersion.current += 1; setReading(false); onText(e.target.value); onError(''); }} />
      {reading && <div role="status">正在读取文件…</div>}
      {error && <div className="error" id="import-error" role="alert">{error}</div>}
      <div className="row">
        <button className="btn" disabled={saving} onClick={() => fileRef.current?.click()}>选择文件…</button>
        <button className="btn" disabled={saving} onClick={onClose}>取消</button>
        <button className="btn primary" disabled={saving || reading} onClick={onImport}>{saving ? '正在保存…' : '导入'}</button>
      </div>
    </div>
  </div>;
}
