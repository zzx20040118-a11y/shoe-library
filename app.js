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
let online = false;
let query = '';
let region = '全部';
let mapState;
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
async function save(key, value) {
  const task = writeQueue.catch(() => {}).then(async () => {
    if (online) {
      const response = await fetch('/api/records', {
        method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({key,value})
      });
      if (!response.ok) throw new Error('保存失败');
    } else {
      localStorage.setItem('atlas-guest', JSON.stringify({...records,[key]:value}));
    }
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
  });
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
function matches(book) {
  const needle = normalize(query);
  const eligible = book.anchors.filter(a => region === '全部' || a.region === region);
  if (!eligible.length) {
    if (region==='全部' && [book.title,book.en,book.author].some(v=>normalize(v).includes(needle))) return [{book,page:0,term:''}];
    return [];
  }
  if (!needle) {
    const a = eligible[0];
    return [{book:locatedBook(book,a),page:a.page,term:a.term}];
  }
  const pages = new Map();
  for (const a of eligible) {
    if ([a.term,a.place,a.city,...a.keywords.split(' ')].some(v => normalize(v).includes(needle))) {
      if (!pages.has(a.page)) pages.set(a.page,{book:locatedBook(book,a),page:a.page,term:a.term});
    }
  }
  for (const [page,text] of (!book.count || book.loaded ? book.pages : []).entries()) {
    if (!pages.has(page) && normalize(text).includes(needle) && (region === '全部' || eligible.some(a => a.page === page))) {
      pages.set(page,{book,page,term:query});
    }
  }
  if (!pages.size && [book.title,book.author,book.en].some(v => normalize(v).includes(needle))) {
    const a = eligible[0];
    pages.set(a.page,{book:locatedBook(book,a),page:a.page,term:a.term});
  }
  return [...pages.values()];
}
function cover(book) {
  return `<div class="cover ${book.col}" aria-hidden="true"><strong>${esc(book.title)}</strong><i class="cover-art ${book.art}"></i><small>${esc(book.en)}</small></div>`;
}
function bookCard({book,page,term,source,meta}) {
  const text = book.pages[page ?? book.featured] || book.anchors?.find(a=>a.page===page)?.snippet || book.sample || '';
  return `<a class="book-card" href="${esc(readLink(book,page,term,source))}">${cover(book)}<div class="book-info"><h3>${esc(book.title)}</h3><p>${esc(meta || book.author)}</p><span class="place">${book.place ? icon('pin')+esc(book.city)+' · '+esc(book.place) : esc(book.lang || '中文')+' · '+book.pages.length+' 页'}</span><p class="snippet">${paint(text,textRanges(text,term))}</p></div></a>`;
}
function discover() {
  const results = books.flatMap(matches);
  let resultLimit=30;
  app.innerHTML = `<div class="wrap"><section class="hero"><img src="./hero.jpg" class="hero-art" alt="" onerror="this.remove()"><div class="hero-copy">
    <div class="eyebrow">LITERARY ATLAS · 地点文学图书馆</div><h1>在一座城里，<br>读到另一座城。</h1>
    <p>从一条街、一座桥，走进写过它的故事。</p>
    <form id="search" class="search"><label class="search-box">${icon('search')}<input name="query" aria-label="地点或关键词" maxlength="80" placeholder="搜索城市、街道或关键词" value="${esc(query)}"><button>搜索</button></label><button type="button" id="locate" class="locate" ${locating ? 'disabled' : ''}>${icon('locate')}${locating ? '定位中' : '探索附近'}</button></form>
    <div class="popular"><span>热门地点</span>${['沧浪亭','西湖','贝克街','瓦尔登湖'].map(place => `<button data-place="${place}">${place}</button>`).join('')}</div>
    </div><div class="atlas-label">The Geography of Stories<small>文學地圖</small></div></section>
    ${locationMessage ? `<p class="map-caption" role="status">${esc(locationMessage)}</p>` : ''}
    ${mapState ? '<section class="section" id="nearby"><div class="section-head"><div><h2>附近的文学足迹</h2><p>已收录地点 · 15 公里内</p></div><button class="btn" id="close-map">关闭地图</button></div><div class="map" id="map" aria-label="附近文学地点地图"></div><div id="map-results"></div></section>' : ''}
    <section class="section" id="results"><div class="section-head"><div><h2>${query ? '搜索结果' : '地点书单'}</h2><p>${query ? `“${esc(query)}” · ${results.length} 处匹配` : '从这些地点出发，翻到故事发生的那一页。'}</p></div>
    <div class="filters" aria-label="按地区筛选">${['全部','华东','华中','西南','欧洲','北美'].map(name => `<button class="${name === region ? 'active' : ''}" aria-pressed="${name === region}" data-region="${name}">${name}</button>`).join('')}</div></div>
    ${results.length ? `<div class="grid">${results.slice(0,resultLimit).map(result => bookCard({...result,source:query || result.book.place})).join('')}</div>` : '<div class="empty">书库里暂时没有相关作品。试试附近的城市、地标或其他关键词。</div>'}${results.length > resultLimit ? '<button class="btn" id="more-matches">显示更多匹配</button>' : ''}</section></div>`;
  const moreMatches=app.querySelector('#more-matches');
  if (moreMatches) moreMatches.onclick=()=>{
    const next=results.slice(resultLimit,resultLimit+30); resultLimit+=next.length;
    app.querySelector('#results .grid').insertAdjacentHTML('beforeend',next.map(result=>bookCard({...result,source:query||result.book.place})).join(''));
    moreMatches.hidden=resultLimit>=results.length;
  };
  function search(value) {
    query = value.trim(); region = '全部'; render();
    document.querySelector('#results').scrollIntoView({block:'nearest'});
  }
  document.querySelector('#search').onsubmit = event => {event.preventDefault(); search(new FormData(event.currentTarget).get('query'));};
  app.querySelectorAll('[data-place]').forEach(button => button.onclick = () => search(button.dataset.place));
  app.querySelectorAll('[data-region]').forEach(button => button.onclick = () => { region = button.dataset.region; render(); });
  document.querySelector('#locate').onclick = locate;
  if (mapState) {
    document.querySelector('#close-map').onclick = () => { mapState = null; render(); };
    mapObserver = new ResizeObserver(renderMap);
    mapObserver.observe(document.querySelector('#map'));
    renderMap();
  }
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
function locate() {
  if (!navigator.geolocation) {
    locationMessage = '当前浏览器无法访问定位，可以直接搜索城市或地名。'; render(); return;
  }
  locating = true; locationMessage = ''; render();
  navigator.geolocation.getCurrentPosition(({coords}) => {
    const center = {lat:coords.latitude,lon:coords.longitude};
    const nearby = [...new Map(anchors.map(a=>[a.bookId+':'+a.term,a])).values()].map(a => ({book:locatedBook(getBook(a.bookId),a),pin:a.id,term:a.term,km:distance(center,a)})).filter(item => item.km <= 15).sort((a,b) => a.km - b.km);
    mapState = {center, nearby, zoom:nearby.at(-1)?.km > 6 ? 10 : 12, selected:null};
    locating = false;
    if (route().name === 'discover') { render(); document.querySelector('#nearby').scrollIntoView({block:'nearest'}); }
  }, error => {
    locating = false;
    locationMessage = error.code === 1 ? '定位权限未开启。你也可以直接搜索地名。' : '暂时无法获取位置，请重试或直接搜索地名。';
    if (route().name === 'discover') render();
  }, {timeout:10000,maximumAge:60000});
}
function project({lat,lon},zoom) {
  const n = 256 * 2**zoom;
  const latitude = Math.max(-85,Math.min(85,lat)) * Math.PI/180;
  return [n*(lon+180)/360,n*(1-Math.asinh(Math.tan(latitude))/Math.PI)/2];
}
function renderMap() {
  const target = document.querySelector('#map');
  if (!target || !mapState) return;
  const {zoom,center,nearby,selected} = mapState;
  const [cx,cy] = project(center,zoom);
  const w = target.clientWidth, h = target.clientHeight;
  const x0 = cx-w/2, y0 = cy-h/2, n = 2**zoom;
  let tiles = '';
  for (let x=Math.floor(x0/256); x<=Math.floor((x0+w)/256); x++) {
    for (let y=Math.max(0,Math.floor(y0/256)); y<=Math.min(n-1,Math.floor((y0+h)/256)); y++) {
      tiles += `<img alt="" width="256" height="256" src="https://tile.openstreetmap.org/${zoom}/${(x+n)%n}/${y}.png" style="left:${x*256-x0}px;top:${y*256-y0}px">`;
    }
  }
  const current = nearby.find(item => item.pin === selected);
  const cards = nearby.map(({book,km,term}) => bookCard({book,page:book.featured,term,source:'附近 · '+book.place,meta:`距你 ${km < 1 ? Math.round(km*1000)+' 米' : km.toFixed(1)+' 公里'}`}));
  target.innerHTML = tiles + `<span class="pin you" style="left:50%;top:50%">你的位置</span>` + nearby.map(({book,pin},index) => {
    const [x,y] = project(book,zoom);
    const top = Math.max(40,Math.min(h-18,y-y0));
    const left = Math.max(52,Math.min(w-52,x-x0));
    return `<button class="pin" style="left:${left}px;top:${top - (Math.abs(x-cx)<60 && Math.abs(y-cy)<35 ? 27+index*23 : 0)}px" data-pin="${pin}" aria-pressed="${selected === pin}">${book.place}</button>`;
  }).join('') + `<div class="map-tools"><button id="zoom-in" aria-label="放大">+</button><button id="zoom-out" aria-label="缩小">−</button></div><a class="map-note" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>` + (current ? `<div class="map-popup">${cards[nearby.indexOf(current)]}</div>` : '');
  target.querySelectorAll('[data-pin]').forEach(button => button.onclick = () => {mapState.selected = selected === button.dataset.pin ? null : button.dataset.pin; renderMap();});
  target.querySelector('#zoom-in').onclick = () => {mapState.zoom = Math.min(17,zoom+1); renderMap();};
  target.querySelector('#zoom-out').onclick = () => {mapState.zoom = Math.max(4,zoom-1); renderMap();};
  document.querySelector('#map-results').innerHTML = cards.length ? `<div class="grid" style="margin-top:12px">${cards.join('')}</div>` : '<p class="map-caption">附近暂未收录文学地点。可以搜索苏州、杭州、岳阳、武汉或济南。</p>';
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
      return bookCard({book,meta:`读到第 ${record.page+1} 页${record.discovery ? ' · ' + record.discovery : ''}`});
    }).join('')}</div>` : '<div class="empty">书架还是空的。打开一本书，点击「加入书架」，就能从这里继续读。</div>'}</section>
    <section class="section"><div class="section-head"><h2>书签与文学打卡</h2><a class="btn" href="#studio">打开手作室</a></div>
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
  dialog.innerHTML = `<div class="section-head"><div><p class="sub">《${esc(book.title)}》 · 第 ${a.page+1} 页</p><h2>${esc(a.term)}的读者书签</h2></div><button class="btn" data-close>关闭</button></div>
  <p>原文「${esc(a.term)}」对应今天的${esc(a.city)} · ${esc(a.place)}。</p>
  <p class="sub">地图参考点 ${a.lat.toFixed(3)}° N，${a.lon.toFixed(3)}° E · ${esc(a.keywords)}</p>
  <div class="actions"><a class="btn" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${a.lat}&mlon=${a.lon}#map=15/${a.lat}/${a.lon}">查看地图</a>
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

