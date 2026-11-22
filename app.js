import * as personal from './account-data.js';
import {accountDialog} from './account-ui.js';
import {drawLandscape} from './landscape.js';
import {books,allBooks,anchors,loadBook,pagesOrigin,cloudOrigin} from './books.js';

const app = document.querySelector('#app');
const icons = {
  book:'<path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1v14"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  pin:'<path d="M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  locate:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m10 7h-3m-7 10v-3M2 12h3"/>',
  user:'<circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${icons[name]}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
const staticSite = location.origin !== cloudOrigin;
const accountOrigin = staticSite ? cloudOrigin : '';
let renderVersion=0;
const getBook = id => allBooks.find(book => book.id === id);
const normalize = value => value.toLocaleLowerCase().trim();
const pageOf = (book, value) => Math.max(0, Math.min(book.pages.length - 1, Number.parseInt(value,10) || 0));

let records = {};
let user = null;
let query = '';
let region = '全部';
let mapState;
// Broad administrative and landscape names remain searchable but are not walkable street pins.
const broadMapPlaces=new Set(['伦敦','巴黎','罗马','楠塔基特岛','佛罗伦萨','莫斯科','波士顿','威尼斯','扬州','马德里','圣彼得堡','爱丁堡','维也纳','多佛','柏林','苏州','金陵','钱塘','都柏林','纽约','钱塘江','西湖','泰山','赤壁']);
const walkableAnchor=a=>!broadMapPlaces.has(a.place)&&!broadMapPlaces.has(a.term)&&Number.isFinite(a.lat)&&Number.isFinite(a.lon);
const placeKind=a=>a.relationType==='prototype'?'prototype':'direct';
const placeKindLabel=a=>placeKind(a)==='prototype'?'现实原型':'原文地点';
const placeKindIcon=a=>placeKind(a)==='prototype'?'◇':'●';

let locating = false;
let locationMessage = '';
let selection;
let draft;
let mapObserver;
let toastTimer;
let writeQueue = Promise.resolve();

function toast(message) {
  const target = document.querySelector('#toast');
  target.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => target.textContent = '', 3500);
}
function localState() {
  try { return JSON.parse(localStorage.getItem('atlas-guest') || '{}'); }
  catch { return {}; }
}
async function save(key,value,membership){
  const owner=user?.id;
  const task=writeQueue.catch(()=>{}).then(async()=>{
    if(owner)await personal.persist(owner,key,value,membership);
    else localStorage.setItem('atlas-guest',JSON.stringify({...localState(),[key]:value}));
    records = {...records,[key]:value};
  });
  writeQueue = task;
  return task;
}
function saveProgress(book, page, shelf, discovery) {
  const key = 'book:' + book.id;
  const previous = records[key] || {};
  return save(key, {
    page, shelf:shelf ?? previous.shelf ?? false,
    discovery:discovery || previous.discovery || '',
    updated:Date.now()
  },shelf);
}
function readLink(book, page, term = '', source = '') {
  const params = new URLSearchParams({id:book.id});
  if (page != null) params.set('p',page);
  if (term) params.set('q',term);
  if (source) params.set('from',source);
  return '#reader?' + params;
}
function paint(text, ranges) {
  const ordered = ranges.filter(([start,end]) => start >= 0 && end > start)
    .sort((a,b) => a[0] - b[0]);
  const combined = [];
  for (const span of ordered) {
    const last = combined.at(-1);
    if (last && span[0] <= last[1]) last[1] = Math.max(last[1],span[1]);
    else combined.push([...span]);
  }
  let cursor = 0;
  let html = '';
  for (const [start,end] of combined) {
    html += esc(text.slice(cursor,start)) + '<mark>' + esc(text.slice(start,end)) + '</mark>';
    cursor = end;
  }
  return html + esc(text.slice(cursor));
}
function textRanges(text, term) {
  if (!term) return [];
  const lower = text.toLocaleLowerCase();
  const needle = term.toLocaleLowerCase();
  const ranges = [];
  for (let at = lower.indexOf(needle); at >= 0; at = lower.indexOf(needle,at + needle.length)) {
    ranges.push([at,at + needle.length]);
  }
  return ranges;
}
function locatedBook(book, anchor) {
  return {...book,city:anchor.city,place:anchor.place,lat:anchor.lat,lon:anchor.lon,featured:anchor.page};
}
function excerpt(book,page,term,hint='',offset) {
  const text=book.pages[page] || hint || book.sample || '';
  const at=book.pages[page] && Number.isInteger(offset) ? offset : Math.max(0,text.toLowerCase().indexOf(term.toLowerCase()));
  return text.slice(Math.max(0,at-26),at+Math.max(term.length,1)+75).trim();
}
const indexWords = /[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu;
function shortExcerpt(text, at, term, clippedLeft=false, clippedRight=false) {
  const end=at+term.length, before=text.slice(0,at), after=text.slice(end);
  const cjk=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text.slice(Math.max(0,at-18),end+24));
  let left,right;
  if(cjk){
    left=before.length-[...before].slice(-16).join('').length;
    right=end+[...after].slice(0,term?16:32).join('').length;
  }else{
    const preceding=[...before.matchAll(indexWords)], following=[...after.matchAll(indexWords)];
    left=preceding.length>4 ? preceding.at(-4).index : 0;
    const count=term?4:8;
    right=following.length>count ? end+following[count-1].index+following[count-1][0].length : text.length;
    // An indexed sample can itself start or end halfway through a word.
    if(clippedLeft && left===0 && preceding[0]?.index===0)left=preceding[0][0].length;
    if(clippedRight && right===text.length && following.at(-1)?.index+following.at(-1)?.[0].length===after.length)right=end+following.at(-1).index;
  }
  return (left||clippedLeft?'…':'')+text.slice(left,right).trim()+(right<text.length||clippedRight?'…':'');
}

