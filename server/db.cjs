'use strict';
const {readFileSync}=require('node:fs');
const path=require('node:path');
let pool, ready;
function configured(){return Boolean(process.env.DATABASE_URL);}
async function database(){
 if(!configured())throw Object.assign(new Error('云数据库尚未配置。'),{status:503});
 if(!pool){const {Pool}=require('pg');pool=new Pool({connectionString:process.env.DATABASE_URL,max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:10000});pool.on('error',()=>{});}
 if(!ready)ready=pool.query(readFileSync(path.join(__dirname,'schema.sql'),'utf8')).catch(e=>{ready=null;throw e;});
 await ready;return pool;
}
module.exports={database,configured};
