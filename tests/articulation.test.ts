import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { scoreFromObject, importScoreJson } from '../src/lib/scoreImport';
import { noteDuration } from '../src/lib/notation';
import { noteToMidi } from '../src/types/score';
import { ScoreSheetSvg, layoutScore } from '../src/components/ScoreSheet';
import { packBuiltinScores, unpackBuiltinScores } from '../src/lib/builtinCodec';

const base = { title: 'Articulations', key: 'C', harmonicaKey: 'C', timeSignature: '4/4' };
test('accent and tenuto preserve pitches and written durations across DSL, JSON and packed transport', () => {
  const result = scoreFromObject({ ...base, melody: "{2}1>!~ - - - | 1_ - 3/._ 4//> 5> | [U:2]1_ - - -" });
  assert.equal(result.error,undefined);
  assert.deepEqual(result.warnings,[]);
  const score = result.score!;
  const notes = score.lines.flat().flatMap(bar => bar.notes);
  assert.deepEqual(notes.map(note => note.articulation),['accent','tenuto','tenuto','accent','accent','tenuto']);
  assert.deepEqual(notes.map(note => [noteToMidi(score.key,note),noteDuration(note)]),[[60,4],[60,2],[64,.75],[65,.25],[67,1],[60,4]]);
  assert.deepEqual(importScoreJson(JSON.stringify(score)).score,score);
  assert.deepEqual(unpackBuiltinScores(packBuiltinScores([score])),[score]);
  for (const pageWidth of [420,1080]) for (const showMeasureNumbers of [false,true]) {
    const svg=renderToStaticMarkup(React.createElement(ScoreSheetSvg,{score,pageWidth,showMeasureNumbers}));
    assert.equal((svg.match(/data-notation="accent"/g)??[]).length,3);
    assert.equal((svg.match(/data-notation="tenuto"/g)??[]).length,3);
    assert.match(svg,/不额外加拍/);
    for(const line of layoutScore(score,pageWidth,showMeasureNumbers).lines) {
      if(showMeasureNumbers) assert.ok(line.numberY < line.y-line.articulationOffset-6);
    }
  }
});

test('invalid or ambiguous articulations cannot silently disappear from imports', () => {
  for (const articulation of [null,true,0,'staccato',[],{},'accent tenuto']) {
    const result=scoreFromObject({...base,lines:[[{notes:[{degree:1,beats:4,articulation}]}]]});
    assert.match(result.error??'',/articulation/);
  }
  for(const melody of ['0> - - -','0_ - - -','1>> - - -','1>_ - - -','1!> - - -','{2>}1 - - -','[U:2_]1 - - -']) {
    assert.ok(scoreFromObject({...base,melody}).error,melody);
  }
  for (const note of [
    {degree:0,beats:4,articulation:'accent'},
    {degree:1,beats:4,graceNotes:[{degree:2,beats:.25,articulation:'tenuto'}]},
    {degree:1,beats:4,ornament:{kind:'upper-mordent',auxiliary:{degree:2,articulation:'accent'}}},
  ]) assert.ok(scoreFromObject({...base,lines:[[{notes:[note]}]]}).error);
});
