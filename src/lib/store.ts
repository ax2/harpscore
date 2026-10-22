/** 曲谱库：内置曲谱 + 用户曲谱（localStorage 持久化）。 */
import type { Score } from '../types/score';
import { analyzeScore } from './harmonica';
import { BUILTIN_SCORES } from '../data/builtin';
import { scoreFromObject, uniqueScoreId, importLibraryBackup } from './scoreImport';

export { importScoreJson } from './scoreImport';

const LS_KEY = 'harpscore.userScores.v1';
const RECOVERY_KEY = 'harpscore.userScores.recovery.v1';
const READ_ERROR = '无法读取浏览器中的个人曲库。请恢复存储权限后重新读取；本次不会覆盖原有数据。';

export interface Library {
  builtin: Score[];
  user: Score[];
  /** Exact persisted snapshot; undefined means the read failed. */
  storageSnapshot: string | null | undefined;
  storageIssue?: string;
}

function prepare(score: Score): Score {
  analyzeScore(score, false);
  return score;
}

function readUserLibrary(): Pick<Library, 'user' | 'storageSnapshot' | 'storageIssue'> {
  let raw: string | null;
  try { raw = localStorage.getItem(LS_KEY); }
  catch { return { user: [], storageSnapshot: undefined, storageIssue: READ_ERROR }; }
  if (raw === null) return { user: [], storageSnapshot: null };
  let entries: unknown;
  try { entries = JSON.parse(raw); } catch { /* Keep unreadable bytes for backup. */ }
  if (!Array.isArray(entries)) return {
    user: [], storageSnapshot: raw,
    storageIssue: '个人曲库不是有效的 JSON 数组，已停止保存和删除。请先备份原始数据，修复后重新读取。',
  };
  const valid = entries.flatMap((entry) => {
    const result = scoreFromObject(entry);
    return result.score ? [result.score] : [];
  });
  // Reserve future IDs too, so repairing duplicate legacy IDs cannot steal one.
  const occupied = new Set(BUILTIN_SCORES.map(s => s.id));
  const reserved = new Set([...occupied, ...valid.map(s => s.id)]);
  const user = valid.map((score) => {
    const next = occupied.has(score.id) ? uniqueScoreId(score, reserved) : score;
    occupied.add(next.id);
    reserved.add(next.id);
    return prepare(next);
  });
  const invalidCount = entries.length - valid.length;
  return {
    user, storageSnapshot: raw,
    ...(invalidCount ? { storageIssue: `个人曲库中有 ${invalidCount} 条数据无法读取；其余曲谱仍可查看和单独导出。已停止保存和删除，请先备份原始数据，修复后重新读取。` } : {}),
  };
}

/** Raw backup deliberately does not parse or normalize the saved data. */
export function userLibraryBackup(): string {
  try { return localStorage.getItem(LS_KEY) ?? '[]'; }
  catch { throw new Error(READ_ERROR); }
}

export function recoveryLibraryBackup(): string {
  let raw: string | null;
  try { raw = localStorage.getItem(RECOVERY_KEY); }
  catch { throw new Error(READ_ERROR); }
  if (raw === null) throw new Error('还没有恢复前副本；替换个人曲库时会自动保存一份');
  return raw;
}

function persist(user: Score[]): string {
  const raw = JSON.stringify(user);
  try { localStorage.setItem(LS_KEY, raw); }
  catch { throw new Error('浏览器存储不可用或空间不足，曲谱尚未保存，请保留原始 JSON'); }
  return raw;
}

// Web Locks serializes cooperating tabs on the same origin. Older/insecure
// browsers fall back to a synchronous read/write (without a cross-tab guarantee).
async function withWriteLock<T>(action: () => T): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(LS_KEY, async () => action());
  }
  return action();
}

function writableState() {
  const state = readUserLibrary();
  if (state.storageIssue) throw new Error(state.storageIssue);
  return state;
}

export function loadLibrary(): Library {
  return {
    builtin: BUILTIN_SCORES.map(s => prepare(structuredClone(s))),
    ...readUserLibrary(),
  };
}

export function allScores(lib: Library): Score[] {
  return [...lib.builtin, ...lib.user];
}

export function findScore(lib: Library, id: string): Score | undefined {
  return allScores(lib).find(s => s.id === id);
}

/** Imports always append; an ID collision never means permission to replace. */
export async function saveUserScore(lib: Library, score: Score): Promise<{ library: Library; savedScore: Score }> {
  return withWriteLock(() => {
    const fresh = writableState();
    const savedScore = prepare({
      ...uniqueScoreId(structuredClone(score), [...lib.builtin, ...fresh.user].map(s => s.id)),
      builtin: false, updatedAt: new Date().toISOString(),
    });
    const user = [...fresh.user, savedScore];
    const storageSnapshot = persist(user);
    return { library: { ...lib, user, storageSnapshot, storageIssue: undefined }, savedScore };
  });
}

export async function deleteUserScore(lib: Library, id: string): Promise<Library> {
  return withWriteLock(() => {
    const fresh = writableState();
    // A stale selection must not delete a changed or newly reassigned entry.
    if (fresh.storageSnapshot !== lib.storageSnapshot) {
      throw new Error('个人曲库已在其他标签页发生变化。请点击「重新读取曲库」，确认曲谱后再删除。');
    }
    const user = fresh.user.filter(s => s.id !== id);
    const storageSnapshot = persist(user);
    return { ...lib, user, storageSnapshot, storageIssue: undefined };
  });
}

/** Preflight the complete backup, then persist the complete result in one write. */
export async function restoreUserLibrary(lib: Library, text: string, mode: 'merge' | 'replace'): Promise<Library> {
  const parsed = importLibraryBackup(text);
  if (parsed.errors.length) throw new Error(`未恢复：${parsed.errors.slice(0, 3).join('；')}`);
  if (mode === 'merge' && parsed.scores.length === 0) throw new Error('备份为空，没有可合并的曲谱');
  return withWriteLock(() => {
    const fresh = mode === 'merge' ? writableState() : readUserLibrary();
    if (fresh.storageSnapshot === undefined) throw new Error(READ_ERROR);
    if (mode === 'replace' && fresh.storageSnapshot !== lib.storageSnapshot) {
      throw new Error('个人曲库已在其他标签页发生变化。请取消恢复并重新读取曲库，再确认替换范围。');
    }
    const user = mode === 'merge' ? [...fresh.user] : [];
    const occupied = new Set([...lib.builtin, ...user].map(s => s.id));
    for (const score of parsed.scores) {
      const saved = prepare({
        ...uniqueScoreId(score, occupied), builtin: false,
        updatedAt: score.updatedAt ?? new Date().toISOString(),
      });
      occupied.add(saved.id);
      user.push(saved);
    }
    if (mode === 'replace') {
      // A backup failure must prevent replacing the primary library, including
      // corrupt raw data. Keep one previous version; users can export it too.
      try { localStorage.setItem(RECOVERY_KEY, fresh.storageSnapshot ?? '[]'); }
      catch { throw new Error('无法保存恢复前副本，已取消替换。请先导出备份并释放浏览器空间后重试。'); }
    }
    const storageSnapshot = persist(user);
    return { ...lib, user, storageSnapshot, storageIssue: undefined };
  });
}
