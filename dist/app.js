'use strict';
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const M=StockModel, KEY='clipstock.workspace.v1';
const paths={film:'M3 3h18v18H3z M7 3v18 M17 3v18 M3 8h4 M3 16h4 M17 8h4 M17 16h4',grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',layers:'m12 3 10 5-10 5L2 8z M2 12l10 5 10-5 M2 16l10 5 10-5',users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87',clock:'M12 8v5l3 2 M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',download:'M12 3v12 m-4-4 4 4 4-4 M4 16v5h16v-5',plus:'M12 5v14 M5 12h14',search:'M21 21l-5-5 M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16',box:'m12 2 9 5v10l-9 5-9-5V7z M3 7l9 5 9-5 M12 12v10',arrow:'M3 16l6-6 4 4 8-10 M15 4h6v6',bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',video:'M3 5h12v14H3z M15 9l6-3v12l-6-3',file:'M5 2h9l5 5v15H5z M14 2v6h5 M8 13h8 M8 17h5'};
function icon(n){return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[n]||paths.film}"/></svg>`;}
function icons(){ $$('[data-icon]').forEach(e=>{e.innerHTML=icon(e.dataset.icon);e.removeAttribute('data-icon');}); }
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const num=n=>Number(n).toLocaleString('zh-CN',{maximumFractionDigits:2});
const uid=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
const today=()=>M.dateKey(new Date());
const shortDate=s=>s?`${Number(s.slice(5,7))}月${Number(s.slice(8,10))}日`:'不预计耗尽';
const fullDate=s=>s?`${s.slice(0,4)}.${s.slice(5,7)}.${s.slice(8,10)}`:'—';
function initial(){return {version:1,demo:true,employees:[{id:'e1',name:'小林'},{id:'e2',name:'阿杰'},{id:'e3',name:'小陈'}],types:['IP 类','口播类','图文类','其他'],items:[{id:'i1',name:'人物 IP 日常原片',employeeId:'e1',type:'IP 类',stock:360,rate:12,note:'人物故事 / 日常记录'},{id:'i2',name:'室内口播原片',employeeId:'e2',type:'口播类',stock:120,rate:12,note:'知识分享 / 室内拍摄'},{id:'i3',name:'产品实拍图片',employeeId:'e3',type:'图文类',stock:240,rate:8,note:'产品细节 / 场景图片'},{id:'i4',name:'生活场景空镜',employeeId:'e1',type:'IP 类',stock:180,rate:6,note:'场景过渡 / B-roll'},{id:'i5',name:'图文封面模板',employeeId:'e3',type:'图文类',stock:80,rate:0,note:'暂不消耗'}],settings:{baseDate:today(),schedule:'daily',warningDays:14},logs:[]};}
let state,loadError='';
try{const raw=localStorage.getItem(KEY);state=raw?M.validate(JSON.parse(raw)):initial();}catch(e){state=initial();loadError='本地数据无法读取，已显示示例。原存储未覆盖，请先导出或检查浏览器权限。';}
let view='overview',employeeFilter='all',typeFilter='all',statusFilter='all',query='',range=30,editId=null,employeeEditId=null,movementId=null,movementKind=null,afterEmployee=null;
function persist(){try{const previous=localStorage.getItem(KEY),next=JSON.stringify(state);if(previous&&previous!==next){try{M.validate(JSON.parse(previous));localStorage.setItem(KEY+'.previous',previous);}catch{}}localStorage.setItem(KEY,next);$('#save-label').textContent='● 数据已在本地保存';loadError='';return true;}catch(e){$('#save-label').textContent='⚠ 保存失败，请导出备份';toast('浏览器存储不可用或已满，请立即导出备份。');return false;}}
let toastTimer;function toast(s){$('#toast').textContent=s;$('#toast').classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.add('hidden'),5000);}
function employeeName(id){return state.employees.find(e=>e.id===id)?.name||'已删除员工';}
function rows(){return state.items.filter(i=>(employeeFilter==='all'||i.employeeId===employeeFilter)&&(typeFilter==='all'||i.type===typeFilter));}
function f(i){return M.forecast(i,state.settings.baseDate,state.settings.schedule);}
function status(i){if(i.stock===0)return 'empty';if(i.rate===0)return 'pause';return f(i).days<=state.settings.warningDays?'warn':'ok';}
function earliest(items){return items.map(i=>({item:i,...f(i)})).filter(x=>Number.isFinite(x.days)).sort((a,b)=>a.days-b.days)[0];}
const statusNames={empty:'已耗尽',warn:'需要补充',ok:'库存充足',pause:'暂不消耗'};
function option(value,label,selected){return `<option value="${esc(value)}"${selected?' selected':''}>${esc(label)}</option>`;}
function renderFilters(){
 if(employeeFilter!=='all'&&!state.employees.some(e=>e.id===employeeFilter))employeeFilter='all';
 if(typeFilter!=='all'&&!state.types.includes(typeFilter))typeFilter='all';
 $('#employee-filter').innerHTML=option('all','全部员工',employeeFilter==='all')+state.employees.map(e=>option(e.id,e.name,e.id===employeeFilter)).join('');
 $('#type-filter').innerHTML=option('all','全部视频类型',typeFilter==='all')+state.types.map(t=>option(t,t,t===typeFilter)).join('');
 $('#base-date').value=state.settings.baseDate;
}
function renderStats(){
 const items=rows(),stock=items.reduce((s,i)=>s+i.stock,0),rate=items.reduce((s,i)=>s+i.rate,0),warn=items.filter(i=>['warn','empty'].includes(status(i))).length,staff=new Set(items.map(i=>i.employeeId)).size;
 const stats=[['素材总库存',num(stock),'条',`${items.length} 项素材独立库存`,'box',false],['计划每日消耗',num(rate),'条 / 天',state.settings.schedule==='weekdays'?'仅周一至周五消耗':'按自然日持续消耗','arrow',false],['待补充库存',num(warn),'项',`耗尽或 ${state.settings.warningDays} 个自然日内耗尽`,'bell',warn>0],['当前覆盖员工',num(staff),'位',`涵盖 ${new Set(items.map(i=>i.type)).size} 种视频类型`,'users',false]];
 $('#stats').innerHTML=stats.map(s=>`<article class="stat${s[5]?' alert':''}"><div class="stat-label">${s[0]}${icon(s[4])}</div><div class="stat-number">${s[1]}<span>${s[2]}</span></div><div class="stat-note">${s[3]}</div></article>`).join('');
}
function renderChart(){
 const items=rows(),types=state.types.filter(t=>items.some(i=>i.type===t)),colors=['#5c8d70','#c4a875','#8b9fae','#ac8fa5','#91a65d','#c38767'];
 const series=types.map((t,i)=>({type:t,color:colors[state.types.indexOf(t)%colors.length],items:items.filter(x=>x.type===t)}));
 const max=Math.max(1,...series.map(s=>s.items.reduce((sum,i)=>sum+i.stock,0))),step=Math.max(1,Math.pow(10,Math.floor(Math.log10(max)))/2),top=Math.ceil(max/step)*step;
 const x=d=>48+d/range*607,y=v=>190-v/top*153;
 let svg='';for(let k=0;k<5;k++){const v=top*k/4;svg+=`<line class="grid" x1="48" y1="${y(v)}" x2="655" y2="${y(v)}"/><text x="37" y="${y(v)+3}" text-anchor="end">${v>=10000?num(v/10000)+'万':num(Math.round(v))}</text>`;}
 svg+='<text x="48" y="17">剩余素材 / 条</text>';
 const times=Array.from({length:range+1},(_,d)=>M.consumeDays(state.settings.baseDate,d,state.settings.schedule));
 const warn=state.settings.warningDays;if(warn<=range){svg+=`<line x1="${x(warn)}" y1="32" x2="${x(warn)}" y2="190" stroke="#d9c29e" stroke-dasharray="4 4"/><text x="${Math.min(x(warn)+6,575)}" y="27" style="fill:#bc9d70">${warn} 天预警线</text>`;}
 series.forEach(s=>{const points=times.map((n,d)=>[x(d),y(s.items.reduce((sum,i)=>sum+Math.max(0,i.stock-i.rate*n),0))]);const p=points.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');svg+=`<path d="${p} L655,190 L48,190 Z" fill="${s.color}" opacity=".045"/><path d="${p}" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linejoin="round"/>`;const end=points[points.length-1];svg+=`<circle cx="${end[0]}" cy="${end[1]}" r="3" fill="${s.color}"/>`;});
 for(let k=0;k<=5;k++){const d=Math.round(range*k/5),date=M.parseDate(state.settings.baseDate);date.setDate(date.getDate()+d);svg+=`<text x="${x(d)}" y="217" text-anchor="middle">${date.getMonth()+1}/${date.getDate()}</text>`;}
 if(!items.length)svg+='<text x="350" y="103" text-anchor="middle" style="font-size:13px">录入素材后，在这里查看未来库存</text>';
 $('#chart').innerHTML=svg;
 $('#chart').setAttribute('aria-label',`未来 ${range} 天素材剩余量预测，当前范围共 ${num(items.reduce((s,i)=>s+i.stock,0))} 条。`);
 $('#chart-legend').innerHTML=series.map(s=>`<span><span class="legend-dot" style="background:${s.color}"></span>${esc(s.type)}</span>`).join('');
 $('#schedule-label').textContent=state.settings.schedule==='daily'?'每天消耗 · 含周末':'工作日消耗 · 周末暂停';
}
function renderForecast(){
 const items=rows(),first=earliest(items),noDate=items.some(i=>f(i).veryLong);
 $('#forecast').innerHTML=`<div class="forecast-label">${icon('clock')}最早一项预计还能用</div><div class="forecast-number">${first?first.days:'—'}<span>自然日</span></div><div class="forecast-date">${first?'预计 '+fullDate(first.date)+' 耗尽':items.length?(noDate?'库存周期过长，超出日期显示范围':'当前素材均未设置消耗'):'录入库存，开启你的预测'}</div><div class="forecast-detail"><strong>${first?esc(first.item.name):'让下一次拍摄更从容'}</strong><p>${first?esc(employeeName(first.item.employeeId))+' · '+esc(first.item.type)+'<br>库存 '+num(first.item.stock)+' 条 · 每天消耗 '+num(first.item.rate)+' 条':'设置库存和每天消耗量<br>自动发现最先需要补充的素材'}</p></div><button class="text-button" id="forecast-action">${first?'查看这项素材':'录入第一项素材'} <span aria-hidden="true">↗</span></button>`;
 $('#forecast-action').onclick=()=>openItem(first?.item.id||null);
}
function renderTable(){
 const all=rows(),items=all.filter(i=>{const s=status(i);return (statusFilter==='all'||(statusFilter==='warn'?['warn','empty'].includes(s):s===statusFilter))&&(!query||(i.name+' '+employeeName(i.employeeId)+' '+i.type+' '+i.note).toLowerCase().includes(query.toLowerCase()));}).sort((a,b)=>f(a).days-f(b).days);
 $('#item-count').textContent=items.length+' 项';
 $('#inventory-body').innerHTML=items.map(i=>{const forecast=f(i),s=status(i),e=employeeName(i.employeeId),pct=i.rate?Math.min(100,forecast.days/Math.max(30,state.settings.warningDays)*100):100;return `<tr><td><div class="material-cell"><div class="material-icon">${icon(i.type==='图文类'?'file':'video')}</div><div><strong>${esc(i.name)}</strong><small><span class="type-label">${esc(i.type)}</span>${i.note?' · '+esc(i.note.length>14?i.note.slice(0,14)+'…':i.note):''}</small></div></div></td><td><span class="employee"><i>${esc(Array.from(e)[0])}</i>${esc(e)}</span></td><td><div class="quantity">${num(i.stock)}<small>条</small></div><div class="mini-bar"><span style="width:${pct}%;background:${s==='warn'||s==='empty'?'#d3ae7e':'#92b087'}"></span></div></td><td>${num(i.rate)}<small style="color:#a0aa9d"> / 天</small></td><td style="color:${s==='warn'||s==='empty'?'#b58e61':'#7a8b73'}">${forecast.date?fullDate(forecast.date):(forecast.veryLong?'周期过长':'—')}<small style="display:block;font-size:9px;color:#a1ab9b">${Number.isFinite(forecast.days)?forecast.days===0?'当前已无库存':'约 '+num(forecast.days)+' 个自然日':forecast.veryLong?'超出日期显示范围':'未设置消耗'}</small></td><td><span class="status ${s}">${statusNames[s]}</span></td><td><div class="row-actions"><button data-restock="${esc(i.id)}">补充</button><button data-consume="${esc(i.id)}">消耗</button><button data-edit="${esc(i.id)}">编辑</button></div></td></tr>`;}).join('');
 $('#inventory-empty').classList.toggle('hidden',items.length>0);
 $('#table-note').textContent=`显示 ${items.length} / ${all.length} 项 · 预警阈值 ${state.settings.warningDays} 个自然日`;
 $$('[data-edit]').forEach(b=>b.onclick=()=>openItem(b.dataset.edit));
 $$('[data-restock]').forEach(b=>b.onclick=()=>openMovement(b.dataset.restock,'补充'));
 $$('[data-consume]').forEach(b=>b.onclick=()=>openMovement(b.dataset.consume,'消耗'));
}
function renderStaff(){
 $('#staff-grid').innerHTML=state.employees.length?state.employees.map(e=>{const items=state.items.filter(i=>i.employeeId===e.id),first=earliest(items),warn=items.filter(i=>['warn','empty'].includes(status(i))).length;return `<div class="panel staff-card"><div class="staff-head"><div class="avatar">${esc(Array.from(e.name)[0])}</div><div><strong>${esc(e.name)}</strong><small>${items.length} 项素材 · ${new Set(items.map(i=>i.type)).size} 种视频类型</small></div><button class="iconbutton" style="margin-left:auto" data-edit-employee="${esc(e.id)}" aria-label="编辑${esc(e.name)}">${icon('settings')}</button></div><div class="staff-stats"><div><b>${num(items.reduce((s,i)=>s+i.stock,0))}</b><span>素材库存 / 条</span></div><div><b>${num(items.reduce((s,i)=>s+i.rate,0))}</b><span>计划消耗 / 条每天</span></div></div><div class="staff-bottom"><span>${first?`最早 ${shortDate(first.date)} 耗尽`:'暂无消耗预测'}${warn?` · ${warn} 项待补充`:''}</span><button class="button small" data-staff-items="${esc(e.id)}">查看库存 ↗</button></div></div>`;}).join(''):'<div class="panel empty-state"><strong>先添加第一位员工</strong>每位员工可以分别管理 IP、口播、图文等素材。</div>';
 $$('[data-edit-employee]').forEach(b=>b.onclick=()=>openEmployee(b.dataset.editEmployee));
 $$('[data-staff-items]').forEach(b=>b.onclick=()=>{employeeFilter=b.dataset.staffItems;typeFilter='all';statusFilter='all';query='';$('#search').value='';$('#status-filter').value='all';setView('inventory');});
}
function renderLogs(){
 const logs=[...state.logs].reverse().slice(0,200);
 $('#log-count').textContent=state.logs.length+' 条记录'+(state.logs.length>200?' · 展示最近 200 条':'');
 $('#logs-empty').classList.toggle('hidden',logs.length>0);
 $('#logs-body').innerHTML=logs.map(l=>`<tr><td>${esc(new Date(l.time).toLocaleString('zh-CN',{hour12:false}))}</td><td>${esc(l.name)}<small style="display:block;color:#a1ac99">${esc(l.employee)}</small></td><td>${esc(l.kind)}</td><td style="color:${l.delta>0?'#65905b':l.delta<0?'#ba8b68':'#8a9b80'}">${l.delta>0?'+':''}${num(l.delta)} 条</td><td>${num(l.stock)} 条</td><td>${esc(l.note||'—')}</td></tr>`).join('');
}
function renderSettings(){
 $('#schedule').value=state.settings.schedule;$('#warning-days').value=state.settings.warningDays;
 $('#type-list').innerHTML=state.types.map(t=>`<span class="type-chip">${esc(t)}</span>`).join('');
}
function render(){
 renderFilters();renderStats();renderChart();renderForecast();renderTable();renderStaff();renderLogs();renderSettings();icons();
 $('#demo-banner').classList.toggle('hidden',!state.demo);
 $('#footer-note').textContent=`基准日 ${fullDate(state.settings.baseDate)} · ${state.settings.schedule==='weekdays'?'周一至周五消耗':'每天消耗'} · 预测不自动扣库存`;
}
const views={overview:['素材库存概览','从今天的库存，看见接下来的创作节奏。','YOUR MATERIALS, IN PERSPECTIVE','库存概览'],inventory:['素材库存','按员工与视频类型，管理每一项剪辑素材。','A PLACE FOR EVERY CLIP','素材库存'],staff:['员工管理','每个人的素材储备与消耗节奏，一目了然。','YOUR CREATIVE TEAM','员工管理'],logs:['库存变动记录','真实的补充与消耗，都有迹可循。','EVERY CHANGE, REMEMBERED','变动记录'],settings:['消耗与设置','为团队设定合适的库存预警规则。','MAKE IT WORK FOR YOU','消耗与设置']};
function setView(v){
 view=v;const t=views[v];$('#page-title').textContent=t[0];$('#page-desc').textContent=t[1];$('#eyebrow').textContent=t[2];$('#breadcrumb').textContent=t[3];
 $$('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===v);b.setAttribute('aria-current',b.dataset.view===v?'page':'false');});
 $('#filters').classList.toggle('hidden',!['overview','inventory'].includes(v));$('#stats').classList.toggle('hidden',!['overview','inventory'].includes(v));$('#overview').classList.toggle('hidden',v!=='overview');$('#inventory').classList.toggle('hidden',!['overview','inventory'].includes(v));
 ['staff','logs','settings'].forEach(x=>$('#'+x+'-view').classList.toggle('hidden',v!==x));
 $('#add-btn').innerHTML=icon('plus')+(v==='staff'?'添加员工':'录入素材');render();
}
function addLog(item,kind,delta,note=''){state.logs.push({id:uid(),name:item.name,employee:employeeName(item.employeeId),kind,delta,stock:item.stock,time:new Date().toISOString(),note});}
function commit(message){return saveWorkspace(message);}
function showConfirm(title,desc,fn,label='确认'){ $('#confirm-title').textContent=title;$('#confirm-desc').textContent=desc;$('#confirm-yes').textContent=label;$('#confirm-yes').onclick=()=>{$('#confirm-dialog').close();fn();};$('#confirm-dialog').showModal(); }
function openEmployee(id=null){employeeEditId=id;$('#employee-form').reset();$('#employee-error').textContent='';$('#employee-dialog-title').textContent=id?'编辑员工':'添加员工';$('#delete-employee').classList.toggle('hidden',!id);if(id)$('#employee-name').value=employeeName(id);$('#employee-dialog').showModal();}
function openItem(id=null){
 if(!state.employees.length){afterEmployee=()=>openItem();toast('先添加一位员工，再录入素材。');openEmployee();return;}
 editId=id;$('#item-form').reset();$('#item-error').textContent='';$('#item-dialog-title').textContent=id?'编辑素材':'录入素材';$('#delete-item').classList.toggle('hidden',!id);
 const i=state.items.find(i=>i.id===id);$('#item-employee').innerHTML=state.employees.map(e=>option(e.id,e.name,e.id===(i?.employeeId||(employeeFilter!=='all'?employeeFilter:state.employees[0].id)))).join('');
 $('#item-type').innerHTML=state.types.map(t=>option(t,t,t===(i?.type||(typeFilter!=='all'?typeFilter:state.types[0])))).join('');
 if(i){$('#item-name').value=i.name;$('#item-stock').value=i.stock;$('#item-rate').value=i.rate;$('#item-note').value=i.note;}
 $('#item-dialog').showModal();
}
function openMovement(id,kind){
 const i=state.items.find(i=>i.id===id);movementId=id;movementKind=kind;$('#movement-form').reset();$('#movement-error').textContent='';$('#movement-title').textContent=kind==='补充'?'补充库存':'登记实际消耗';$('#movement-desc').textContent=`${i.name} · ${employeeName(i.employeeId)} · 当前库存 ${num(i.stock)} 条`;$('#movement-amount').max=kind==='消耗'?i.stock:100000000-i.stock;$('#movement-dialog').showModal();
}
$('#item-form').onsubmit=e=>{
 e.preventDefault();const stock=Number($('#item-stock').value),rate=Number($('#item-rate').value),name=$('#item-name').value.trim();
 if(!name||!Number.isInteger(stock)||stock<0||stock>100000000||!Number.isFinite(rate)||rate<0||rate>100000000){$('#item-error').textContent='请输入有效的名称、整数库存和非负日消耗量。';return;}
 const employeeId=$('#item-employee').value,type=$('#item-type').value;
 if(state.items.some(i=>i.id!==editId&&i.name===name&&i.employeeId===employeeId&&i.type===type)){$('#item-error').textContent='该员工的同类素材中已存在相同名称，请编辑已有记录。';return;}
 const old=state.items.find(i=>i.id===editId),item={id:editId||uid(),name,employeeId,type,stock,rate,note:$('#item-note').value.trim()};
 if(old){const delta=stock-old.stock;Object.assign(old,item);if(delta)addLog(old,'校准',delta,'编辑库存数量');}else{state.items.push(item);addLog(item,'新增',stock,item.note);}
 $('#item-dialog').close();commit(old?'素材已更新':'素材已录入');
};
$('#employee-form').onsubmit=e=>{
 e.preventDefault();const name=$('#employee-name').value.trim();if(!name||state.employees.some(x=>x.name===name&&x.id!==employeeEditId)){$('#employee-error').textContent='请输入姓名，且不要与已有员工重名。';return;}
 const old=state.employees.find(x=>x.id===employeeEditId);if(old)old.name=name;else state.employees.push({id:uid(),name});
 $('#employee-dialog').close();commit('员工已保存');const fn=afterEmployee;afterEmployee=null;if(fn)fn();
};
$('#employee-dialog').addEventListener('close',()=>{if(afterEmployee&&!state.employees.length)afterEmployee=null;});
$('#movement-form').onsubmit=e=>{
 e.preventDefault();const i=state.items.find(i=>i.id===movementId),amount=Number($('#movement-amount').value);
 if(!i||!Number.isInteger(amount)||amount<=0||amount>100000000||(movementKind==='消耗'&&amount>i.stock)||(movementKind==='补充'&&amount+i.stock>100000000)){$('#movement-error').textContent='数量无效；实际消耗不能超过当前库存。';return;}
 const delta=movementKind==='消耗'?-amount:amount;i.stock+=delta;addLog(i,movementKind,delta,$('#movement-note').value.trim());$('#movement-dialog').close();commit('已登记'+movementKind+' '+num(amount)+' 条');
};
$('#delete-item').onclick=()=>{const i=state.items.find(x=>x.id===editId);$('#item-dialog').close();showConfirm('删除素材',`删除「${i.name}」及其当前库存？历史变动记录会保留。`,()=>{addLog({...i,stock:0},'删除',-i.stock,'删除素材库存');state.items=state.items.filter(x=>x.id!==i.id);commit('素材已删除');},'删除');};
$('#delete-employee').onclick=()=>{if(state.items.some(i=>i.employeeId===employeeEditId)){$('#employee-error').textContent='该员工仍有素材，请先转移或删除其素材后再删除员工。';return;}const id=employeeEditId,name=employeeName(id);$('#employee-dialog').close();showConfirm('删除员工',`确认删除员工「${name}」？`,()=>{state.employees=state.employees.filter(e=>e.id!==id);commit('员工已删除');},'删除');};
$$('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$$('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
$('#add-btn').onclick=()=>view==='staff'?openEmployee():openItem();
$('#employee-filter').onchange=e=>{employeeFilter=e.target.value;render();};$('#type-filter').onchange=e=>{typeFilter=e.target.value;render();};
$('#status-filter').onchange=e=>{statusFilter=e.target.value;renderTable();};$('#search').oninput=e=>{query=e.target.value;renderTable();};
$('#chart-ranges').onclick=e=>{const b=e.target.closest('[data-days]');if(!b)return;range=Number(b.dataset.days);$$('[data-days]').forEach(x=>x.classList.toggle('active',x===b));renderChart();};
$('#base-date').onchange=e=>{const value=e.target.value;if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(M.parseDate(value).getTime())||M.dateKey(M.parseDate(value))!==value){e.target.value=state.settings.baseDate;toast('请输入有效的库存基准日期。');return;}state.settings.baseDate=value;commit('库存基准日已更新；库存数保持录入值。');};
$('#settings-form').onsubmit=e=>{e.preventDefault();const days=Number($('#warning-days').value);if(!Number.isInteger(days)||days<1||days>365)return;state.settings.warningDays=days;state.settings.schedule=$('#schedule').value;commit('消耗与预警规则已更新');};
$('#type-form').onsubmit=e=>{e.preventDefault();const t=$('#new-type').value.trim();if(!t||state.types.includes(t)){toast('请输入新的类型名称，已有类型无需重复添加。');return;}state.types.push(t);$('#new-type').value='';commit('视频类型已添加');};
function clearData(){state={version:1,demo:false,employees:[],types:['IP 类','口播类','图文类','其他'],items:[],logs:[],settings:{baseDate:today(),schedule:'daily',warningDays:14}};employeeFilter='all';typeFilter='all';query='';statusFilter='all';$('#search').value='';$('#status-filter').value='all';commit('工作空间已清空，请先添加员工');setView('staff');}
$('#start-btn').onclick=()=>showConfirm('开始使用你的工作空间','将移除当前全部员工、素材与记录，包括在示例空间新增的数据。请先导出需要保留的数据。',clearData,'清空示例并开始');
$('#clear-btn').onclick=()=>showConfirm('清空全部数据','将删除所有员工、素材和变动记录。建议先导出备份；团队管理员也可从云端自动备份恢复。',clearData,'清空全部');
function exportData(){const data={...state,exportedAt:new Date().toISOString()},blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`片仓备份-${today()}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);toast('备份已导出，请妥善保存 JSON 文件。');}
$('#export-btn').onclick=exportData;$('#export-settings').onclick=exportData;$('#import-btn').onclick=()=>$('#import-file').click();
$('#import-file').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;if(file.size>5*1024*1024){toast('备份文件过大，支持 5 MB 以内的 JSON 文件。');return;}try{const incoming=M.validate(JSON.parse(await file.text()));showConfirm('恢复备份',`此备份含 ${incoming.employees.length} 位员工、${incoming.items.length} 项素材。导入会覆盖当前工作空间，请确认已备份现有数据。`,()=>{state=incoming;employeeFilter='all';typeFilter='all';query='';statusFilter='all';$('#search').value='';$('#status-filter').value='all';commit('备份已恢复');},'覆盖并恢复');}catch(error){toast(error instanceof SyntaxError?'无法解析该文件，请选择有效的 JSON 备份。':error.message);}};
render();icons();if(loadError){$('#save-label').textContent='⚠ 本地数据读取失败';toast(loadError);}
