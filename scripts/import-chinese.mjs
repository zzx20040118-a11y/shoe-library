import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const works=[
 {id:'zh-chaohua',title:'朝花夕拾',author:'鲁迅',sourcePage:'朝花夕拾',chapters:[['小引','朝花夕拾/小引'],['狗·猫·鼠','狗·猫·鼠'],['阿长与《山海经》','阿長與《山海經》'],['二十四孝图','二十四孝圖'],['五猖会','五猖會'],['无常','无常'],['从百草园到三味书屋','從百草園到三味書屋'],['父亲的病','父亲的病'],['琐记','琐记'],['藤野先生','藤野先生'],['范爱农','范愛農'],['后记','朝花夕拾/後記']]},
 {id:'zh-chunfeng',title:'春风沉醉的晚上',author:'郁达夫',sourcePage:'春風沉醉的晚上'},
 {id:'zh-qinhuai',title:'桨声灯影里的秦淮河',author:'朱自清',sourcePage:'槳聲燈影裏的秦淮河'}
];
const decode=s=>s.replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n)))
 .replace(/&(nbsp|thinsp|ensp|emsp);/gi,' ')
 .replace(/&(?:ldquo|rdquo);/gi,'”').replace(/&(?:lsquo|rsquo);/gi,'’')
 .replace(/&mdash;/gi,'—').replace(/&ndash;/gi,'–').replace(/&hellip;/gi,'…')
 .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
const clean=s=>decode(s.replace(/<br\s*\/?>/gi,'\n').replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi,'')
 .replace(/<[^>]+>/g,'').replace(/[\u200b-\u200d\ufeff]/g,'').replace(/\u00a0/g,' ')
 .replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').trim());
