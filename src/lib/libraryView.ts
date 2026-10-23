import type { Score } from '../types/score';
import { notesForAnalysis } from './notation';
import { withStorageWriteLock } from './storageLock';

export interface LibraryFilters {
  query: string;
  maxDifficulty: number;
  tag: string;
  technique: 'all' | 'natural' | 'bends';
  favoritesOnly: boolean;
  sort: 'default' | 'difficulty' | 'title';
}

export const DEFAULT_FILTERS: LibraryFilters = {
  query: '', maxDifficulty: 5, tag: '', technique: 'all', favoritesOnly: false, sort: 'default',
};

/** Uses the fingering already prepared by loadLibrary/saveUserScore. */
export function filterScores(scores: Score[], filters: LibraryFilters, favorites: readonly string[]): Score[] {
  const terms = filters.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const favoriteIds = new Set(favorites);
  const result = scores.filter((score) => {
    const text = [score.title, score.subtitle, score.composer, ...score.tags].filter(Boolean).join(' ').toLocaleLowerCase();
    if (!terms.every((term) => text.includes(term))) return false;
    if (score.difficulty > filters.maxDifficulty || (filters.tag && !score.tags.includes(filters.tag))) return false;
    if (filters.favoritesOnly && !favoriteIds.has(score.id)) return false;
    const notes = score.lines.flatMap((line) => line.flatMap((m) => m.notes.flatMap(notesForAnalysis))).filter((n) => n.degree !== 0);
    const techniques = score.lines.flatMap(line => line.flatMap(m => m.notes.flatMap(n => n.techniques ?? [])));
    if (filters.technique === 'natural' && techniques.some(t => t !== 'vibrato')) return false;
    if (filters.technique === 'natural' && notes.some((n) => !n.hole || n.bend || n.overblow)) return false;
    if (filters.technique === 'bends' && !notes.some((n) => n.bend) && !techniques.includes('bend-release')) return false;
    return true;
  });
  if (filters.sort === 'difficulty') result.sort((a, b) => a.difficulty - b.difficulty);
  if (filters.sort === 'title') result.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
  return result;
}

export const FAVORITES_KEY = 'harpscore.favorites.v1';

function readFavorites(strict = true): string[] {
  const value: unknown = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]');
  if (!Array.isArray(value) || (strict && value.some(id => typeof id !== 'string' || id.length === 0))) {
    throw new Error('Invalid favorites');
  }
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0))];
}

export function loadFavorites(): string[] {
  try { return readFavorites(false); } catch { return []; }
}

/** Apply one explicit choice to fresh storage, preserving other tabs' favorites. */
export async function setFavorite(id: string, favorite: boolean): Promise<string[]> {
  const update = () => {
    let ids: string[];
    try { ids = readFavorites(); }
    catch { throw new Error('收藏未保存：无法读取收藏数据或数据已损坏，原数据未覆盖'); }
    const next = favorite ? [...new Set([...ids, id])] : ids.filter(value => value !== id);
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); }
    catch { throw new Error('收藏未保存：浏览器存储不可用或空间不足，请稍后重试'); }
    return next;
  };
  return withStorageWriteLock(FAVORITES_KEY, update);
}
