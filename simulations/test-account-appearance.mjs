import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCozyDatabase} from './lib/cozy-fixture.mjs';
const db=await createCozyDatabase();
try{
 await db.exec(await readFile(new URL('../67_SQL_ACCOUNT_APPEARANCE.sql',import.meta.url),'utf8'));
 const id=(await db.query("insert into users(username,email) values('appearance_test','appearance@test.invalid') returning id")).rows[0].id;
 const other=(await db.query("insert into users(username,email) values('appearance_other','appearance-other@test.invalid') returning id")).rows[0].id;
 async function save(user,appearance,revision){return (await db.query('select kw_account_appearance_save($1,$2,$3) result',[user,appearance,revision])).rows[0].result;}
 assert.equal((await save(id,'sovereign-04',0)).revision,1);
 await assert.rejects(()=>save(id,'sovereign-02',0),/APPEARANCE_REVISION_CONFLICT/);
 await assert.rejects(()=>save(id,'sovereign-09',1),/APPEARANCE_LOCKED/);
 await assert.rejects(()=>save(id,'sovereign-05',1),/APPEARANCE_LOCKED/);
 await assert.rejects(()=>save(id,null,1),/APPEARANCE_LOCKED/);
 assert.equal((await save(other,'sovereign-03',0)).appearance_id,'sovereign-03');
 assert.equal((await db.query('select appearance_id from kw_account_appearance where user_id=$1',[id])).rows[0].appearance_id,'sovereign-04');
 await db.exec("set role authenticated");
 await assert.rejects(()=>db.query('select * from kw_account_appearance'),/permission denied/);
 await assert.rejects(()=>save(id,'sovereign-01',1),/permission denied/);
 await db.exec('reset role');
 await db.query("update users set account_status='deleted' where id=$1",[id]);
 await assert.rejects(()=>save(id,'sovereign-01',1),/COZY_ACCOUNT_UNAVAILABLE/);
 console.log('PASS account appearance SQL: persistence, revisions, locked items, account separation, direct access denial, deleted account');
}finally{await db.close();}
