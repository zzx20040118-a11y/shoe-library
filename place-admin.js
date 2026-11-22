import {books,loadBook} from './books.js';
import {isPlaceAdmin,listPlaceReviews,savePlaceReview,listAdditionalPlaceLocations,saveAdditionalPlaceLocations} from './account-data.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key=x=>[x.page,x.at_offset??x.at,x.term].join(':');
const field=(name,label,value='',type='text')=>`<label>${label} <input name="${name}" type="${type}" ${type==='number'?'step="any"':''} value="${esc(value)}"></label>`;
function placeFields(x={},index=0){
 return `<fieldset class="place-location"><legend>关联地点 ${index+1}</legend>
 <label>类型 <select name="relation_type"><option value="direct" ${x.relation_type==='direct'?'selected':''}>现实地点</option><option value="prototype" ${x.relation_type==='prototype'?'selected':''}>现实原型</option></select></label>
 ${field('place_name','地点名称',x.place_name||'')}
 ${field('city','所属城市',x.city||'')}
 ${field('lat','纬度（北正南负，例如 23.1270）',x.lat??'','number')}
 ${field('lon','经度（东正西负，例如 113.2647）',x.lon??'','number')}
 <label>坐标精度 <select name="coordinate_precision"><option value="exact" ${x.coordinate_precision==='approximate'?'':'selected'}>准确位置</option><option value="approximate" ${x.coordinate_precision==='approximate'?'selected':''}>大致位置</option></select></label>
 <label>核实依据（必填）<textarea name="evidence" rows="2">${esc(x.evidence||'')}</textarea></label>
 <label>地点注释（选填）<textarea name="note" rows="2" placeholder="例如：原建筑已拆除；坐标为历史旧址的大致位置">${esc(x.note||'')}</textarea></label>
 <button type="button" class="btn remove-location">移除此地点</button></fieldset>`;
}
function readLocation(fieldset){
 const f=new FormData(fieldset.closest('form')); // read from the individual fieldset below
 const val=n=>fieldset.querySelector('[name="'+n+'"]').value.trim();
 const lat=val('lat'),lon=val('lon');
 if(!val('place_name')||!val('evidence')||lat===''||lon==='')throw Error('每个地点必须填写名称、经纬度和核实依据');
 if(!Number.isFinite(Number(lat))||!Number.isFinite(Number(lon))||Math.abs(Number(lat))>90||Math.abs(Number(lon))>180)throw Error('坐标超出范围：纬度 -90～90，经度 -180～180');
 return {place_name:val('place_name'),city:val('city'),lat:Number(lat),lon:Number(lon),relation_type:val('relation_type'),coordinate_precision:val('coordinate_precision'),evidence:val('evidence'),note:val('note'),...(fieldset.dataset.id?{id:Number(fieldset.dataset.id)}:{})};
}
export async function showPlaceReview(root,manual=null){
 if(!await isPlaceAdmin()){root.innerHTML='<div class="wrap inner">仅管理员可以审核地点。请重新登录。</div>';return;}
 root.innerHTML='<div class="wrap inner place-review"><h1>文学地点审核</h1><p>一处原文可关联多个现实坐标；每个地点都可单独填写注释（选填）及坐标精度。保存后会在地图上显示为多个标记。</p><label>选择作品 <select id="review-book"></select></label><p id="review-status" role="status"></p><h2>待审核候选</h2><div id="review-items"></div><h2>已确认地点（可继续添加关联地点）</h2><div id="review-approved"></div></div>';
 const select=root.querySelector('#review-book'),items=root.querySelector('#review-items'),approvedRoot=root.querySelector('#review-approved'),status=root.querySelector('#review-status');
 select.innerHTML=books.filter(b=>b.id.startsWith('zh-')).map(b=>`<option value="${esc(b.id)}">${esc(b.title)}</option>`).join('');
 if(manual?.bookId)select.value=manual.bookId;
 async function load(){
  const book=books.find(b=>b.id===select.value);items.innerHTML='';approvedRoot.innerHTML='';status.textContent='正在读取…';
  try{
   await loadBook(book);
   const [response,reviewed]=await Promise.all([fetch('/books/'+book.id+'-place-review.json'),listPlaceReviews(book.id)]);
   if(!response.ok)throw Error('地点候选清单尚未部署');
   const data=await response.json(),done=new Set(reviewed.map(key));
   const extras=await listAdditionalPlaceLocations(reviewed.filter(x=>x.decision==='approved').map(x=>x.id));
   const candidates=[];
   if(manual?.bookId===book.id){if(!done.has(key(manual)))candidates.push(manual);manual=null;}
   for(const candidate of data.candidates||[])for(const m of candidate.mentions||[])if(!done.has(key({page:m.page,at:m.at,term:candidate.term})))candidates.push({term:candidate.term,page:m.page,at:m.at,context:m.context});
   const unique=[...new Map(candidates.map(x=>[key(x),x])).values()];
   status.textContent='待审核 '+unique.length+' 处 · 已处理 '+reviewed.length+' 处';
   function cardFor(x,existing=null){
    const card=document.createElement('section');card.className='place-review-card';
    const savedExtras=existing?extras.filter(y=>y.review_id===existing.id):[];
    const primary=existing?[existing,...savedExtras]:[{place_name:x.term}];
    card.innerHTML=`<form><p><strong>${esc(x.term)}</strong> · 第 ${x.page+1} 页</p><blockquote>${esc(x.context||book.pages[x.page]?.slice(Math.max(0,(x.at??x.at_offset)-45),(x.at??x.at_offset)+x.term.length+70)||'')}</blockquote>
    ${existing?'':'<label>审核结果 <select name="decision"><option value="approved">确认地点</option><option value="excluded">排除候选</option></select></label>'}
    <div class="place-fields"><div class="location-list">${primary.map((p,i)=>placeFields(p,i)).join('')}</div><button type="button" class="btn add-location">＋ 添加关联地点</button></div>
    <button class="btn solid" type="submit">保存${existing?'修改':'审核'}</button> <span role="status"></span></form>`;
    const form=card.querySelector('form'),list=card.querySelector('.location-list'),msg=form.querySelector('[role="status"]');
    [...list.children].forEach((el,i)=>{if(i>0)el.dataset.id=savedExtras[i-1].id});
    function wire(){list.querySelectorAll('.remove-location').forEach(btn=>btn.onclick=()=>{if(list.children.length<=1){msg.textContent='至少保留一个关联地点';return;}btn.closest('fieldset').remove();});}
    wire();
    form.querySelector('.add-location').onclick=()=>{list.insertAdjacentHTML('beforeend',placeFields({},list.children.length));wire()};
    if(!existing)form.elements.decision.onchange=()=>form.querySelector('.place-fields').hidden=form.elements.decision.value==='excluded';
    form.onsubmit=async e=>{
     e.preventDefault();msg.textContent='';
     const excluded=!existing&&form.elements.decision.value==='excluded';
     let locations=[];
     try{if(!excluded)locations=[...list.children].map(readLocation)}
     catch(err){msg.textContent=err.message;return;}
     const button=form.querySelector('[type="submit"]');button.disabled=true;
     try{
      const first=locations[0]||{};
      const saved=await savePlaceReview({book_id:book.id,term:x.term,page:x.page,at_offset:x.at??x.at_offset,decision:excluded?'excluded':'approved',relation_type:excluded?null:first.relation_type,place_name:excluded?null:first.place_name,city:excluded?null:first.city,lat:excluded?null:first.lat,lon:excluded?null:first.lon,evidence:excluded?null:first.evidence,note:excluded?null:first.note,coordinate_precision:excluded?'exact':first.coordinate_precision});
      if(!excluded)await saveAdditionalPlaceLocations(saved.id,locations.slice(1));
      msg.textContent='保存成功；刷新地图后可查看更新';if(!existing)card.remove();
     }catch(err){msg.textContent='保存失败：'+err.message}
     finally{button.disabled=false}
    };
    return card;
   }
   let index=0;
   function batch(){
    for(const x of unique.slice(index,index+20))items.append(cardFor(x));
    index+=20;if(index<unique.length){const more=document.createElement('button');more.className='btn';more.textContent='加载更多';more.onclick=()=>{more.remove();batch()};items.append(more)}
   }batch();
   for(const x of reviewed.filter(y=>y.decision==='approved'))approvedRoot.append(cardFor(x,x));
   if(!reviewed.some(x=>x.decision==='approved'))approvedRoot.innerHTML='<p>暂无已确认地点</p>';
  }catch(err){status.textContent='加载失败：'+err.message}
 }
 select.onchange=()=>{manual=null;load()};await load();
}
