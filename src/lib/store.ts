/**
 * 曲谱库：内置曲谱 + 用户曲谱（localStorage 持久化）
 */
import type { Score } from '../types/score';
import { analyzeScore } from './harmonica';
import { BUILTIN_SCORES } from '../data/builtin';
import { scoreFromObject } from './scoreImport';

export { importScoreJson, uniqueScoreId } from './scoreImport';

const LS_KEY = 'harpscore.userScores.v1';

export function loadUserScores(): Score[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.flatMap((item) => {
      const result = scoreFromObject(item);
      return result.score ? [result.score] : [];
    });
  } catch {
    return [];
  }
}

function persist(user: Score[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(user)); }
  catch { throw new Error('浏览器存储不可用或空间不足，曲谱尚未保存，请保留原始 JSON'); }
}

export interface Library {
  builtin: Score[];
  user: Score[];
}

export function loadLibrary(): Library {
  const prepare = (s: Score) => {
    analyzeScore(s, false); // 自动推算孔位标记
    return s;
  };
  return {
    builtin: BUILTIN_SCORES.map((s) => prepare(structuredClone(s))),
    user: loadUserScores().map(prepare),
  };
}

export function allScores(lib: Library): Score[] {
  return [...lib.builtin, ...lib.user];
}

export function findScore(lib: Library, id: string): Score | undefined {
  return allScores(lib).find((s) => s.id === id);
}

export function saveUserScore(lib: Library, score: Score): Library {
  score.builtin = false;
  score.updatedAt = new Date().toISOString();
  analyzeScore(score, false);
  const user = loadUserScores().filter((s) => s.id !== score.id);
  user.push(score);
  persist(user);
  return { ...lib, user };
}

export function deleteUserScore(lib: Library, id: string): Library {
  const user = loadUserScores().filter((s) => s.id !== id);
  persist(user);
  return { ...lib, user };
}
