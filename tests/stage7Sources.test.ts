import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { BUILTIN_SCORES } from '../src/data/builtin';
import { noteDuration } from '../src/lib/notation';
import { noteToMidi } from '../src/types/score';

type Event = [number | null, number];
type Source = { id: string; file: string; sourceKey: string; transpose: number; category: string };
const directory = new URL('./fixtures/stage7-sources/', import.meta.url);
const manifest: Source[] = JSON.parse(fs.readFileSync(new URL('manifest.json', directory), 'utf8'));

// Deliberately small, strict decoder for these eight music-only ABC fixtures.
// It is independent of the numbered-notation importer, and rejects unsupported
// source syntax rather than silently accepting a partial melody comparison.
function decode(raw: string, transpose: number): Event[][] {
  const signatures: Record<string, Record<string, number>> = {
    G: { F: 1 }, F: { B: -1 }, A: { F: 1, C: 1, G: 1 },
    Ab: { B: -1, E: -1, A: -1, D: -1 }, Eb: { B: -1, E: -1, A: -1 },
  };
  const key = raw.match(/^K:\s*(\S+)/m)![1];
  assert.ok(signatures[key], `unsupported signature ${key}`);
  const unit = raw.match(/^L:\s*(\d+)\/(\d+)/m)!;
  const quarterUnits = Number(unit[1]) * 4 / Number(unit[2]);
  const body = raw.split('\n').filter(line => !/^[A-Za-z]:|^%/.test(line)).join(' ')
    .replace(/[()\\\[\]]/g, '');
  return body.split(/[|:]+/).map(bar => bar.trim()).filter(Boolean).map(bar => {
    const pattern = /([=_^]?)([A-Ga-gz])([,']*)(\d*(?:\/\d*)?)(>?)/g;
    assert.equal(bar.replace(pattern, '').trim(), '', `unsupported ABC: ${bar}`);
    const accidentals = new Map<string, number>();
    let brokenNext = false;
    const events: Event[] = [...bar.matchAll(pattern)].map(([, accidental, letter, octaves, length, broken]) => {
      const natural: Record<string, number> = { C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, B: 71 };
      const pitchKey = letter + octaves;
      if (accidental) accidentals.set(pitchKey, { '=': 0, '^': 1, '_': -1 }[accidental]!);
      const midi = letter === 'z' ? null : natural[letter.toUpperCase()]
        + (letter === letter.toLowerCase() ? 12 : 0)
        + [...octaves].reduce((sum, char) => sum + (char === "'" ? 12 : -12), 0)
        + (accidentals.get(pitchKey) ?? signatures[key][letter.toUpperCase()] ?? 0) + transpose;
      const [numerator, denominator] = length.split('/');
      const duration = quarterUnits * (Number(numerator) || 1)
        / (length.includes('/') ? Number(denominator) || 2 : 1)
        * (brokenNext ? 0.5 : broken ? 1.5 : 1);
      assert.ok(!(brokenNext && broken), 'chained broken rhythm unsupported');
      brokenNext = !!broken;
      return [midi, duration];
    });
    assert.equal(brokenNext, false, 'broken rhythm must finish inside its bar');
    return events;
  });
}

for (const source of manifest) {
  test(`${source.id}: every source pitch and duration matches, including pickup joins`, () => {
    const raw = fs.readFileSync(new URL(source.file, directory), 'utf8');
    assert.match(raw, new RegExp(`^K: ${source.sourceKey}$`, 'm'));
    const decoded = decode(raw, source.transpose);
    let expected = decoded;
    if (source.id === 'good-comrade') {
      assert.equal(decoded.length, 14);
      // Source section ends after three beats; the next one-beat pickup fills
      // that same musical measure. No note or rest is discarded or invented.
      expected = [...decoded.slice(0, 4), [...decoded[4], ...decoded[5]], ...decoded.slice(6)];
    }
    if (source.id === 'ash-grove') {
      assert.equal(decoded.length, 26);
      assert.equal((raw.match(/:\|/g) ?? []).length, 1);
      // Repeat the entire first stanza including its pickup, joining the two
      // short endings to the following pickup. The new score is fully unfolded.
      expected = [decoded[0], ...decoded.slice(1, 8), [...decoded[8], ...decoded[0]],
        ...decoded.slice(1, 8), [...decoded[8], ...decoded[9]], ...decoded.slice(10)];
    }
    const score = BUILTIN_SCORES.find(score => score.id === source.id)!;
    assert.ok(score);
    const measures = score.lines.flat();
    const actual = measures.map(bar => bar.notes.map(note => [noteToMidi(score.key, note), noteDuration(note)]));
    assert.deepEqual(actual, expected);
    assert.ok(measures.every(bar => !bar.repeatBegin && !bar.repeatEnd));
    assert.ok(measures.every(bar => bar.notes.every(note => !note.tie)));
    const meter = score.timeSignature.split('/').map(Number);
    const full = meter[0] * 4 / meter[1];
    const totals = expected.map(bar => bar.reduce((sum, event) => sum + event[1], 0));
    assert.ok(totals.slice(1, -1).every(total => total === full));
    assert.ok(totals[0] === full && totals.at(-1) === full || totals[0] + totals.at(-1)! === full);
  });
}

test('source batch balances four introductory arrangements and four traditional selections', () => {
  assert.equal(manifest.filter(source => source.category === '入门').length, 4);
  assert.equal(manifest.filter(source => source.category === '传统曲').length, 4);
});
