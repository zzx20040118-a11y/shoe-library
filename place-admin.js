import {books,loadBook} from './books.js';
import {isPlaceAdmin,listPlaceReviews,savePlaceReview} from './account-data.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function showPlaceReview(root,manual=null){
 if(!await isPlaceAdmin()){root.innerHTML='<div class="wrap inner">仅管理员可以审核地点。请重新登录。</div>';return;}
 root.innerHTML='<div class="wrap inner place-review"><h1>文学地点审核</h1><p>已处理的候选自动隐藏。只有填写可核实的依据和坐标才能确认地点。</p><label>选择作品 <select id="review-book"></select></label><p id="review-status" role="status"></p><div id="review-items"></div></div>';
 const select=root.querySelector('#review-book'),items=root.querySelector('#review-items'),status=root.querySelector('#review-status');
 select.innerHTML=books.filter(b=>b.id.startsWith('zh-')).map(b=>`<option value="${esc(b.id)}">${esc(b.title)}</option>`).join('');
 if(manual?.bookId)select.value=manual.bookId;
 async function load(){
  const book=books.find(b=>b.id===select.value);items.innerHTML='';status.textContent='正在读取…';
  try{
   await loadBook(book);
   const [response,reviewed]=await Promise.all([fetch('/books/'+book.id+'-place-review.json'),listPlaceReviews(book.id)]);
   if(!response.ok)throw Error('地点候选清单尚未部署');
   const data=await response.json(),done=new Set(reviewed.map(x=>[x.page,x.at_offset,x.term].join(':')));
   const candidates=[];
   if(manual?.bookId===book.id){candidates.push(manual);manual=null;}
   for(const candidate of data.candidates||[])for(const m of candidate.mentions||[])if(!done.has([m.page,m.at,candidate.term].join(':')))candidates.push({term:candidate.term,page:m.page,at:m.at,context:m.context});
   const unique=[...new Map(candidates.map(x=>[[x.page,x.at,x.term].join(':'),x])).values()];
   status.textContent='待审核 '+unique.length+' 处 · 已处理 '+reviewed.length+' 处';
   let index=0;
   function batch(){
    for(const x of unique.slice(index,index+20)){
     const card=document.createElement('section');card.className='place-review-card';
     card.innerHTML=`<form><p><strong>${esc(x.term)}</strong> · 第 ${x.page+1} 页</p><blockquote>${esc(x.context)}</blockquote><label>审核结果 <select name="decision"><option value="approved">确认地点</option><option value="excluded">排除候选</option></select></label><div class="place-fields"><label>类型 <select name="relation_type"><option value="direct">现实地点</option><option value="prototype">虚构地点／现实原型</option></select></label><label>地点名称 <input name="place_name" value="${esc(x.term)}"></label><label>所属城市 <input name="city"></label><label>纬度 <input name="lat" type="number" step="any"></label><label>经度 <input name="lon" type="number" step="any"></label><label>核实依据 <textarea name="evidence" rows="2"></textarea></label></div><button class="btn solid">保存审核</button><span role="status"></span></form>`;
     items.append(card);const form=card.querySelector('form');form.elements.decision.onchange=()=>{form.querySelector('.place-fields').hidden=form.elements.decision.value==='excluded'};
     form.onsubmit=async e=>{e.preventDefault();const f=new FormData(form),approved=f.get('decision')==='approved',msg=form.querySelector('[role="status"]');
      const payload={book_id:book.id,term:x.term,page:x.page,at_offset:x.at,decision:String(f.get('decision')),relation_type:approved?String(f.get('relation_type')):null,place_name:approved?String(f.get('place_name')).trim():null,city:approved?String(f.get('city')).trim():null,lat:approved&&f.get('lat')!==''?Number(f.get('lat')):null,lon:approved&&f.get('lon')!==''?Number(f.get('lon')):null,evidence:approved?String(f.get('evidence')).trim():null};
      if(approved&&(!payload.place_name||payload.lat===null||payload.lon===null||!payload.evidence)){msg.textContent='请填写地点、坐标和核实依据';return;}
      form.querySelector('button').disabled=true;try{await savePlaceReview(payload);card.remove();status.textContent='已保存审核结果';}catch(err){msg.textContent=err.message;form.querySelector('button').disabled=false;}
     };
    }index+=20;if(index<unique.length){const more=document.createElement('button');more.className='btn';more.textContent='加载更多';more.onclick=()=>{more.remove();batch()};items.append(more)}
   }batch();
  }catch(err){status.textContent='加载失败：'+err.message}
 }
 select.onchange=()=>{manual=null;load()};await load();
}
