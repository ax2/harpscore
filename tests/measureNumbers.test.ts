import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { layoutScore, ScoreSheetSvg } from '../src/components/ScoreSheet';
import { scoreFromObject } from '../src/lib/scoreImport';

test('written measure numbers include pickups and stay stable through dense mobile continuations', () => {
  const imported=scoreFromObject({title:'Numbering',key:'C',timeSignature:'4/4',lines:[[
    {notes:[{degree:1,beats:.5}]},
    {notes:Array.from({length:32},()=>({degree:3,beats:.125})),repeatBegin:true,repeatEnd:true},
    {notes:[{degree:1,beats:2,dotted:true},{degree:1,beats:.5}]},
  ]]});
  assert.deepEqual(imported.warnings,[]);
  const score=imported.score!;
  const original=JSON.stringify(score);
  for(const width of [420,900,1080]){
    const placed=layoutScore(score,width,true).lines.flatMap(line=>line.measures);
    assert.deepEqual([...new Set(placed.map(bar=>bar.number))],[1,2,3]);
    assert.equal(placed[0].number,1);
    assert.ok(placed.every(bar=>!bar.continuesFromPrevious || bar.number===2));
    if(width===420)assert.ok(placed.filter(bar=>bar.number===2).length>1);
    const svg=renderToStaticMarkup(React.createElement(ScoreSheetSvg,{score,pageWidth:width,showMeasureNumbers:true}));
    assert.deepEqual([...svg.matchAll(/data-measure-number="(\d+)"/g)].map(match=>Number(match[1])),placed.map(bar=>bar.number));
    assert.match(svg,/弱起计入/);
  }
  assert.equal(JSON.stringify(score),original);
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(ScoreSheetSvg,{score})),/data-measure-number=/);
});

test('measure-number band stays above fermata, mordent and grace ink without changing horizontal layout', () => {
  for(const melody of ['1! - - -','[U:2]1 - - -','{5}1 - - -','1~ - - - |\n1 - - -']){
    const score=scoreFromObject({title:'Decorations',key:'C',timeSignature:'4/4',melody}).score!;
    const plain=layoutScore(score,420);
    const numbered=layoutScore(score,420,true);
    assert.ok(numbered.height>plain.height);
    assert.deepEqual(numbered.lines[0].measures.map(bar=>[bar.x,bar.w]),plain.lines[0].measures.map(bar=>[bar.x,bar.w]));
    const line=numbered.lines[0];
    const highestInk=melody.includes('!') ? line.y-53 : melody.includes('[U:') ? line.y-48 : line.y-25;
    assert.ok(line.numberY<highestInk-2);
  }
});