async function fetchHtml(page){
 const url='https://zh.wikisource.org/w/api.php?'+new URLSearchParams({action:'parse',page,prop:'text',format:'json',variant:'zh-hans',disableeditsection:'1',redirects:'1'});
 let res;
 for(let attempt=0;attempt<6;attempt++){
   await new Promise(resolve=>setTimeout(resolve,attempt===0?1800:Math.min(40000,6000*2**attempt)));
   res=await fetch(url,{headers:{'User-Agent':'SHOE-LiteraryAtlas/1.0 (noncommercial literary research; source Wikimedia)'},signal:AbortSignal.timeout(25000)});
   if(res.status!==429&&res.status<500)break;
 }
 if(!res.ok)throw Error('Wikisource HTTP '+res.status+' for '+page);
 const json=await res.json();
 if(json.error||!json.parse?.text?.['*'])throw Error('Missing Wikisource content '+page+': '+JSON.stringify(json.error||{}));
 return {html:json.parse.text['*'],url:'https://zh.wikisource.org/wiki/'+encodeURIComponent(page)};
}
function parseBlocks(html){
 // Strip embedded MediaWiki styles and scripts before parsing text nodes.
 html=html.replace(/<(style|script|noscript|template)\\b[^>]*>[\\s\\S]*?<\\/\\1>/gi,'');
 const output=[];
 // Ignore page navigation, footnotes and table of contents, retain only source paragraphs and section headings.
 for(const m of html.matchAll(/<(p|h2|h3|h4|div)\b([^>]*)>([\s\S]*?)<\/\1>/gi)){
  const tag=m[1].toLowerCase(),attr=m[2],inside=m[3];
  if(tag==='div'&&!/\b(?:poem|verse)\b/i.test(attr))continue;
  if(/class=["'][^"']*(?:mw-empty-elt|toc|mw-collapsible|reference|mw-heading|navbox|license)[^"']*["']/i.test(attr))continue;
  const txt=clean(inside);
  if(!txt||/^(?:编辑|目次|目录|下载|注释|参考资料|维基文库)$/.test(txt))continue;
  if(/\\.mw-parser-output\\s|\\.variant-text\\s*\\{|(?:background|cursor|z-index|border-bottom)\\s*:/.test(txt))continue;
  if(tag==='div'&&txt.length>1800)continue;
  output.push({kind:tag.startsWith('h')?'chapter':'p',text:txt});
 }
 return output;
}
function paginate(blocks){
 const pages=[];let page=[],size=0;
 for(const block of blocks){
  if(page.length&&((block.kind==='chapter'&&size>120)||(size+block.text.length>1250&&size>500))){pages.push(page);page=[];size=0}
  page.push(block);size+=block.text.length+2;
 }
 if(page.length)pages.push(page);
 return pages;
}
const places={
 '朝花夕拾':['百草园','三味书屋','厦门大学','中山大学','白云楼','仙台','绍兴','南京','东京','北京'],
 '春风沉醉的晚上':['静安寺路','跑马厅','外白渡桥','邓脱路','日新里'],
 '桨声灯影里的秦淮河':['秦淮河','利涉桥','东关头','大中桥','复成桥','颐和园','西湖','瘦西湖']
};
// Verified real-world literary locations. Ambiguous or unverified mentions remain candidates.
const verifiedPlaces={
 '朝花夕拾':{
  '百草园':['绍兴',29.9971,120.5855],
  '三味书屋':['绍兴',29.9975,120.5858],
  '仙台':['仙台',38.2682,140.8694],
  '绍兴':['绍兴',29.9958,120.5861],
  '南京':['南京',32.0603,118.7969],
  '东京':['东京',35.6762,139.6503],
  '北京':['北京',39.9042,116.4074]
 },
 '春风沉醉的晚上':{
  '静安寺路':['上海',31.2235,121.4465],
  '外白渡桥':['上海',31.2446,121.4901],
  '跑马厅':['上海',31.2318,121.4726]
 },
 '桨声灯影里的秦淮河':{
  '秦淮河':['南京',32.0204,118.7883],
  '利涉桥':['南京',32.0228,118.7908],
  '大中桥':['南京',32.0276,118.8004]
 }
};
await mkdir('public/books',{recursive:true});
for(const work of works){
 let blocks=[],sources=[];
 if(work.chapters){
   for(const [heading,page] of work.chapters){
     const source=await fetchHtml(page);
     const section=parseBlocks(source.html).filter(b=>b.kind==='p');
     if(section.length<3)throw Error('Incomplete chapter '+page);
     blocks.push({kind:'chapter',text:heading},...section);
     sources.push(source.url);
   }
 }else{
   const source=await fetchHtml(work.sourcePage);
   blocks=parseBlocks(source.html);
   sources.push(source.url);
 }
 if(blocks.filter(b=>b.kind==='p').length<(work.id==='zh-chaohua'?120:5))throw Error('Insufficient paragraphs: '+work.id);
 if(blocks.some(b=>/\\.mw-parser-output|\\.variant-text\\s*\\{|(?:z-index|border-bottom)\\s*:/.test(b.text)))throw Error('Styles leaked into book text: '+work.id);
 const paged=paginate(blocks);
 const pages=paged.map(p=>p.map(b=>b.text).join('\n\n'));
 if(pages.join('\n\n')!==blocks.map(b=>b.text).join('\n\n'))throw Error('Text QA failed '+work.id);
 const locations=[];
 for(const term of places[work.title]){
  for(let p=0;p<pages.length;p++){
   let start=0,index;
   while((index=pages[p].indexOf(term,start))!==-1){
    const match=verifiedPlaces[work.title]?.[term];
    locations.push({term,place:term,page:p,at:index,city:match?.[0]||'',...(match?{lat:match[1],lon:match[2]}:{}),snippet:pages[p].slice(Math.max(0,index-45),Math.min(pages[p].length,index+term.length+80)),
     reviewStatus:match?'approved':'candidate',mapEligible:!!match,relationType:'direct'});
    start=index+term.length;
   }
  }
 }
 const data={id:work.id,title:work.title,author:work.author,source:sources[0],sources,
  sourceType:'Wikisource Chinese original (zh-hans)',sourceSha256:createHash('sha256').update(pages.join('\n\n')).digest('hex'),
  pages,blocks:paged,locations,
  qa:{paragraphs:blocks.filter(b=>b.kind==='p').length,pages:pages.length,places:new Set(locations.map(x=>x.place)).size,mentions:locations.length,lossless:true,locationReview:'pending'}};
 await writeFile('public/books/'+work.id+'.json',JSON.stringify(data));
 console.log(work.id,JSON.stringify(data.qa));
}