const themes={'城市日常':['茶','市集','market'],'食物与味觉':['酒','茶','早餐','breakfast'],'街道与建筑':['街','桥','楼','street','bridge'],'季节与天气':['雪','雨','春','snow','rain'],'旅行与行走':['舟','旅','步行','walk'],'故乡与记忆':['故乡','乡愁','记忆','memory']};
function matches(book) {
  const needle=normalize(query), hits=new Map();
  function add(page,term,hint='',anchor) {
    const full=book.pages[page], text=full || hint || book.sample || '';
    const folded=text.toLowerCase(), word=term.toLowerCase();
    const anchorInHint=anchor && hint ? hint.indexOf(anchor.term) : -1;
    const base=anchorInHint>=0 ? anchor.at-anchorInHint : 0;
    let at=full && anchor ? (anchor.term===term ? anchor.at : base+hint.toLowerCase().indexOf(word)) : folded.indexOf(word);
    if(at<0 || folded.slice(at,at+word.length)!==word)at=Math.max(0,folded.indexOf(word));
    const offset=full?at:base+at;
    const key=page+'|'+offset+'|'+term;
    if(!hits.has(key))hits.set(key,{page,term,offset,line:shortExcerpt(text,at,term,!full&&base>0,!full&&!!book.count)});
  }
  if(needle){
    const words=Object.hasOwn(themes,query)?themes[query]:[];
    const citySearch=needle&&anchors.some(a=>walkableAnchor(a)&&normalize(a.city)===needle);
    for(const a of book.anchors||[]){
      if(citySearch&&!walkableAnchor(a))continue;
      const context=a.snippet || book.pages[a.page] || ''; const theme=words.find(w=>normalize(context).includes(w));
      if(theme)add(a.page,theme,context,a);
      if([a.term,a.place,a.city,a.keywords,a.snippet||''].some(v=>normalize(v).includes(needle))) add(a.page,citySearch?a.term:((a.snippet||'').toLowerCase().includes(needle)?query:a.term),a.snippet,a);
    }
    if(!citySearch&&(!book.count||book.loaded)) book.pages.forEach((p,i)=>{if(normalize(p).includes(needle))add(i,query)});
    if(!citySearch&&!hits.size&&normalize(book.sample||'').includes(needle))add(0,query);
  }
  if(!hits.size&&(!needle||[book.title,book.author,book.en].some(v=>normalize(v).includes(needle))))add(0,'');
  return [...hits.values()];
}
function stack(book,hits){
  const first=hits[0], quote=h=>paint(h.line,textRanges(h.line,h.term));
  const heading=cover(book)+'<span class="stack-copy"><strong>'+paint(book.title,textRanges(book.title,query))+'</strong><small>'+paint(book.author,textRanges(book.author,query))+'</small><span>'+quote(first)+'</span></span>';
  const link=h=>esc(readLink(book,h.page,h.term,query)+(h.term?'&at='+h.offset:''));
  if(hits.length===1)return '<a class="stack" href="'+link(first)+'">'+heading+'</a>';
  return '<details class="stacked"><summary class="stack">'+heading+'<em>'+hits.length+' 处匹配</em></summary><div class="passages">'+hits.map(h=>'<a href="'+link(h)+'"><small>第 '+(h.page+1)+' 页</small>'+quote(h)+'</a>').join('')+'</div></details>';
}

function cover(book) {
  return `<div class="cover ${book.col}" aria-hidden="true"><strong>${esc(book.title)}</strong><i class="cover-art ${book.art}"></i><small>${esc(book.en)}</small></div>`;
}
function bookCard({book,page,term,source,meta}) {
  const text = book.pages[page ?? book.featured] || book.anchors?.find(a=>a.page===page)?.snippet || book.sample || '';
  return `<a class="book-card" href="${esc(readLink(book,page,term,source))}">${cover(book)}<div class="book-info"><h3>${esc(book.title)}</h3><p>${esc(meta || book.author)}</p><span class="place">${book.place ? icon('pin')+esc(book.city)+' · '+esc(book.place) : esc(book.lang || '中文')+' · '+book.pages.length+' 页'}</span><p class="snippet">${paint(text,textRanges(text,term))}</p></div></a>`;
}
function discover(){
  const groups=books.map(book=>({book,hits:matches(book)})).filter(g=>g.hits.length);
  const featured=['fusheng','huxin','pg1661'].map(id=>getBook(id));
  app.innerHTML=`<div class="wrap"><section class="spread"><div><h1>在一座城里，<br>读到另一座城。</h1><form id="search"><input name="query" aria-label="文学搜索" placeholder="书名、作家、地点、生活主题或原文" value="${esc(query)}"><button>搜索</button></form><div class="entry"><a class="explore-link" href="#explore">${icon('locate')} 探索身边</a></div></div><figure class="landprint"><canvas aria-label="原创套色版画：层山与落日" role="img"></canvas><figcaption>山行 · 套色习作</figcaption></figure></section>
  ${!query?'<section class="picks"><h2>漫游选读</h2><div>'+featured.map(b=>{const a=b.anchors[0];return '<a href="'+esc(readLink(b,a.page,a.term,a.place))+'"><small>'+esc(a.city)+' · '+esc(a.place)+'</small><h3>'+esc(b.title)+'</h3><p>'+esc(excerpt(b,a.page,a.term,a.snippet,a.at))+'</p></a>'}).join('')+'</div></section>':''}
  <section class="section" id="results"><div class="section-head"><h2>${query?'搜索结果':'全部作品'}</h2><small>${groups.length} 部作品与版本</small></div><div class="stacks"></div><button class="btn" id="more">继续浏览</button></section></div>`;
  drawLandscape(app.querySelector('.landprint canvas'));
  let shown=0;const more=app.querySelector('#more');
  function append(){app.querySelector('.stacks').insertAdjacentHTML('beforeend',groups.slice(shown,shown+24).map(g=>stack(g.book,g.hits)).join(''));shown+=24;more.hidden=shown>=groups.length;}
  append();if(!groups.length)app.querySelector('.stacks').textContent='未找到匹配。可以试试原文拼写或作者姓氏。';
  app.querySelector('#search').onsubmit=e=>{e.preventDefault();query=new FormData(e.currentTarget).get('query').trim();if(user&&query)personal.logSearch(query).catch(()=>toast('搜索历史暂未同步'));render();app.querySelector('#results')?.scrollIntoView();};
  more.onclick=append;
}

