'use strict';
let authMode='login',pendingInvite='',cloudPoll=null;
const roleNames={owner:'管理员',editor:'编辑成员',viewer:'只读成员'};
const mutationSelectors='#add-btn,#base-date,#item-form button[type="submit"],#employee-form button[type="submit"],#movement-form button[type="submit"],#delete-item,#delete-employee,#start-btn,#clear-btn,#settings-form input,#settings-form select,#settings-form button,#type-form input,#type-form button,#import-btn,[data-restock],[data-consume],[data-edit],[data-edit-employee]';
function cloudChrome(){
 const cloud=Cloud.mode==='cloud',account=Cloud.account;
 $('#team-open').textContent=account?account.teamName+' · '+roleNames[account.role]:'登录 / 团队同步';
 $('#draft-retry').disabled=Cloud.mode==='cloud'&&!Cloud.loaded;
 $('#team-summary').textContent=account?`${account.teamName} · ${account.name}（${roleNames[account.role]}）`:'当前为本机工作空间；登录后可使用团队云端库存。';
 $('#cloud-storage-label').textContent=cloud?'团队云端工作空间':'本地工作空间';
 $('#cloud-storage-desc').textContent=cloud?'数据保存在团队数据库，多设备共用。':'数据自动保存在此浏览器，建议定期导出备份。';
 $('#cloud-server-note').textContent=Cloud.configured?'云服务已连接。团队库存受登录与成员权限保护。':'此环境未连接云数据库，当前只能使用本机模式。';
 $('#team-login').classList.toggle('hidden',Boolean(account));$('#team-logout').classList.toggle('hidden',!account);
 $('#team-admin').classList.toggle('hidden',!account||account.role!=='owner');$('#members-section').classList.toggle('hidden',!account);
 $('#cloud-readonly').classList.toggle('hidden',!cloud||account.role!=='viewer');
 const frozen=cloud&&(account.role==='viewer'||Cloud.dirty||Cloud.saving);
 $$(mutationSelectors).forEach(e=>e.disabled=frozen);
 if(cloud)$('#save-label').textContent=Cloud.saving?'◌ 正在保存到云端':Cloud.dirty?'⚠ 本机有未同步草稿':'● 云端已保存 · 版本 '+Cloud.revision;
 if(Cloud.saving)$('#team-sync-status').textContent='正在保存…';else $('#team-sync-status').textContent=cloud?(Cloud.dirty?'草稿待处理':'已同步 · v'+Cloud.revision):'本机模式';
 $('#footer-note').textContent+=cloud?' · 团队云同步':'';
}
const baseRender=render;
render=function(){baseRender();cloudChrome();};
function showCloudIssue(message){$('#cloud-issue-text').textContent=message;$('#cloud-issue').classList.remove('hidden');cloudChrome();}
function dismissCloudIssue(){$('#cloud-issue').classList.add('hidden');$('#cloud-reauth').classList.add('hidden');}
function freezeSaving(on){Cloud.saving=on;cloudChrome();}
async function loadCloud(discard=false){
 const result=await Cloud.request('data');Cloud.latest=result;Cloud.loaded=true;state=M.validate(result.data);Cloud.revision=result.revision;Cloud.mode='cloud';Cloud.dirty=false;
 if(discard)Cloud.removeDraft();
 const draft=!discard&&Cloud.readDraft();
 if(draft){state=draft.data;Cloud.revision=draft.revision;Cloud.dirty=true;showCloudIssue('发现未同步的本机草稿。你可以导出草稿、重试保存，或放弃草稿并加载云端库存。');}
 else dismissCloudIssue();
 render();
}
async function saveWorkspace(message){
 if(Cloud.mode!=='cloud'){const ok=persist();render();if(ok&&message)toast(message);return ok;}
 if(!Cloud.loaded){showCloudIssue('请先加载云端库存，不能用本机数据覆盖尚未加载的团队库存。');return false;}
 if(Cloud.account.role==='viewer'){toast('只读成员不能修改库存。');await loadCloud();return false;}
 if(Cloud.saving){toast('上一笔修改正在保存，请稍候。');return false;}
 state.demo=false;const snapshot=M.validate(state);Cloud.dirty=true;const draftSaved=Cloud.saveDraft(snapshot);freezeSaving(true);render();
 try{const result=await Cloud.request('data','PUT',{revision:Cloud.revision,data:snapshot});Cloud.revision=result.revision;Cloud.dirty=false;Cloud.removeDraft();dismissCloudIssue();if(message)toast(message);return true;}
 catch(e){if(e.status===401||e.code==='team_session_changed')$('#cloud-reauth').classList.remove('hidden');showCloudIssue(e.status===409?e.message:e.message+(draftSaved?' 修改已保留在本机草稿，请导出备份或稍后重试。':' 本机草稿保存也失败，请立即导出当前数据。'));return false;}
 finally{freezeSaving(false);render();}
}
async function pollCloud(){
 if(Cloud.mode!=='cloud'||!Cloud.account||Cloud.saving||Cloud.dirty||Cloud.checking||document.hidden||$$('dialog[open]').length)return;
 Cloud.checking=true;const startRevision=Cloud.revision;
 try{const next=await Cloud.request('data');if(next.revision!==Cloud.revision&&startRevision===Cloud.revision&&!Cloud.saving&&!Cloud.dirty){state=M.validate(next.data);Cloud.revision=next.revision;render();toast('已同步其他成员更新的库存。');}}
 catch(e){if(e.status===401||e.code==='team_session_changed'){Cloud.dirty=true;showCloudIssue('登录已过期。请先导出备份，再重新登录。');$('#cloud-reauth').classList.remove('hidden');}else $('#save-label').textContent='⚠ 暂时离线 · 稍后自动重连';}
 finally{Cloud.checking=false;}
}
function openAuth(mode='login'){
 if(!Cloud.configured){toast('当前环境未连接云数据库；可继续使用本机模式。');setView('settings');return;}
 authMode=mode;$('#auth-error').textContent='';$('#auth-form').reset();renderAuth();$('#auth-dialog').showModal();
}
function renderAuth(){
 const register=authMode==='register';$('#auth-title').textContent=pendingInvite?'加入受邀团队':register?'创建团队':'登录团队';
 $$('[data-auth-mode]').forEach(b=>b.classList.toggle('active',b.dataset.authMode===authMode));
 $('#auth-name-field').classList.toggle('hidden',!register);$('#auth-name').required=register;
 $('#auth-team-field').classList.toggle('hidden',!register||Boolean(pendingInvite));$('#auth-team').required=register&&!pendingInvite;
 $('#auth-password').minLength=register?12:1;$('#auth-password').autocomplete=register?'new-password':'current-password';
 $('#auth-submit').textContent=pendingInvite?'登录 / 注册并加入':register?'创建账号与团队':'登录';
 $('#invite-hint').classList.toggle('hidden',!pendingInvite);
 $('#auth-password-hint').textContent=register?'至少 12 位。请妥善保管密码，当前不提供邮箱找回。':'输入你创建团队或接受邀请时设置的密码。';
}
$('#auth-form').onsubmit=async e=>{
 e.preventDefault();const b=$('#auth-submit');b.disabled=true;$('#auth-error').textContent='';
 try{const input={username:$('#auth-username').value.trim(),password:$('#auth-password').value,name:$('#auth-name').value.trim(),teamName:$('#auth-team').value.trim(),invite:pendingInvite||undefined};
  let result=await Cloud.request(authMode,'POST',input);Cloud.account=result.account;
  if(pendingInvite&&authMode==='login'&&!result.joined){result=await Cloud.request('join','POST',{invite:pendingInvite});Cloud.account=result.account;}
  pendingInvite='';await loadCloud();$('#auth-dialog').close();$('#auth-password').value='';toast('已进入团队云端工作空间。');
 }catch(err){$('#auth-error').textContent=err.message;}finally{b.disabled=false;}
};
$$('[data-auth-mode]').forEach(b=>b.onclick=()=>{authMode=b.dataset.authMode;renderAuth();});
$('#auth-local').onclick=()=>{$('#auth-dialog').close();toast('当前使用本机数据，尚未与团队共享。');};
$('#team-open').onclick=()=>{if(Cloud.account){setView('settings');}else openAuth();};
$('#team-login').onclick=()=>openAuth();
$('#team-logout').onclick=()=>{if(Cloud.dirty){toast('当前仍有未同步草稿，请先导出或处理草稿后退出。');return;}showConfirm('退出团队','退出后返回本机工作空间。团队库存仍保存在云端，其他成员可继续使用。',async()=>{try{await Cloud.request('logout','POST');Cloud.account=null;Cloud.mode='local';Cloud.revision=0;try{const raw=localStorage.getItem(KEY);state=raw?M.validate(JSON.parse(raw)):initial();}catch{state=initial();}dismissCloudIssue();render();toast('已退出团队。');}catch(e){toast(e.message);}},'退出登录');};
$('#cloud-reauth').onclick=()=>openAuth();
$('#draft-export').onclick=exportData;
$('#draft-retry').onclick=()=>{Cloud.dirty=false;saveWorkspace('草稿已保存到云端');};
$('#draft-reload').onclick=()=>showConfirm('加载云端最新库存','这会放弃未同步的本机草稿。建议先点击「导出草稿」保存，再加载云端版本。',async()=>{try{await loadCloud(true);toast('已加载云端最新库存。');}catch(e){toast(e.message);}},'放弃草稿并加载');
async function loadTeamPanel(){
 if(!Cloud.account)return;
 try{const memberships=await Cloud.request('teams');$('#team-switch-row').classList.toggle('hidden',memberships.teams.length<2);$('#team-select').innerHTML=memberships.teams.map(t=>option(t.id,t.name+' · '+roleNames[t.role],t.id===Cloud.account.teamId)).join('');const result=await Cloud.request('members');$('#members-body').innerHTML=result.members.map(m=>`<tr><td>${esc(m.name)}<small style="display:block;color:#96a58b">${esc(m.username)}</small></td><td>${roleNames[m.role]}</td><td>${Cloud.account.role==='owner'&&m.role!=='owner'?`<button class="button small danger" data-revoke="${esc(m.id)}">移除</button>`:''}</td></tr>`).join('');
  $$('[data-revoke]').forEach(b=>b.onclick=()=>showConfirm('移除团队成员','此成员将无法再访问本团队，已有登录会话也会失效。',async()=>{try{await Cloud.request('revoke','POST',{userId:b.dataset.revoke});await loadTeamPanel();toast('成员已移除。');}catch(e){toast(e.message);}},'移除成员'));
  if(Cloud.account.role==='owner'){const snapshots=await Cloud.request('snapshots');$('#snapshot-select').innerHTML=snapshots.snapshots.map(s=>option(String(s.revision),`v${s.revision} · ${new Date(s.created_at).toLocaleString('zh-CN',{hour12:false})} · ${s.name||'管理员'}`,false)).join('');}
 }catch(e){toast(e.message);}
}
$('#team-switch').onclick=async()=>{if(Cloud.dirty||Cloud.saving){toast('请先处理未同步的修改，再切换团队。');return;}try{const result=await Cloud.request('switchTeam','POST',{teamId:$('#team-select').value});Cloud.account=result.account;Cloud.loaded=false;await loadCloud();await loadTeamPanel();toast('已切换到 '+Cloud.account.teamName);}catch(e){toast(e.message);}};
$('#team-refresh').onclick=async()=>{await pollCloud();await loadTeamPanel();};
$('#invite-create').onclick=async()=>{try{const r=await Cloud.request('invite','POST',{role:$('#invite-role').value});$('#invite-url').value=location.origin+location.pathname+'#invite='+r.invite;$('#invite-box').classList.remove('hidden');toast('邀请链接已生成，7 天有效且只能使用一次。');}catch(e){toast(e.message);}};
$('#invite-copy').onclick=async()=>{try{await navigator.clipboard.writeText($('#invite-url').value);toast('邀请链接已复制。');}catch{$('#invite-url').select();toast('请复制选中的邀请链接。');}};
$('#snapshot-restore').onclick=()=>{if(Cloud.dirty||Cloud.saving){toast('请先处理当前未同步的修改。');return;}const snapshotRevision=Number($('#snapshot-select').value);if(!Number.isSafeInteger(snapshotRevision))return;showConfirm('恢复云端自动备份',`确认把团队库存恢复到 v${snapshotRevision}？恢复结果会作为新版本保存，所有设备都会收到更新。`,async()=>{freezeSaving(true);try{const result=await Cloud.request('restore','POST',{revision:Cloud.revision,snapshotRevision});state=M.validate(result.data);Cloud.revision=result.revision;Cloud.removeDraft();await loadTeamPanel();render();toast('团队库存已恢复。');}catch(e){toast(e.message);}finally{freezeSaving(false);}},'恢复备份');};
const originalSetView=setView;setView=function(v){originalSetView(v);if(v==='settings'&&Cloud.account)loadTeamPanel();};
async function bootstrapCloud(){
 try{if(location.hash.startsWith('#invite=')){const value=location.hash.slice(8);if(/^[a-f0-9]{64}$/.test(value))pendingInvite=value;history.replaceState(null,'',location.pathname+location.search);}
  if(location.protocol==='file:'){render();if(!loadError)persist();return;}
  const session=await Cloud.request('session');Cloud.configured=session.configured;Cloud.account=session.account;
  if(Cloud.account){await loadCloud();if(pendingInvite){showConfirm('接受团队邀请','你当前已登录。确认接受邀请并切换到受邀团队？原团队数据会继续保留。',async()=>{try{const result=await Cloud.request('join','POST',{invite:pendingInvite});Cloud.account=result.account;pendingInvite='';await loadCloud();toast('已加入受邀团队。');}catch(e){toast(e.message);}},'接受邀请');}}
  else{render();if(!loadError)persist();if(Cloud.configured)openAuth(pendingInvite?'register':'login');}
 }catch(e){if(Cloud.account){Cloud.mode='cloud';Cloud.dirty=true;showCloudIssue('无法加载团队库存。当前显示本机内容，请点击「加载云端最新」重试，云端数据没有被覆盖。');render();}else{Cloud.mode='local';render();if(!loadError)persist();toast('云服务暂未连通，当前使用本机库存。云端数据没有被覆盖。');}}
 finally{cloudPoll=setInterval(pollCloud,15000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)pollCloud();});}
}
render();bootstrapCloud();
