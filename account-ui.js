import * as data from './account-data.js';
export function accountDialog({user,local,refresh,onSearch,waitWrites}){
  const modal=document.createElement('dialog');
  modal.className='place-dialog account-panel';
  modal.innerHTML='<button class="btn close-account">关闭</button><h2></h2><div class="account-content"></div><p role="status" class="sub"></p>';
  document.body.append(modal);modal.showModal();
  modal.onclose=()=>modal.remove();modal.querySelector('.close-account').onclick=()=>modal.close();
  const title=modal.querySelector('h2'),root=modal.querySelector('.account-content'),status=modal.querySelector('[role=status]');
  const legacy=document.createElement('a');
  legacy.href='https://wenxue-jingwei.vividchutney33.chatgpt.site/#shelf';
  legacy.textContent='访问旧站书架';legacy.target='_blank';legacy.rel='noopener';
  modal.append(legacy);
  async function perform(button,work){
    button.disabled=true;status.textContent='处理中…';
    try{const message=await work();status.textContent=message||''}
    catch(e){status.textContent=e.status===429?'请求过于频繁，请稍后再试。':('操作未完成：'+(e.message||'请检查网络后重试。'))}
    finally{button.disabled=false}
  }
  if(!user){
    title.textContent='登录个人书架';
    root.innerHTML='<form><label>邮箱<input type="email" name="email" autocomplete="email" required></label><button class="btn solid">发送登录链接</button></form><p class="sub">首次登录会创建账号。请在发起登录的同一浏览器打开邮件链接。</p>';
    root.querySelector('form').onsubmit=e=>{e.preventDefault();const email=e.currentTarget.elements.email.value.trim();perform(root.querySelector('button'),async()=>{await data.emailLink(email);return '请查收登录邮件，也可以检查垃圾邮件文件夹。'})};
    if(data.phoneLoginEnabled){
      const phoneForm=document.createElement('form');
      phoneForm.innerHTML='<label>手机号（含国家区号）<input name="phone" type="tel" autocomplete="tel" placeholder="+86…" required></label><label hidden>短信验证码<input name="code" inputmode="numeric" autocomplete="one-time-code"></label><button class="btn">发送短信验证码</button>';
      root.append(phoneForm);
      const {phone,code}=phoneForm.elements;
      const button=phoneForm.querySelector('button');
      phoneForm.onsubmit=e=>{e.preventDefault();perform(button,async()=>{
        if(code.required){await data.confirmSms(phone.value.trim(),code.value.trim());return '登录成功。'}
        await data.requestSms(phone.value.trim());phone.readOnly=true;
        code.parentElement.hidden=false;code.required=true;button.textContent='验证并登录';code.focus();
        return '请输入收到的短信验证码。';
      })};
    }
    return;
  }
  title.textContent='个人资料';
  root.innerHTML='<p data-email></p><form><label>显示名称<input name="nickname" maxlength="60"></label><label><input name="remember" type="checkbox"> 自动保存搜索历史</label><button class="btn">保存设置</button></form><details><summary>搜索历史</summary><div data-history></div><button data-clear class="btn">清空历史</button></details><section data-import><h3>导入此设备的访客记录</h3><p class="sub"></p><button class="btn">确认导入</button></section><button data-out class="btn">退出此设备</button>';
  root.querySelector('[data-email]').textContent=user.email||user.phone||'';
  const form=root.querySelector('form'),details=root.querySelector('details');
  form.querySelector('button').disabled=true;
  data.profile(user.id).then(p=>{form.elements.nickname.value=p.display_name;form.elements.remember.checked=p.save_history;form.querySelector('button').disabled=false}).catch(()=>status.textContent='资料读取失败，请关闭后重试。');
  form.onsubmit=e=>{e.preventDefault();perform(form.querySelector('button'),async()=>{await data.updateProfile(user.id,{display_name:form.elements.nickname.value.trim(),save_history:form.elements.remember.checked});return '资料已保存。'})};
  async function list(){const box=root.querySelector('[data-history]');box.replaceChildren();const rows=await data.history(user.id);if(!rows.length)box.textContent='暂无搜索记录。';for(const {term} of rows){const b=document.createElement('button');b.className='pill';b.textContent=term;b.onclick=()=>{modal.close();onSearch(term)};box.append(b)}}
  details.ontoggle=()=>{if(details.open)list().catch(()=>status.textContent='历史读取失败。')};
  root.querySelector('[data-clear]').onclick=e=>perform(e.currentTarget,async()=>{await data.clearHistory(user.id);await list();return '历史已清空。'});
  const section=root.querySelector('[data-import]'),entries=Object.entries(local()).filter(([k,v])=>v && (k.startsWith('book:')||k.startsWith('craft:')));
  section.hidden=!entries.length;
  section.querySelector('p').textContent='此浏览器有 '+entries.length+' 条访客记录。仅补充云端缺少的记录，保留本地副本和云端已有内容。';
  section.querySelector('button').onclick=e=>perform(e.currentTarget,async()=>{await waitWrites();for(const [key,v] of entries)await data.persist(user.id,key,v,key.startsWith('book:')?!!v.shelf:null,true);await refresh();return '导入完成，本地副本已保留。'});
  root.querySelector('[data-out]').onclick=e=>perform(e.currentTarget,async()=>{await waitWrites();await data.signout();location.reload()});
}