function distance(a,b) {
  const rad = Math.PI / 180;
  const h = Math.sin((a.lat-b.lat)*rad/2)**2 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin((a.lon-b.lon)*rad/2)**2;
  return 6371 * 2 * Math.asin(Math.min(1,Math.sqrt(h)));
}
function route() {
  const [name, queryString] = location.hash.slice(1).split('?');
  return {name:name || 'discover', params:new URLSearchParams(queryString)};
}
let locationAttempted=false;
function explore(){
  if(!mapState)mapState={center:{lat:30.25,lon:120.14},zoom:5,selected:null};
  app.innerHTML=`<section class="explore-page"><header class="explore-head"><div><small>SHOE / CITY NOTES</small><h1>走进书里的街道</h1><p class="explore-intro">从书页走向街道、桥梁与建筑。</p></div><a class="btn" href="#discover">返回发现</a></header><div class="explore-map-shell"><div id="map" class="map explore-map" aria-label="文学地点地图"></div><div class="explore-controls"><button class="btn" id="recenter" ${locating?'disabled':''}>${icon('locate')} ${locating?'定位中…':'回到我的位置'}</button><form id="place-search"><input name="place" aria-label="搜索城市或地点" placeholder="搜索城市或地点" required><button class="btn">查找</button></form></div>${locationMessage?'<p class="explore-message" role="status">'+esc(locationMessage)+'</p>':''}</div></section>`;
  mapObserver?.disconnect();mapObserver=new ResizeObserver(renderMap);mapObserver.observe(app.querySelector('#map'));renderMap();
  app.querySelector('#recenter').onclick=()=>locate(true);
  app.querySelector('#place-search').onsubmit=e=>{
    e.preventDefault();const q=new FormData(e.currentTarget).get('place').trim().toLowerCase();
    const found=anchors.filter(a=>walkableAnchor(a)&&[a.city,a.place].some(v=>v?.toLowerCase().includes(q)));
    const match=found[0];
    if(match){mapState.center={lat:match.lat,lon:match.lon};mapState.zoom=14;mapState.selected=null;locationMessage=found.length+' 条文学地点记录匹配「'+q+'」，地图已定位至其中一处。';explore();}
    else{locationMessage='尚未收录这个地点，请试试已收录的城市或地名。';explore();}
  };
  if(!mapState.user&&!locating&&!locationAttempted)locate(false);
}
function locate(manual=false){
  if(locating||(!manual&&locationAttempted))return;
  locationAttempted=true;
  if(!navigator.geolocation){locationMessage='无法获取当前位置，请搜索城市或地点。';if(route().name==='explore')explore();return;}
  locating=true;locationMessage='';if(route().name==='explore')explore();
  navigator.geolocation.getCurrentPosition(({coords})=>{
    const center={lat:coords.latitude,lon:coords.longitude};
    mapState={center,user:center,zoom:14,selected:null};locating=false;locationMessage='';
    if(route().name==='explore')explore();
  },error=>{
    locating=false;locationMessage=error.code===1?'定位权限未开启，请搜索城市或地点。':'无法获取当前位置，请搜索城市或地点。';
    if(route().name==='explore')explore();
  },{timeout:10000,maximumAge:60000});
}
function project({lat,lon},zoom) {
  const n = 256 * 2**zoom;
  const latitude = Math.max(-85,Math.min(85,lat)) * Math.PI/180;
  return [n*(lon+180)/360,n*(1-Math.asinh(Math.tan(latitude))/Math.PI)/2];
}
function unproject(x,y,z){
  const n=256*2**z;
  return {lon:((x/n*360)%360+360)%360-180,lat:Math.atan(Math.sinh(Math.PI*(1-2*Math.max(0,Math.min(n,y))/n)))*180/Math.PI};
}
function renderMap(){
  const t=app.querySelector('#map');if(!t||!mapState)return;
  const {center,zoom}=mapState,[cx,cy]=project(center,zoom),w=t.clientWidth,h=t.clientHeight,n=2**zoom,x0=cx-w/2,y0=cy-h/2;
  let html='';for(let x=Math.floor(x0/256);x<=Math.floor((x0+w)/256);x++)for(let y=Math.max(0,Math.floor(y0/256));y<=Math.min(n-1,Math.floor((y0+h)/256));y++)html+='<img draggable="false" alt="" width="256" height="256" src="https://tile.openstreetmap.org/'+zoom+'/'+((x%n+n)%n)+'/'+y+'.png" style="left:'+(x*256-x0)+'px;top:'+(y*256-y0)+'px">';
  const groups=[];
  const visibleAnchors=anchors.filter(walkableAnchor);
  for(const a of visibleAnchors){
    const [px,py]=project(a,zoom),x=px-x0,y=py-y0;
    if(x<0||y<0||x>w||y>h)continue;
    let g=groups.find(g=>Math.abs(g.x-x)<43&&Math.abs(g.y-y)<55);
    if(!g){g={x,y,items:[]};groups.push(g)}g.items.push(a);
  }
  groups.forEach((g,i)=>{const b=getBook(g.items[0].bookId);html+='<button class="map-cover" data-group="'+i+'" aria-label="'+esc(g.items[0].place+'，'+b.title)+'" style="left:'+g.x+'px;top:'+g.y+'px">'+cover(b)+(g.items.length>1?'<b>'+g.items.length+'</b>':'')+'</button>';});
  if(mapState.user){const [x,y]=project(mapState.user,zoom);html+='<i class="here" title="你的位置" style="left:'+(x-x0)+'px;top:'+(y-y0)+'px"></i>'}
  const g=groups.find(g=>g.items.some(a=>a.id===mapState.selected)),i=g?.items.findIndex(a=>a.id===mapState.selected),a=g?.items[i];
  if(a){const b=getBook(a.bookId),line=excerpt(b,a.page,a.term,a.snippet);html+='<aside class="map-story">'+cover(b)+'<div><small>'+esc(a.city+' · '+a.place)+'</small><h3>'+esc(b.title)+'</h3><small>'+esc(b.author)+'</small><p>'+paint(line,textRanges(line,a.term))+'</p><p class="place-kind" title="'+esc(placeKindLabel(a))+'"><span aria-hidden="true">'+placeKindIcon(a)+'</span> '+placeKindLabel(a)+'</p><div class="place-actions"><a href="'+esc(readLink(b,a.page,a.term,a.place))+'">阅读原文</a> '+(g.items.length>1?'<button data-cycle>下一段 '+(i+1)+' / '+g.items.length+'</button>':'')+'<button data-report>举报错误</button></div></div><button class="map-story-close" data-dismiss aria-label="关闭">×</button></aside>'}

  t.innerHTML=html+'<div class="map-tools"><button data-zoom="1" aria-label="放大">+</button><button data-zoom="-1" aria-label="缩小">−</button></div><span class="map-note"><a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a></span>';
  t.onclick=e=>{const b=e.target.closest('button');if(!b)return;
    if(b.hasAttribute('data-group'))mapState.selected=groups[Number(b.dataset.group)].items[0].id;
    if(b.hasAttribute('data-cycle'))mapState.selected=g.items[(i+1)%g.items.length].id;
    if(b.hasAttribute('data-dismiss'))mapState.selected=null;
    if(b.hasAttribute('data-report')&&a)reportPlace(a,getBook(a.bookId));
    if(b.dataset.zoom)mapState.zoom=Math.max(2,Math.min(18,zoom+Number(b.dataset.zoom)));
    renderMap();};
  t.onpointerdown=e=>{if(e.target.closest('button,a,aside'))return;const sx=e.clientX,sy=e.clientY;t.setPointerCapture(e.pointerId);t.onpointermove=p=>{mapState.center=unproject(cx+sx-p.clientX,cy+sy-p.clientY,zoom);mapState.selected=null;renderMap()};};
  t.onpointerup=t.onpointercancel=()=>{t.onpointermove=null};
}

