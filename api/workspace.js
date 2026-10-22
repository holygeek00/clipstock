'use strict';
const DB=require('../server/db.cjs'),S=require('../server/security.cjs'),service=require('../server/service.cjs');
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const send=(status,value)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(value));};
 try{
  const url=new URL(req.url,'http://localhost'),action=url.searchParams.get('action')||'session',method=req.method;
  if(action==='session'&&method==='GET'&&!DB.configured())return send(200,{configured:false,account:null});
  if(!['GET','POST','PUT'].includes(method))return send(405,{error:'不支持该请求方式。'});
  if(method!=='GET'){S.checkOrigin(req);if(!String(req.headers['content-type']||'').startsWith('application/json'))service.fail(415,'请求必须为 JSON 格式。');}
  let input={};if(method!=='GET'){
   if(Number(req.headers['content-length']||0)>2800000)service.fail(413,'请求内容过大。');
   if(req.body)input=typeof req.body==='string'?JSON.parse(req.body):req.body;
   else{let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>2800000)service.fail(413,'请求内容过大。');}input=raw?JSON.parse(raw):{};}
   if(!input||typeof input!=='object'||Array.isArray(input))service.fail(400,'无效请求内容。');
  }
  const db=await DB.database(),raw=S.cookieToken(req),a=await service.session(db,raw);
  const secure=process.env.VERCEL==='1'||req.headers['x-forwarded-proto']==='https';
  if(action==='session'&&method==='GET')return send(200,{configured:true,account:a?service.publicAccount(a):null});
  if(['login','register'].includes(action)&&method==='POST'){
   const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
   await S.rateLimit(db,'auth-ip:'+ip,40);await S.rateLimit(db,'auth-user:'+String(input.username||'').toLowerCase(),15);
   const result=await service[action](db,input);res.setHeader('Set-Cookie',S.sessionCookie(result.token,secure));return send(200,{account:result.account,joined:Boolean(result.joined)});
  }
  if(!a)service.fail(401,'登录已过期，请重新登录。');
  if(action!=='logout'&&req.headers['x-clipstock-team']!==a.team_id)throw Object.assign(new Error('团队会话已在另一个页面切换。请先导出草稿，再重新登录或刷新页面。'),{status:409,code:'team_session_changed'});
  if(action==='logout'&&method==='POST'){await db.query('DELETE FROM cs_sessions WHERE token_hash=$1',[S.hash(raw)]);res.setHeader('Set-Cookie',S.sessionCookie('',secure,true));return send(200,{ok:true});}
  if(action==='data'&&method==='GET')return send(200,await service.data(db,a));
  if(action==='data'&&method==='PUT')return send(200,await service.save(db,a,input));
  if(action==='members'&&method==='GET')return send(200,await service.members(db,a));
  if(action==='teams'&&method==='GET')return send(200,await service.teams(db,a));
  if(action==='snapshots'&&method==='GET')return send(200,await service.snapshots(db,a));
  if(['invite','join','revoke','restore','switchTeam'].includes(action)&&method==='POST'){
   const result=await service[action](db,a,input);
   if(result.token){res.setHeader('Set-Cookie',S.sessionCookie(result.token,secure));return send(200,{account:result.account});}
   return send(200,result);
  }
  return send(404,{error:'请求的操作不存在。'});
 }catch(e){const status=e.status|| (e instanceof SyntaxError?400:500);if(status===500)console.error('workspace error',{code:e.code||'unknown',name:e.name});return send(status,{error:status===500?'云服务暂时不可用，请稍后重试。':e.message,...(e.code==='team_session_changed'?{code:e.code}:{})});}
};
