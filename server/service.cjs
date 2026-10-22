'use strict';
const crypto=require('node:crypto');
const M=require('../dist/model.js');
const S=require('./security.cjs');
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const uid=()=>crypto.randomUUID(),token=()=>crypto.randomBytes(32).toString('hex');
const clean=(s,n)=>typeof s==='string'&&s.trim().length>0&&s.trim().length<=n;
function emptyWorkspace(){return {version:1,demo:false,employees:[],types:['IP 类','口播类','图文类','其他'],items:[],logs:[],settings:{baseDate:M.dateKey(new Date()),schedule:'daily',warningDays:14}};}
async function transaction(db,fn){const c=await db.connect();try{await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
async function session(db,raw){if(!raw)return null;const r=await db.query(`SELECT u.id,u.username,u.display_name,t.id AS team_id,t.name AS team_name,m.role FROM cs_sessions s JOIN cs_users u ON u.id=s.user_id JOIN cs_teams t ON t.id=s.team_id JOIN cs_members m ON m.team_id=t.id AND m.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now()`,[S.hash(raw)]);return r.rows[0]||null;}
function publicAccount(a){return {id:a.id,username:a.username,name:a.display_name,teamId:a.team_id,teamName:a.team_name,role:a.role};}
async function makeSession(db,userId,teamId){const raw=token();await db.query(`INSERT INTO cs_sessions(token_hash,user_id,team_id,expires_at) VALUES($1,$2,$3,now()+interval '7 days')`,[S.hash(raw),userId,teamId]);return raw;}
async function register(db,input){
 const username=String(input.username||'').trim().toLowerCase(),password=input.password;
 if(!/^[a-z0-9_-]{3,32}$/.test(username))fail(400,'用户名需要 3–32 位字母、数字、下划线或短横线。');
 if(typeof password!=='string'||password.length<12||password.length>128)fail(400,'密码长度需要为 12–128 位。');
 if(!clean(input.name,30))fail(400,'请输入不超过 30 字的姓名或昵称。');
 if(!input.invite&&!clean(input.teamName,50))fail(400,'请输入不超过 50 字的团队名称。');
 if(input.invite&&!/^[a-f0-9]{64}$/.test(input.invite))fail(400,'邀请链接无效。');
 const userId=uid(),password_hash=await S.passwordHash(password);
 return transaction(db,async c=>{
  let teamId,role;
  if(input.invite){const r=await c.query('SELECT * FROM cs_invites WHERE token_hash=$1 AND used_by IS NULL AND expires_at>now() FOR UPDATE',[S.hash(input.invite)]);if(!r.rows.length)fail(400,'邀请已失效或已被使用，请联系管理员重新邀请。');teamId=r.rows[0].team_id;role=r.rows[0].role;}
  else{teamId=uid();role='owner';await c.query('INSERT INTO cs_teams(id,name) VALUES($1,$2)',[teamId,input.teamName.trim()]);}
  try{await c.query('INSERT INTO cs_users(id,username,display_name,password_hash) VALUES($1,$2,$3,$4)',[userId,username,input.name.trim(),password_hash]);}catch(e){if(e.code==='23505')fail(409,'用户名已被使用，请换一个用户名。');throw e;}
  await c.query('INSERT INTO cs_members(team_id,user_id,role) VALUES($1,$2,$3)',[teamId,userId,role]);
  if(input.invite)await c.query('UPDATE cs_invites SET used_by=$1 WHERE token_hash=$2',[userId,S.hash(input.invite)]);
  else{const data=emptyWorkspace();await c.query('INSERT INTO cs_workspaces(team_id,data,updated_by) VALUES($1,$2,$3)',[teamId,JSON.stringify(data),userId]);await c.query('INSERT INTO cs_snapshots(team_id,revision,data,user_id) VALUES($1,0,$2,$3)',[teamId,JSON.stringify(data),userId]);}
  const raw=await makeSession(c,userId,teamId);return {token:raw,account:publicAccount(await session(c,raw))};
 });
}
async function login(db,input){
 const username=String(input.username||'').trim().toLowerCase();if(typeof input.password!=='string'||input.password.length>128)fail(400,'请输入有效的用户名与密码。');
 const u=(await db.query('SELECT * FROM cs_users WHERE username=$1',[username])).rows[0];const match=await S.passwordMatches(input.password,u?.password_hash);if(!u||!match)fail(401,'用户名或密码不正确。');
 const memberships=(await db.query('SELECT team_id FROM cs_members WHERE user_id=$1 ORDER BY team_id',[u.id])).rows;
 const team=memberships.find(m=>m.team_id===input.teamId)||memberships[0];
 if(!team&&input.invite){
  if(!/^[a-f0-9]{64}$/.test(input.invite))fail(400,'邀请链接无效。');
  return transaction(db,async c=>{const invitation=(await c.query('SELECT * FROM cs_invites WHERE token_hash=$1 AND used_by IS NULL AND expires_at>now() FOR UPDATE',[S.hash(input.invite)])).rows[0];if(!invitation)fail(400,'邀请已失效或已被使用。');await c.query('INSERT INTO cs_members(team_id,user_id,role) VALUES($1,$2,$3)',[invitation.team_id,u.id,invitation.role]);await c.query('UPDATE cs_invites SET used_by=$1 WHERE token_hash=$2',[u.id,S.hash(input.invite)]);const raw=await makeSession(c,u.id,invitation.team_id);return {token:raw,account:publicAccount(await session(c,raw)),joined:true};});
 }
 if(!team)fail(403,'账号当前未加入团队，请通过新的邀请链接重新加入。');
 const raw=await makeSession(db,u.id,team.team_id);return {token:raw,account:publicAccount(await session(db,raw))};
}
async function data(db,a){const r=(await db.query(`SELECT w.revision,w.data,w.updated_at,u.display_name AS updated_by FROM cs_workspaces w LEFT JOIN cs_users u ON u.id=w.updated_by WHERE w.team_id=$1`,[a.team_id])).rows[0];if(!r)fail(404,'团队库存不存在。');return r;}
async function save(db,a,input){
 if(a.role==='viewer')fail(403,'只读成员不能修改库存。');
 if(!Number.isSafeInteger(input.revision)||input.revision<0)fail(400,'库存版本无效，请刷新后重试。');
 let next;try{next=M.validate(input.data);}catch(e){fail(400,e.message);}
 next.demo=false;delete next.exportedAt;
 const encoded=JSON.stringify(next);if(Buffer.byteLength(encoded)>2500000)fail(413,'库存记录过大，请先归档历史记录。');
 return transaction(db,async c=>{
  const r=await c.query(`UPDATE cs_workspaces SET data=$1,revision=revision+1,updated_at=now(),updated_by=$2 WHERE team_id=$3 AND revision=$4 RETURNING revision,updated_at`,[encoded,a.id,a.team_id,input.revision]);
  if(!r.rows.length)fail(409,'其他成员已更新库存。你的修改已保留为本机草稿，请先导出草稿，再加载云端最新版本。');
  const version=r.rows[0];await c.query('INSERT INTO cs_snapshots(team_id,revision,data,user_id) VALUES($1,$2,$3,$4)',[a.team_id,version.revision,encoded,a.id]);
  await c.query('DELETE FROM cs_snapshots WHERE team_id=$1 AND revision < $2',[a.team_id,Math.max(0,version.revision-29)]);
  return version;
 });
}
async function invite(db,a,input){if(a.role!=='owner')fail(403,'只有团队管理员可以邀请成员。');const role=input.role;if(!['editor','viewer'].includes(role))fail(400,'成员权限无效。');const raw=token();await db.query(`INSERT INTO cs_invites(token_hash,team_id,role,created_by,expires_at) VALUES($1,$2,$3,$4,now()+interval '7 days')`,[S.hash(raw),a.team_id,role,a.id]);return {invite:raw,role,expiresInDays:7};}
async function join(db,a,input){
 if(!/^[a-f0-9]{64}$/.test(input.invite||''))fail(400,'邀请链接无效。');
 return transaction(db,async c=>{const r=(await c.query('SELECT * FROM cs_invites WHERE token_hash=$1 AND used_by IS NULL AND expires_at>now() FOR UPDATE',[S.hash(input.invite)])).rows[0];if(!r)fail(400,'邀请已失效或已被使用。');
  await c.query('INSERT INTO cs_members(team_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[r.team_id,a.id,r.role]);await c.query('UPDATE cs_invites SET used_by=$1 WHERE token_hash=$2',[a.id,S.hash(input.invite)]);const raw=await makeSession(c,a.id,r.team_id);return {token:raw,account:publicAccount(await session(c,raw))};});
}
async function members(db,a){return {members:(await db.query('SELECT u.id,u.username,u.display_name AS name,m.role FROM cs_members m JOIN cs_users u ON u.id=m.user_id WHERE m.team_id=$1 ORDER BY m.role,u.created_at',[a.team_id])).rows};}
async function teams(db,a){return {teams:(await db.query('SELECT t.id,t.name,m.role FROM cs_members m JOIN cs_teams t ON t.id=m.team_id WHERE m.user_id=$1 ORDER BY t.created_at',[a.id])).rows};}
async function switchTeam(db,a,input){const target=(await db.query('SELECT team_id FROM cs_members WHERE user_id=$1 AND team_id=$2',[a.id,input.teamId])).rows[0];if(!target)fail(403,'你不是这个团队的成员。');const raw=await makeSession(db,a.id,target.team_id);return {token:raw,account:publicAccount(await session(db,raw))};}
async function revoke(db,a,input){if(a.role!=='owner')fail(403,'只有管理员可以移除成员。');return transaction(db,async c=>{const r=await c.query("DELETE FROM cs_members WHERE team_id=$1 AND user_id=$2 AND role<>'owner' RETURNING user_id",[a.team_id,input.userId]);if(!r.rows.length)fail(400,'不能移除管理员或不存在的成员。');await c.query('DELETE FROM cs_sessions WHERE team_id=$1 AND user_id=$2',[a.team_id,input.userId]);return {ok:true};});}
async function snapshots(db,a){if(a.role!=='owner')fail(403,'只有管理员可以查看或恢复自动备份。');return {snapshots:(await db.query('SELECT s.revision,s.created_at,u.display_name AS name FROM cs_snapshots s LEFT JOIN cs_users u ON u.id=s.user_id WHERE s.team_id=$1 ORDER BY revision DESC LIMIT 30',[a.team_id])).rows};}
async function restore(db,a,input){if(a.role!=='owner')fail(403,'只有管理员可以恢复备份。');if(!Number.isSafeInteger(input.snapshotRevision))fail(400,'备份版本无效。');const r=(await db.query('SELECT data FROM cs_snapshots WHERE team_id=$1 AND revision=$2',[a.team_id,input.snapshotRevision])).rows[0];if(!r)fail(404,'自动备份不存在或已过期。');await save(db,a,{revision:input.revision,data:r.data});return data(db,a);}
module.exports={emptyWorkspace,session,publicAccount,register,login,data,save,invite,join,members,teams,switchTeam,revoke,snapshots,restore,fail};