function reader(params) {
  const book = getBook(params.get('id'));
  if (!book) { app.innerHTML = '<div class="wrap inner"><div class="empty">这本书找不到了。<a href="#discover">返回发现</a></div></div>'; return; }
  const previous = records['book:'+book.id] || {};
  const page = pageOf(book,params.get('p') ?? previous.page);
  const term = (params.get('q') || '').slice(0,80);
  const source = (params.get('from') || '').slice(0,100);
  const text = book.pages[page];
  const cards = craftsFor(book,page);
  const selectedRanges = cards.map(([,card]) => card.range).filter(Boolean);
  const places = book.anchors?.filter(a => a.page === page) || [];
  const hit = textRanges(text,term);
  app.innerHTML = `<div class="wrap inner"><section class="reader">
    <div class="actions"><a class="btn" href="${previous.shelf && !source ? '#shelf' : '#discover'}">${previous.shelf && !source ? '返回书架' : '返回发现'}</a>
    <button class="btn solid" id="save-book">${previous.shelf ? '已加入书架' : '加入书架'}</button></div>
    <article class="paper"><h1>${esc(book.title)}</h1><p class="sub">${esc(book.author)} · ${esc(book.edition || '原创短篇')}${book.source ? ` · <a href="${esc(book.source)}" target="_blank" rel="noopener">公版底本</a>` : ''}</p>
    ${source ? `<span class="place">${icon('pin')}${esc(source)}</span>` : ''}
    ${places.length ? '<p class="sub">点按带下划线的地名，查看现实位置和读者书签。</p>' : ''}<p class="prose" id="prose">${linkedText(text,[...hit,...selectedRanges],places)}</p>
    <div class="actions"><a class="btn" href="${studioLink(book,page,'bookmark')}">制作书签</a><button id="save-quote" class="btn">收藏高亮</button></div>
    <p class="sub">选中文字可以标记自己的摘录，也可以收藏当前命中的段落。</p>
    ${book.count ? '<p class="sub">电子版底本由 Project Gutenberg 收录，权利标记为美国公有领域。<a target="_blank" rel="noopener" href="https://www.gutenberg.org/policy/license.html">电子版使用条款</a></p>' : ''}
    ${cards.length ? `<div class="folio"><h2>本页书签与摘录</h2><div class="collections">${cards.map(collection).join('')}</div></div>` : ''}
    ${book.pages.length>8 ? `<details class="book-tools"><summary>跳页与书内检索</summary><form id="goto-page"><label>页码 <input name="number" type="number" min="1" max="${book.pages.length}" value="${page+1}" required></label><button class="btn">跳转</button></form><form id="find-text"><input name="term" aria-label="书内关键词" placeholder="输入正文中的词语" maxlength="80" required><button class="btn">查找下一处</button></form></details>` : ''}
    </article><div class="reader-controls">
    ${page > 0 ? `<a class="btn" href="${esc(readLink(book,page-1,term,source))}">上一页</a>` : '<button class="btn" disabled>上一页</button>'}
    <span class="sub">第 ${page+1} 页 / 共 ${book.pages.length} 页</span>
    ${page < book.pages.length-1 ? `<a class="btn" href="${esc(readLink(book,page+1,term,source))}">下一页</a>` : '<button class="btn" disabled>下一页</button>'}
    </div></section></div>`;
  const jump=app.querySelector('#goto-page');
  if(jump) {
    jump.onsubmit=e=>{e.preventDefault();location.hash=readLink(book,Number(jump.elements.number.value)-1);};
    app.querySelector('#find-text').onsubmit=e=>{
      e.preventDefault();const word=e.currentTarget.elements.term.value.trim();if(!word)return;
      for(let offset=term===word?1:0;offset<=book.pages.length;offset++){
        const p=(page+offset)%book.pages.length;
        if(book.pages[p].toLowerCase().includes(word.toLowerCase())){location.hash=readLink(book,p,word);return;}
      }
      toast('这本书中没有找到该词。');
    };
  }
  const target = document.querySelector('#prose');
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
    const range = selectedText() || (hit.length ? [0,text.length] : null);
    if (!range) { toast('先选中想收藏的文字。'); return; }
    draft = {book:book.id,page,type:'quote',quote:text.slice(...range),range};
    location.hash = studioLink(book,page,'quote');
  };
  document.querySelector('#save-book').onclick = async event => {
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
  app.innerHTML = `<div class="wrap inner"><h1>手作室</h1><p class="sub">${card.type === 'quote' ? '让一段摘录成为你的文学打卡。' : '给故事里的这一页做一枚书签。'}</p>
  <div class="studio"><form class="editor" id="editor">
    ${locked ? `<p class="sub">《${esc(getBook(card.book).title)}》 · 第 ${card.page+1} 页</p>` : `<label>选择书籍<select name="book">${opts(books.map(item => [item.id,item.title]),card.book)}</select></label><label>插入页码<select name="page">${pages()}</select></label>`}
    <label>标题<input name="title" maxlength="70" value="${esc(card.title)}" placeholder="写下标题"></label>
    <label>备忘<textarea name="memo" maxlength="1500" placeholder="记录这次阅读或到访的记忆">${esc(card.memo)}</textarea></label>
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
  let pendingPhoto = null;
  let revision = 0;
  const sharing = document.querySelector('#sharing');
  card.anchor = card.anchor || params.get('anchor') || '';
  function sharingOptions() {
    const places = getBook(card.book).anchors?.filter(a=>a.page === card.page) || [];
    if (!places.some(a=>a.id === card.anchor)) card.anchor = places[0]?.id || '';
    if (!card.anchor || !online) card.shared = false;
    sharing.innerHTML = !places.length ? '' : !online ? '<p class="sub">登录后可把书签分享给这里的读者。</p>' :
      `<label>对应原文<select name="anchor">${opts(places.map(a=>[a.id,a.term+' · '+(getBook(card.book).pages[card.page]?.slice(Math.max(0,a.at-5),a.at+a.term.length+7) || a.snippet || a.term)]),card.anchor)}</select></label>
      <label class="share-check"><input type="checkbox" name="shared" ${card.shared ? 'checked' : ''}>公开这张卡片（包含照片与备忘）</label>`;
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
    else if (['title','theme','font','memo'].includes(name)) card[name] = value;
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
      pendingPhoto = await new Promise(resolve => canvas.toBlob(resolve,'image/jpeg',.8));
      photoStatus.textContent = '照片已添加';
      update();
    } catch(error) { if (current === revision) photoStatus.textContent = file.size > 15_000_000 ? error.message : '无法读取图片，请换一张。'; }
    finally { if (current === revision) submit.disabled = false; }
  };
  photoRemove.onclick = () => {
    revision++; pendingPhoto = null; card.photo = ''; photo.value = '';
    photoStatus.textContent = ''; submit.disabled = false; update();
  };
  editor.onsubmit = async event => {
    event.preventDefault();
    submit.disabled = true;
    try {
      const snapshot = {...card,updated:Date.now()};
      if (online && pendingPhoto) {
        const url = '/api/photo/' + crypto.randomUUID();
        const response = await fetch(url,{method:'PUT',body:pendingPhoto});
        if (!response.ok) throw new Error();
        snapshot.photo = url;
      }
      await save('craft:'+id,snapshot);
      if (online && saved?.photo?.startsWith('/api/photo/') && saved.photo !== snapshot.photo) {
        fetch(saved.photo,{method:'DELETE'}).catch(() => {});
      }
      draft = null;
      toast('已保存到对应书页。');
      location.hash = readLink(getBook(snapshot.book),snapshot.page);
    } catch { toast('卡片保存失败，请重试。'); }
    finally { submit.disabled = false; }
  };
  update();
}
let catalogQuery='', catalogLanguage='全部', catalogLimit=30;
function library() {
  app.innerHTML=`<section class="wrap inner"><h1>公版书库</h1><p class="sub">收录 ${books.length.toLocaleString()} 部作品与版本 · 正文按需载入</p>
  <form class="library-search" id="catalog-form"><label class="search-box">${icon('search')}<input aria-label="查找书名或作者" name="term" value="${esc(catalogQuery)}" placeholder="搜索书名、原名或作者"><button>查找</button></label>
  <select class="btn" aria-label="正文语言" id="catalog-language">${['全部',...new Set(books.map(b=>b.lang || '中文'))].map(l=>`<option ${l===catalogLanguage?'selected':''}>${esc(l)}</option>`).join('')}</select></form>
  <p id="catalog-count" class="sub" role="status"></p><div class="grid" id="catalog-results"></div><button id="catalog-more" class="btn">显示更多作品</button></section>`;
  const draw=()=>{
    const q=normalize(catalogQuery);
    const hits=books.filter(b=>(catalogLanguage==='全部'||(b.lang || '中文')===catalogLanguage)&&[b.title,b.author,b.en].some(v=>normalize(v).includes(q)));
    app.querySelector('#catalog-count').textContent='共 '+hits.length+' 个版本';
    app.querySelector('#catalog-results').innerHTML=hits.slice(0,catalogLimit).map(book=>bookCard({book,page:0,meta:book.author+' · '+(book.lang||'中文')})).join('')||'<p class="empty">未找到作品，可尝试原名或作者姓氏。</p>';
    app.querySelector('#catalog-more').hidden=catalogLimit>=hits.length;
  };
  app.querySelector('#catalog-form').onsubmit=e=>{e.preventDefault();catalogQuery=new FormData(e.currentTarget).get('term').trim();catalogLimit=30;draw();};
  app.querySelector('#catalog-language').onchange=e=>{catalogLanguage=e.target.value;catalogLimit=30;draw();};
  app.querySelector('#catalog-more').onclick=()=>{catalogLimit+=30;draw();};draw();
}
async function render() {
  const version=++renderVersion;
  mapObserver?.disconnect();
  selection = null;
  const {name,params} = route();
  document.querySelectorAll('[data-nav]').forEach(link => {
    const active = link.dataset.nav === name;
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
  if (name === 'library') library();
  else if (name === 'shelf') shelf();
  else if (name === 'reader') reader(params);
  else if (name === 'studio') studio(params);
  else discover();
}
async function boot() {
  document.querySelectorAll('[data-icon]').forEach(element => element.innerHTML = icon(element.dataset.icon));
  try {
    if(staticSite) { records=localState(); } else {
    const response = await fetch('/api/records',{cache:'no-store'});
    if (!response.ok) throw new Error();
    const state = await response.json();
    user = state.user;
    online = Boolean(user);
    records = online ? state.records : localState();
    }
  } catch { records = localState(); }
  const account = document.querySelector('#account');
  const returnTo = encodeURIComponent('/'+location.hash);
  account.innerHTML = user
    ? `<a class="account" href="/signout-with-chatgpt?return_to=%2F" title="退出登录" target="_top">${icon('user')}<span>${esc(user.name)}</span> · 退出</a>`
    : `<a class="account" data-login href="${accountOrigin}/signin-with-chatgpt?return_to=${returnTo}" target="_top">${icon('user')} 登录云书架</a>`;
  render();
  window.addEventListener('hashchange',() => {
    render();
    const signIn = account.querySelector('[data-login]');
    if (signIn) signIn.href = accountOrigin+'/signin-with-chatgpt?return_to=' + encodeURIComponent('/'+location.hash);
    window.scrollTo(0,0);
  });
}
boot();
