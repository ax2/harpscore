import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createStaticServer } from '../tools/release-server.mjs';

test('release launcher serves static assets with correct MIME and prevents file escape/write requests',async()=>{
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'harpscore-server-'));
  await fs.mkdir(path.join(temp,'dist'));
  await fs.writeFile(path.join(temp,'dist/index.html'),'<h1>HarpScore</h1>');
  await fs.writeFile(path.join(temp,'dist/app.js'),'export const version=1;');
  await fs.writeFile(path.join(temp,'private.txt'),'private fixture');
  const server=createStaticServer(path.join(temp,'dist'));
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();assert.ok(address&&typeof address!=='string');
  const base=`http://127.0.0.1:${address.port}`;
  try {
    assert.equal(await(await fetch(base)).text(),'<h1>HarpScore</h1>');
    const js=await fetch(base+'/app.js');assert.match(js.headers.get('content-type')??'',/text\/javascript/);
    assert.equal((await fetch(base+'/app.js',{method:'HEAD'})).status,200);
    assert.equal(await(await fetch(base+'/app.js',{method:'HEAD'})).text(),'');
    for(const request of ['/%2e%2e%2fprivate.txt','/..%5cprivate.txt','/%00']) assert.equal((await fetch(base+request)).status,403);
    assert.equal((await fetch(base+'/%zz')).status,400);
    assert.equal((await fetch(base+'/missing.js')).status,404);
    assert.equal((await fetch(base+'/app.js',{method:'POST',body:'changed'})).status,405);
    assert.equal(await(await fetch(base+'/app.js')).text(),'export const version=1;');
  } finally {
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
    // This exact directory was freshly created by mkdtemp above.
    await fs.rm(temp,{recursive:true,force:true});
  }
});