function reportPlace(a,book){
  const dialog=document.createElement('dialog');dialog.className='place-report-dialog';
  dialog.innerHTML='<form method="dialog"><button class="dialog-x" value="cancel" aria-label="关闭">×</button><small>SHOE / CORRECTIONS</small><h2>举报地点错误</h2><p>'+esc(book.title)+' · '+esc(a.place)+'</p><label>问题类型<select name="reason"><option>地点位置有误</option><option>文学对应关系有误</option><option>原文摘录有误</option><option>其他问题</option></select></label><label>补充说明<textarea name="detail" maxlength="1200" placeholder="告诉我们哪里需要修正" required></textarea></label><div class="actions"><button class="btn solid" value="send">提交反馈</button></div></form>';
  app.append(dialog);dialog.showModal();dialog.onclose=()=>{
    if(dialog.returnValue==='send'){
      const f=new FormData(dialog.querySelector('form'));
      const body='书籍：'+book.title+' ('+book.id+')\\n地点：'+a.place+' ('+a.id+')\\n问题：'+f.get('reason')+'\\n说明：'+f.get('detail');
      if(String(f.get('detail')||'').trim())window.open('https://github.com/zzx20040118-a11y/shoe-library/issues/new?title='+encodeURIComponent('地点纠错：'+a.place)+'&body='+encodeURIComponent(body),'_blank','noopener');
    }
    dialog.remove();
  };
}

