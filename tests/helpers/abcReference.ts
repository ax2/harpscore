import assert from 'node:assert/strict';

type Event = [number | null, number];
type MarkedEvent = [number | null, number, boolean, boolean];
// Deliberately small, strict decoder for the curated music-only ABC fixtures.
// It is independent of the numbered-notation importer, and rejects unsupported
// source syntax rather than silently accepting a partial melody comparison.
export function decodeReferenceAbc(raw: string, transpose: number): Event[][] {
  return decodeMarkedReferenceAbc(raw, transpose).map(bar => bar.map(([pitch, duration]) => [pitch, duration]));
}

export function decodeMarkedReferenceAbc(raw: string, transpose: number): MarkedEvent[][] {
  const signatures: Record<string, Record<string, number>> = {
    C: {}, E: { F: 1, C: 1, G: 1, D: 1 },
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
    const pattern = /(H?)([=_^]?)([A-Ga-gz])([,']*)(\d*(?:\/\d*)?)(-?)(>?)/g;
    assert.equal(bar.replace(pattern, '').trim(), '', `unsupported ABC: ${bar}`);
    const accidentals = new Map<string, number>();
    let brokenNext = false;
    const events: MarkedEvent[] = [...bar.matchAll(pattern)].map(([, fermata, accidental, letter, octaves, length, tie, broken]) => {
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
      return [midi, duration, !!tie, !!fermata];
    });
    assert.equal(brokenNext, false, 'broken rhythm must finish inside its bar');
    return events;
  });
}

