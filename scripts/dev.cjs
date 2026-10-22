'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
// Optional embedded Postgres is ONLY for local tests / demo and is never deployed.
async function start(){
 if(process.env.CLIPSTOCK_DEV_DATABASE==='1'){
  if(process.env.VERCEL)throw Error('Embedded dev database cannot run on Vercel.');
  const {PGlite}=require('@electric-sql/pglite');const db=new PGlite(process.env.CLIPSTOCK_DEV_PATH||'memory://');
  await db.exec(fs.readFileSync(path.join(__dirname,'../server/schema.sql'),'utf8'));let tail=Promise.resolve();
  const adapter={query:(...args)=>db.query(...args),connect:async()=>{let release;const wait=tail;tail=new Promise(resolve=>release=resolve);await wait;return {query:(...args)=>db.query(...args),release};}};
  const mod=require('../server/db.cjs');mod.configured=()=>true;mod.database=async()=>adapter;
 }
 const api=require('../api/workspace.js'),root=path.join(__dirname,'../dist'),port=Number(process.env.PORT||8767);
 const server=http.createServer(async(req,res)=>{
  if(req.url.split('?')[0]==='/api/workspace'){return api(req,res);}
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{const content=fs.readFileSync(file);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8'})[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(content);}catch{res.writeHead(404).end('Not found');}
 });
 server.listen(port,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+port));
}
start().catch(e=>{console.error(e.message);process.exit(1);});
