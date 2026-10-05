// Read-only stress/recovery checks against the configured transaction pooler.
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {one,transaction,closeDb} from '../server/db';
if (!process.env.POSTGRES_URL && existsSync('.env.local')) process.loadEnvFile('.env.local');
try {
  for(let round=0;round<3;round++) {
    const rows=await Promise.all(Array.from({length:20},(_,n)=>one<{n:number}>('SELECT ?::int n',round*20+n)));
    assert.deepEqual(rows.map(r=>r!.n),Array.from({length:20},(_,n)=>round*20+n));
    await assert.rejects(()=>one('SELECT 1 / ?::int',0),{code:'22012'});
    assert.equal((await one<{n:number}>('SELECT ?::int n',101))!.n,101);
    await assert.rejects(()=>transaction(async()=>{
      const inside=await Promise.all([one<{n:number}>('SELECT ?::int n',201),one<{n:number}>('SELECT ?::int n',202)]);
      assert.deepEqual(inside.map(r=>r!.n),[201,202]);
      await one('SELECT 1 / ?::int',0);
    }),{code:'22012'});
    assert.equal((await one<{n:number}>('SELECT ?::int n',301))!.n,301);
    console.log(`PASS pool concurrency and statement/transaction error recovery, round ${round+1}`);
  }
} finally {await closeDb();}
