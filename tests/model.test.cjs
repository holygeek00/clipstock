const assert=require('node:assert/strict');
const M=require('../dist/model.js');
assert.deepEqual(M.forecast({stock:120,rate:12},'2026-10-19','daily'),{days:10,consumeDays:10,date:'2026-10-29'});
assert.equal(M.forecast({stock:0,rate:0},'2026-10-19','daily').days,0);
assert.equal(M.forecast({stock:10,rate:0},'2026-10-19','daily').days,Infinity);
assert.equal(M.forecast({stock:1,rate:.1},'2026-10-19','daily').days,10);
assert.equal(M.forecast({stock:121,rate:12},'2026-10-19','daily').days,11);
let cases=0;
for(let day=1;day<=28;day++)for(let count=1;count<=100;count++){
 const base=`2026-10-${String(day).padStart(2,'0')}`, date=M.parseDate(base);let left=count,days=0;
 while(left>0){date.setDate(date.getDate()+1);days++;if(date.getDay()!==0&&date.getDay()!==6)left--;}
 const r=M.forecast({stock:count*3,rate:3},base,'weekdays');
 assert.equal(r.date,M.dateKey(date));assert.equal(r.days,days);
 assert.equal(M.remaining({stock:count*3,rate:3},base,days,'weekdays'),0);cases++;
}
assert.equal(M.forecast({stock:2,rate:1},'2026-12-31','daily').date,'2027-01-02');
assert.equal(M.forecast({stock:100000000,rate:.01},'2026-10-19','weekdays').veryLong,true);
const valid={version:1,employees:[{id:'e',name:'A'}],types:['IP 类'],items:[{id:'i',name:'X',employeeId:'e',type:'IP 类',stock:1,rate:1,note:''}],logs:[],settings:{baseDate:'2026-10-19',schedule:'daily',warningDays:14}};
assert.equal(M.validate(valid).items.length,1);
assert.throws(()=>M.validate({...valid,items:[{...valid.items[0],stock:-1}]}));
assert.throws(()=>M.validate({...valid,items:[{...valid.items[0],employeeId:'missing'}]}));
assert.throws(()=>M.validate({...valid,settings:{...valid.settings,baseDate:'2026-02-30'}}));
console.log(`Passed ${cases} weekday forecast comparisons and daily, rounding, zero, year-boundary, extreme and backup validation cases.`);
