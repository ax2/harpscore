/**
 * 曲谱库：内置曲谱 + 用户曲谱（localStorage 持久化）
 */
import type { Score } from '../types/score';
import { analyzeScore } from './harmonica';
import { BUILTIN_SCORES } from '../data/builtin';

const LS_KEY = 'harpscore.userScores.v1';

export function loadUserScores(): Score[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Score[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function persist(user: Score[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(user));
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
    builtin: BUILTIN_SCORES.map(prepare),
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

/** 导入 JSON 文本为曲谱；返回错误或曲谱 */
export function importScoreJson(text: string): { score?: Score; error?: string } {
  try {
    const obj = JSON.parse(text) as Score;
    if (!obj || typeof obj !== 'object') return { error: '不是有效的 JSON 对象' };
    if (!obj.title || !obj.key || !obj.timeSignature || !Array.isArray(obj.lines)) {
      return { error: '缺少必需字段（title / key / timeSignature / lines）' };
    }
    if (!obj.id) obj.id = `user-${Date.now().toString(36)}`;
    obj.tags = obj.tags ?? [];
    obj.difficulty = obj.difficulty ?? 1;
    obj.harmonicaKey = obj.harmonicaKey ?? 'C';
    return { score: obj };
  } catch (e) {
    return { error: `JSON 解析失败：${(e as Error).message}` };
  }
}
