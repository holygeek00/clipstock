'use strict';
const crypto=require('node:crypto');
const {promisify}=require('node:util');
const scrypt=promisify(crypto.scrypt);
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
async function passwordHash(password){const salt=crypto.randomBytes(16).toString('hex'),key=await scrypt(password,salt,64);return salt+':'+key.toString('hex');}
async function passwordMatches(password,encoded){
 const [salt,hex]=(encoded||'00000000000000000000000000000000:'+ '00'.repeat(64)).split(':');
 const actual=await scrypt(password,salt,64),expected=Buffer.from(hex,'hex');
 return expected.length===actual.length&&crypto.timingSafeEqual(expected,actual);
}
function sessionCookie(token,secure=true,clear=false){return `clipstock_session=${clear?'':token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear?0:604800}${secure?'; Secure':''}`;}
function cookieToken(req){const entry=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('clipstock_session='));const token=entry?.slice(18)||'';return /^[a-f0-9]{64}$/.test(token)?token:null;}
function checkOrigin(req){
 const origin=req.headers.origin;if(!origin)throw Object.assign(new Error('请求缺少来源信息，请刷新页面后重试。'),{status:403});
 let url;try{url=new URL(origin);}catch{throw Object.assign(new Error('无效请求来源。'),{status:403});}
 if(url.host!==req.headers.host||!['https:','http:'].includes(url.protocol))throw Object.assign(new Error('不允许跨站修改数据。'),{status:403});
}
async function rateLimit(db,key,max=15){
 const k=hash(key),r=await db.query(`INSERT INTO cs_rate_limits(key,hits) VALUES($1,1) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN cs_rate_limits.window_start < now()-interval '15 minutes' THEN 1 ELSE cs_rate_limits.hits+1 END, window_start=CASE WHEN cs_rate_limits.window_start < now()-interval '15 minutes' THEN now() ELSE cs_rate_limits.window_start END RETURNING hits`,[k]);
 if(r.rows[0].hits>max)throw Object.assign(new Error('尝试次数过多，请 15 分钟后重试。'),{status:429});
}
module.exports={hash,passwordHash,passwordMatches,sessionCookie,cookieToken,checkOrigin,rateLimit};
