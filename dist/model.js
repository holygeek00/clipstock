/* Forecasts consume on the first scheduled day AFTER the baseline snapshot. */
(function(root){
 'use strict';
 const parseDate=s=>new Date(s+'T12:00:00');
 const dateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 const active=(d,schedule)=>schedule!=='weekdays'||(d.getDay()!==0&&d.getDay()!==6);
 const dayDiff=(a,b)=>Math.round((Date.UTC(b.getFullYear(),b.getMonth(),b.getDate())-Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()))/86400000);
 function consumeDays(base,offset,schedule){const d=parseDate(base);let n=0;for(let i=0;i<offset;i++){d.setDate(d.getDate()+1);if(active(d,schedule))n++;}return n;}
 function forecast(item,base,schedule){
  if(item.stock<=0)return {days:0,consumeDays:0,date:base};
  if(item.rate<=0)return {days:Infinity,consumeDays:Infinity,date:null};
  const count=Math.ceil(Number((item.stock/item.rate).toPrecision(14)));
  // Compute weeks directly to avoid loops for very large stocks or tiny rates.
  const d=parseDate(base); let left=count;
  if(schedule==='weekdays'){
   while(left>0&&d.getDay()!==1){d.setDate(d.getDate()+1);if(active(d,schedule))left--;}
   if(left>0){const weeks=Math.floor(left/5);d.setDate(d.getDate()+weeks*7);left-=weeks*5;while(left>0){d.setDate(d.getDate()+1);if(active(d,schedule))left--;}}
  }else d.setDate(d.getDate()+count);
  if(!Number.isFinite(d.getTime())||d.getFullYear()>9999)return {days:Infinity,consumeDays:count,date:null,veryLong:true};
  return {days:dayDiff(parseDate(base),d),consumeDays:count,date:dateKey(d)};
 }
 function remaining(item,base,offset,schedule){return Math.max(0,item.stock-item.rate*consumeDays(base,offset,schedule));}
 function validate(data){
  if(!data||data.version!==1||!Array.isArray(data.employees)||!Array.isArray(data.types)||!Array.isArray(data.items)||!Array.isArray(data.logs)||!data.settings)throw Error('备份格式不正确，请选择片仓导出的 JSON 文件。');
  if(data.employees.length>1000||data.items.length>10000||data.logs.length>50000||data.types.length>1000)throw Error('备份数据量超出支持范围。');
  const str=(s,n)=>typeof s==='string'&&s.length>0&&s.length<=n;
  if(!data.employees.every(e=>e&&str(e.id,100)&&str(e.name,30))||new Set(data.employees.map(e=>e.id)).size!==data.employees.length)throw Error('员工数据不正确。');
  if(!data.types.every(t=>str(t,20))||new Set(data.types).size!==data.types.length)throw Error('视频类型数据不正确。');
  const number=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100000000;
  if(!data.items.every(i=>i&&str(i.id,100)&&str(i.name,60)&&data.employees.some(e=>e.id===i.employeeId)&&data.types.includes(i.type)&&number(i.stock)&&Number.isInteger(i.stock)&&number(i.rate)&&typeof i.note==='string'&&i.note.length<=120)||new Set(data.items.map(i=>i.id)).size!==data.items.length)throw Error('素材数据不正确或员工、类型不存在。');
  const s=data.settings;
  if(!['daily','weekdays'].includes(s.schedule)||!Number.isInteger(s.warningDays)||s.warningDays<1||s.warningDays>365||!/^\d{4}-\d{2}-\d{2}$/.test(s.baseDate)||!Number.isFinite(parseDate(s.baseDate).getTime())||dateKey(parseDate(s.baseDate))!==s.baseDate)throw Error('消耗规则或基准日期不正确。');
  if(!data.logs.every(l=>l&&str(l.id,100)&&str(l.name,60)&&str(l.employee,30)&&['新增','补充','消耗','校准','删除'].includes(l.kind)&&typeof l.delta==='number'&&Number.isFinite(l.delta)&&Math.abs(l.delta)<=100000000&&number(l.stock)&&typeof l.note==='string'&&l.note.length<=120&&typeof l.time==='string'&&Number.isFinite(new Date(l.time).getTime())))throw Error('变动记录不正确。');
  return JSON.parse(JSON.stringify(data));
 }
 const api={parseDate,dateKey,consumeDays,forecast,remaining,validate};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StockModel=api;
})(globalThis);