function craftsFor(book, page) {
  return Object.entries(records).filter(([key,value]) => key.startsWith('craft:') &&
    (!book || value.book === book.id && value.page === page));
}
function studioLink(book, page, type) {
  return '#studio?' + new URLSearchParams({id:book.id,p:page,type});
}
function craftHTML(card, isPreview = false) {
  const stickers = (card.stickers || []).join(' ');
  return `<article class="craft ${card.type === 'bookmark' ? 'bookmark' : ''} ${isPreview ? 'preview' : ''}" data-theme="${esc(card.theme)}" data-font="${esc(card.font)}">
    ${stickers ? `<div class="sticker">${esc(stickers)}</div>` : ''}
    <strong>${esc(card.title || (card.type === 'bookmark' ? '我的书签' : '我的文学打卡'))}</strong>
    ${card.quote ? `<p class="quote">“${esc(card.quote)}”</p>` : ''}
    ${card.photo ? `<img src="${esc(card.photo.startsWith('/api/shared-photo/') ? (location.origin===pagesOrigin ? accountOrigin : '')+card.photo : card.photo)}" alt="卡片照片">` : ''}
    ${card.placeNote ? `<small>${esc(card.placeNote)}</small>` : ''}
    ${card.memo ? `<p>${esc(card.memo)}</p>` : ''}
    ${getBook(card.book) ? `<small>《${esc(getBook(card.book).title)}》 · 第 ${card.page+1} 页</small>` : ''}
  </article>`;
}
function collection([key,card]) {
  const book = getBook(card.book);
  if (!book) return '';
  return `<div class="collection">${craftHTML(card)}<div class="actions"><a class="btn" href="${esc(readLink(book,card.page))}">打开原页</a><a class="btn" href="#studio?edit=${encodeURIComponent(key)}">编辑</a></div></div>`;
}
function shelf() {
  const saved = allBooks.filter(book => records['book:'+book.id]?.shelf).sort((a,b) => records['book:'+b.id].updated - records['book:'+a.id].updated);
  const cards = craftsFor().sort((a,b) => b[1].updated - a[1].updated);
  app.innerHTML = `<div class="wrap inner"><h1>我的书架</h1>
    <p class="sub">${user ? '书籍、阅读进度和手作卡片会随账号保存。' : '访客书架保存在这台设备上。'}</p>
    <section class="section"><div class="section-head"><h2>继续阅读</h2><a class="btn" href="#discover">发现作品</a></div>
    ${saved.length ? `<div class="grid">${saved.map(book => {
      const record = records['book:'+book.id];
      const progress=record.page+1;
      return `<a class="shelf-volume" href="${esc(readLink(book,null))}">${cover(book)}<div><h3>${esc(book.title)}</h3><small>${esc(book.author)}</small><p>${progress===book.pages.length?"已读至末页":"阅读中"} · ${progress} / ${book.pages.length} 页</p><progress aria-label="阅读进度" value="${progress}" max="${book.pages.length}"></progress></div></a>`;
    }).join('')}</div>` : '<div class="empty">书架还是空的。打开一本书，点击「加入书架」，就能从这里继续读。</div>'}</section>
    <section class="section"><div class="section-head"><h2>摘录与手记</h2><a class="btn" href="#journal">查看手记</a></div>
    ${cards.length ? `<div class="collections">${cards.map(collection).join('')}</div>` : '<div class="empty">在阅读器里制作书签，或选中文字制作一张摘录卡。</div>'}</section></div>`;
}
function linkedText(text, ranges, places) {
  let cursor = 0;
  let html = '';
  const segment = (from,to) => paint(text.slice(from,to),ranges.map(([a,b])=>[Math.max(a,from)-from,Math.min(b,to)-from]));
  for (const a of [...places].sort((x,y)=>x.at-y.at)) {
    if (a.at < cursor) continue;
    html += segment(cursor,a.at) + '<button class="literary-link" data-anchor="'+a.id+'" title="查看'+esc(a.place)+'的读者书签">'+segment(a.at,a.at+a.term.length)+'</button>';
    cursor = a.at+a.term.length;
  }
  return html + segment(cursor,text.length);
}
function openCommunity(a,book) {
  const dialog = document.createElement('dialog');
  dialog.className = 'place-dialog';
  dialog.innerHTML = `<div class="section-head"><div><p class="sub">《${esc(book.title)}》 · 第 ${a.page+1} 页</p><h2>${esc(a.term)}的读者书签</h2></div><button class="dialog-x" data-close aria-label="关闭">×</button></div>
  <p class="place-kind"><span aria-hidden="true">${placeKindIcon(a)}</span> ${placeKindLabel(a)}</p>\n  <div class="actions"><a class="btn" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${a.lat}&mlon=${a.lon}#map=15/${a.lat}/${a.lon}">查看地图</a>
  <a class="btn solid" href="${studioLink(book,a.page,'bookmark')}&anchor=${a.id}">为此处制作书签</a></div>
  <div class="collections" data-cards></div><p role="status" class="sub" data-status></p><button class="btn" data-more hidden>加载更多</button>`;
  app.append(dialog);
  dialog.showModal();
  dialog.querySelector('[data-close]').onclick = () => dialog.close();
  dialog.onclose = () => dialog.remove();
  const status = dialog.querySelector('[data-status]');
  const more = dialog.querySelector('[data-more]');
  let cursor = '';
  async function load() {
    more.hidden = true; status.textContent = '正在读取公开书签…';
    try {
      const response = await fetch((location.origin===pagesOrigin ? accountOrigin : '')+'/api/community?anchor='+a.id+(cursor ? '&before='+cursor : ''));
      if (!response.ok) throw new Error();
      const data = await response.json();
      dialog.querySelector('[data-cards]').insertAdjacentHTML('beforeend',data.cards.map(c => craftHTML(c)).join(''));
      status.textContent = !data.cards.length && !cursor ? '这里还没有公开书签。' : '';
      cursor = data.next;
      more.textContent = '加载更多'; more.hidden = !cursor;
    } catch { status.textContent = '暂时无法读取书签。'; more.textContent = '重试'; more.hidden = false; }
  }
  more.onclick = load; load();
}

