'use strict';
const Cloud={account:null,revision:0,configured:false,mode:'local',dirty:false,saving:false,checking:false,latest:null,loaded:false};
Cloud.request=async function(action,method='GET',body){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{const headers={...(body?{'Content-Type':'application/json'}:{}),...(Cloud.account?{'X-Clipstock-Team':Cloud.account.teamId}:{})};const response=await fetch('/api/workspace?action='+encodeURIComponent(action),{method,credentials:'same-origin',cache:'no-store',headers,body:body?JSON.stringify(body):undefined,signal:controller.signal});
  let data;try{data=await response.json();}catch{throw Object.assign(new Error('云服务暂时不可用。'),{status:response.status});}
  if(!response.ok)throw Object.assign(new Error(data.error||'云服务请求失败。'),{status:response.status,code:data.code});return data;
 }catch(e){if(e.name==='AbortError')throw new Error('连接超时；本机草稿已保留，请稍后重试。');throw e;}finally{clearTimeout(timer);}
};
Cloud.draftKey=()=>Cloud.account?'clipstock.draft.'+Cloud.account.teamId+'.'+Cloud.account.id:null;
Cloud.saveDraft=function(data){try{localStorage.setItem(Cloud.draftKey(),JSON.stringify({data,revision:Cloud.revision,at:new Date().toISOString()}));return true;}catch{return false;}};
Cloud.removeDraft=function(){try{localStorage.removeItem(Cloud.draftKey());}catch{}};
Cloud.readDraft=function(){try{const raw=localStorage.getItem(Cloud.draftKey());if(!raw)return null;const value=JSON.parse(raw);value.data=StockModel.validate(value.data);return value;}catch{return null;}};