// Keep original page IDs and text offsets stable while moving visible page breaks
// to the next natural sentence boundary. This does not rewrite book files or anchors.
function sentenceCarry(book,index){
  if(index<=0||index>=book.pages.length)return 0;
  const before=book.pages[index-1]||'',after=book.pages[index]||'';
  if(!before||!after||/[。！？.!?…][”’"')）】]*\s*$|\n\s*$/u.test(before))return 0;
  const prefix=after.slice(0,Math.min(after.length,280));
  const match=/[。！？!?]|\.([”’"')）】]*)(?=\s|$)|[;；](?=\s|$)/gu.exec(prefix);
  if(match)return match.index+match[0].length;
  const whitespace=prefix.search(/\s/u);
  return whitespace>=0&&whitespace<80?whitespace+1:0;
}
function readingSlice(book,page){
  if(!book.count)return {text:book.pages[page]||'',start:0,next:0};
  const start=sentenceCarry(book,page),next=sentenceCarry(book,page+1);
  return {text:(book.pages[page]||'').slice(start)+(book.pages[page+1]||'').slice(0,next),start,next};
}
function reader(params) {
  const book = getBook(params.get('id'));
  if (!book) { app.innerHTML = '<div class="wrap inner"><div class="empty">这本书找不到了。<a href="#discover">返回发现</a></div></div>'; return; }
  const previous = records['book:'+book.id] || {};
  const requestedPage = pageOf(book,params.get('p') ?? previous.page);
  const requestedAt=params.has('at')?Number(params.get('at')):-1;
  const page = requestedAt>=0&&requestedAt<sentenceCarry(book,requestedPage)&&requestedPage>0?requestedPage-1:requestedPage;
  const term = (params.get('q') || '').slice(0,80);
  const source = (params.get('from') || '').slice(0,100);
  const view=readingSlice(book,page);
  const text=view.text;
  const cards = craftsFor(book,page);
  const selectedRanges = cards.map(([,card]) => card.range).filter(Boolean);
  const places = [...(book.anchors?.filter(a=>a.page===page&&a.at>=view.start).map(a=>({...a,at:a.at-view.start}))||[]),...(view.next?book.anchors?.filter(a=>a.page===page+1&&a.at<view.next).map(a=>({...a,at:book.pages[page].length-view.start+a.at})):[])];
  const indexAt=requestedAt>=0?(requestedPage===page?requestedAt-view.start:book.pages[page].length-view.start+requestedAt):-1;
  const allHits=textRanges(text,term);
  const precise=allHits.find(([start])=>start===indexAt);
  const hit=precise ? [precise] : allHits;
  app.innerHTML = `<div class="wrap inner"><section class="reader">
    <div class="actions"><a class="btn" href="${previous.shelf && !source ? '#shelf' : '#discover'}">${previous.shelf && !source ? '返回书架' : '返回发现'}</a>
    <button class="btn solid" id="save-book">${previous.shelf ? '已加入书架' : '加入书架'}</button></div>
    <article class="paper"><h1>${esc(book.title)}</h1><details class="edition"><summary>${esc(book.author)} · 版本信息</summary>${esc(book.edition||'原创短篇')} ${book.source?'<a target="_blank" rel="noopener" href="'+esc(book.source)+'">查看底本</a>':''} ${book.count?'<a href="https://www.gutenberg.org/policy/license.html">Gutenberg 使用条款</a>':''}</details>
    <div class="prose" id="prose" lang="${({'英文':'en','法文':'fr','德文':'de','西班牙文':'es','芬兰文':'fi','荷兰文':'nl','意大利文':'it','葡萄牙文':'pt','日文':'ja','瑞典文':'sv','俄文':'ru','丹麦文':'da','la':'la'})[book.lang]||'zh'}">${linkedText(text,[...hit,...selectedRanges],places)}</div>
    <div class="actions"><a class="btn" href="${studioLink(book,page,'bookmark')}">记一笔</a><button id="save-quote" class="btn">摘录选文</button></div>
    ${cards.length?'<details class="folio"><summary>本页手记 · '+cards.length+'</summary><div class="collections">'+cards.map(collection).join('')+'</div></details>':''}

    </article><div class="reader-controls">
    ${page > 0 ? `<a class="btn" href="${esc(readLink(book,page-1,term,source))}">上一页</a>` : '<button class="btn" disabled>上一页</button>'}
    <details><summary aria-label="调整阅读进度">◒　${page+1} / ${book.pages.length}</summary><label>第 <output id="range-page">${page+1}</output> 页<input id="reading-range" aria-label="阅读进度" type="range" min="1" max="${book.pages.length}" value="${page+1}"></label></details>
    ${page < book.pages.length-1 ? `<a class="btn" href="${esc(readLink(book,page+1,term,source))}">下一页</a>` : '<button class="btn" disabled>下一页</button>'}
    </div></section></div>`;
  const slider=app.querySelector('#reading-range');if(slider){slider.oninput=()=>app.querySelector('#range-page').textContent=slider.value;slider.onchange=()=>location.hash=readLink(book,Number(slider.value)-1,term,source);}
  const target = document.querySelector('#prose');
  if(precise)requestAnimationFrame(()=>target.querySelector('mark')?.scrollIntoView({block:'nearest'}));
  target.querySelectorAll('[data-anchor]').forEach(btn => btn.onclick = () => { if (!window.getSelection()?.toString()) openCommunity(places.find(a=>a.id===btn.dataset.anchor),book); });
  function selectedText() {
    const current = window.getSelection();
    if (!current?.rangeCount || current.isCollapsed) return selection;
    const range = current.getRangeAt(0);
    if (!target.contains(range.startContainer) || !target.contains(range.endContainer)) return selection;
    const prefix = document.createRange();
    prefix.selectNodeContents(target);
    prefix.setEnd(range.startContainer,range.startOffset);
    const start = prefix.toString().length;
    return [start,start+range.toString().length];
  }
  target.onpointerup = () => {selection = null; selection = selectedText();};
  target.onkeyup = () => {selection = null; selection = selectedText();};
  document.querySelector('#save-quote').onpointerdown = event => {selection = selectedText(); if (selection) event.preventDefault();};
  document.querySelector('#save-quote').onclick = () => {
    if(!user){showAccount();return;}
    const range = selectedText() || (hit.length ? [0,text.length] : null);
    if (!range) { toast('先选中想收藏的文字。'); return; }
    draft = {book:book.id,page,type:'quote',quote:text.slice(...range),range};
    location.hash = studioLink(book,page,'quote');
  };
  document.querySelector('#save-book').onclick = async event => {
    if(!user){showAccount();return;}
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await saveProgress(book,page,!records['book:'+book.id]?.shelf,source);
      button.textContent = records['book:'+book.id].shelf ? '已加入书架' : '加入书架';
      toast(records['book:'+book.id].shelf ? '已保存书籍和这次发现。' : '已从书架移除。');
    } catch { toast('保存失败，请重试。'); }
    finally { button.disabled = false; }
  };
  if (previous.page !== page || source && previous.discovery !== source) {
    saveProgress(book,page,undefined,source).catch(() => toast('阅读进度暂未保存。'));
  }
}
const stickers = ['📍','🌙','✦','🌿','📖','✉️','☕','🌊'];
function studio(params) {
  const key = params.get('edit');
  const saved = key?.startsWith('craft:') ? records[key] : null;
  const book = getBook(params.get('id')) || books[0];
  const page = pageOf(book,params.get('p') ?? records['book:'+book.id]?.page);
  const pending = draft?.book === book.id && draft.page === page && params.get('type') === 'quote' ? draft : null;
  const card = {title:'',memo:'',photo:'',stickers:[],theme:'paper',font:'serif',type:'bookmark',book:book.id,page,...(saved || pending)};
  card.stickers = [...card.stickers];
  const locked = Boolean(saved || params.has('id'));
  const opts = (items,value) => items.map(([id,label]) => `<option value="${esc(id)}" ${String(id) === String(value) ? 'selected' : ''}>${esc(label)}</option>`).join('');
  const pages = () => opts(Array.from({length:getBook(card.book).pages.length},(_,i) => [i,`第 ${i+1} 页`]),card.page);
  app.innerHTML = `<div class="wrap inner"><h1>写手记</h1><p class="sub">${card.type === 'quote' ? '让一段摘录成为你的文学打卡。' : '给故事里的这一页做一枚书签。'}</p>
  <div class="studio"><form class="editor" id="editor">
    ${locked ? `<p class="sub">《${esc(getBook(card.book).title)}》 · 第 ${card.page+1} 页</p>` : `<label>选择书籍<select name="book">${opts(books.map(item => [item.id,item.title]),card.book)}</select></label><label>插入页码<select name="page">${pages()}</select></label>`}
    <label>标题<input name="title" maxlength="70" value="${esc(card.title)}" placeholder="写下标题"></label>
    <label>记录地点<input name="placeNote" maxlength="100" value="${esc(card.placeNote)}" placeholder="街道、城市或旅途中的一站"></label><label>个人手记<textarea name="memo" maxlength="1500" placeholder="记录这次阅读或到访的记忆">${esc(card.memo)}</textarea></label>
    <label>纸面模板<select name="theme">${opts([['paper','旧纸'],['green','叶绿'],['rose','蔷薇'],['night','深海']],card.theme)}</select></label>
    <label>字体<select name="font">${opts([['serif','宋体'],['sans','黑体'],['mono','等宽']],card.font)}</select></label>
    <label>照片<input type="file" id="photo" accept="image/png,image/jpeg,image/webp,image/gif"><span id="photo-status"></span></label>
    <div class="actions"><button type="button" class="btn" id="remove-photo">移除照片</button></div>
    <div><p class="sub">贴纸</p><div class="actions" id="stickers"></div></div>
    <div id="sharing"></div><div class="actions"><button class="btn solid" id="save-card">保存到书页</button><a class="btn" href="#shelf">返回书架</a></div>
  </form><div id="preview"></div></div></div>`;
  const editor = document.querySelector('#editor');
  const preview = document.querySelector('#preview');
  const photo = document.querySelector('#photo');
  const photoStatus = document.querySelector('#photo-status');
  const photoRemove = document.querySelector('#remove-photo');
  const submit = document.querySelector('#save-card');
  const id = saved ? key.slice(6) : crypto.randomUUID();
  let revision = 0;
  const sharing = document.querySelector('#sharing');
  card.anchor = card.anchor || params.get('anchor') || '';
  function sharingOptions() {
    const places = getBook(card.book).anchors?.filter(a=>a.page === card.page) || [];
    if (!places.some(a=>a.id === card.anchor)) card.anchor = places[0]?.id || '';
    card.shared=false;sharing.textContent='仅自己可见';
  }
  sharingOptions();
  const update = () => {
    preview.innerHTML = craftHTML(card,true);
    photoRemove.disabled = !card.photo;
    document.querySelector('#stickers').innerHTML = stickers.map(item => `<button type="button" class="btn ${card.stickers.includes(item) ? 'solid' : ''}" data-sticker="${item}" aria-label="贴纸 ${item}" aria-pressed="${card.stickers.includes(item)}">${item}</button>`).join('');
  };
  editor.oninput = event => {
    const {name,value} = event.target;
    if (name === 'anchor') { card.anchor = value; return; }
    if (name === 'shared') { card.shared = event.target.checked; return; }
    if (name === 'book') {
      card.book = value;
      card.page = pageOf(getBook(value),records['book:'+value]?.page);
      editor.elements.page.innerHTML = pages();
    } else if (name === 'page') card.page = Number(value);
    else if (['title','theme','font','memo','placeNote'].includes(name)) card[name] = value;
    else return;
    if (name === 'page' || name === 'book') { card.shared = false; sharingOptions(); }
    preview.innerHTML = craftHTML(card,true);
  };
  document.querySelector('#stickers').onclick = event => {
    const item = event.target.dataset.sticker;
    if (!item) return;
    if (card.stickers.includes(item)) card.stickers = card.stickers.filter(sticker => sticker !== item);
    else card.stickers.push(item);
    update();
    [...document.querySelector('#stickers').children].find(button => button.dataset.sticker === item)?.focus();
  };
  photo.onchange = async () => {
    const file = photo.files[0];
    if (!file) return;
    const current = ++revision;
    submit.disabled = true;
    photoStatus.textContent = '正在读取…';
    try {
      if (file.size > 15_000_000) throw new Error('请选择小于 15 MB 的图片。');
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      const scale = Math.min(1,900/Math.max(bitmap.width,bitmap.height));
      canvas.width = Math.max(1,Math.round(bitmap.width*scale));
      canvas.height = Math.max(1,Math.round(bitmap.height*scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fffdf7'; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      bitmap.close();
      if (current !== revision) return;
      card.photo = canvas.toDataURL('image/jpeg',.8);
      photoStatus.textContent = '照片已添加';
      update();
    } catch(error) { if (current === revision) photoStatus.textContent = file.size > 15_000_000 ? error.message : '无法读取图片，请换一张。'; }
    finally { if (current === revision) submit.disabled = false; }
  };
  photoRemove.onclick = () => {
    revision++; card.photo = ''; photo.value = '';
    photoStatus.textContent = ''; submit.disabled = false; update();
  };
  editor.onsubmit = async event => {
    event.preventDefault();
    submit.disabled = true;
    try {
      const snapshot = {...card,updated:Date.now()};
      if(!user){showAccount();return;}
      await save('craft:'+id,snapshot);

      draft = null;
      toast('已保存到对应书页。');
      location.hash = readLink(getBook(snapshot.book),snapshot.page);
    } catch { toast('卡片保存失败，请重试。'); }
    finally { submit.disabled = false; }
  };
  update();
}
function journal(){
  const cards=craftsFor().sort((a,b)=>b[1].updated-a[1].updated);
  app.innerHTML='<section class="wrap inner"><div class="section-head"><h1>我的手记</h1><a class="btn" href="#studio">写手记</a></div>'+(cards.length?'<div class="collections">'+cards.map(collection).join('')+'</div>':'<p class="empty">把一段摘录、一张街头照片或今天经过的地点记在这里。</p>')+'</section>';
}

async function render() {
  const version=++renderVersion;
  mapObserver?.disconnect();
  selection = null;
  const {name,params} = route();
  document.querySelectorAll('[data-nav]').forEach(link => {
    const active = link.dataset.nav === ({studio:'journal',library:'discover'}[name] || name);
    link.classList.toggle('active',active);
    if (active) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
  });
  const reading = name==='reader' || name==='studio' ? getBook(params.get('id') || records[params.get('edit')]?.book) : null;
  if (reading?.count && !reading.loaded) {
    app.innerHTML='<div class="wrap inner" role="status">正在载入《'+esc(reading.title)+'》…</div>';
    try { await loadBook(reading); }
    catch {
      if(version===renderVersion){
        app.innerHTML='<div class="wrap inner"><p class="empty">正文下载失败，请检查网络后重试。</p><button class="btn" id="retry-book">重新载入</button></div>';
        app.querySelector('#retry-book').onclick=render;
      }
      return;
    }
    if(version!==renderVersion)return;
  }
  if (name === 'explore') explore();
  else if (name === 'journal') journal();
  else if (name === 'library') discover();
  else if (name === 'shelf') shelf();
  else if (name === 'reader') reader(params);
  else if (name === 'studio') studio(params);
  else discover();
}
async function refreshPersonal(){
  await writeQueue.catch(()=>{});
  const next=await personal.cloudRecords(user.id);
  records=next;
  if(route().name!=='studio')render();
}
function showAccount(){accountDialog({user,local:localState,refresh:refreshPersonal,waitWrites:()=>writeQueue.catch(()=>{}),onSearch:term=>{query=term;location.hash='discover';render()}})}
async function boot(){
  document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
  records=localState();
  try {
    user=await personal.sessionUser();
    if(user){records={};records=await personal.cloudRecords(user.id)}
  }catch{toast('账号数据暂时无法加载，请刷新重试。')}
  personal.watchSession(user?.id||null);
  const account=document.querySelector('#account');
  account.innerHTML='<button class="account">'+icon('user')+(user?'个人资料':'邮箱登录')+'</button>';
  account.firstChild.onclick=showAccount;
  render();
  window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0)});
  if(user)window.addEventListener('focus',()=>{if(!document.querySelector('dialog')&&['shelf','journal'].includes(route().name))refreshPersonal().catch(()=>toast('暂时无法同步'))});
}
boot();
