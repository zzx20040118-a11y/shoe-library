import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const entries=[
 {id:'pg1023',title:'Bleak House',repo:'Bleak-House_1023'},
 {id:'pg963',title:'Little Dorrit',repo:'Little-Dorrit_963'},
 {id:'pg883',title:'Our Mutual Friend',repo:'Our-Mutual-Friend_883'},
 {id:'pg700',title:'The Old Curiosity Shop',repo:'The-Old-Curiosity-Shop_700'}
];
const sites=[
 ['Chancery Lane',51.5173,-0.1119],['Lincoln’s Inn',51.5166,-0.1151],["Lincoln's Inn",51.5166,-0.1151],
 ['Fleet Street',51.514,-0.1084],['Temple Bar',51.5136,-0.1115],['Covent Garden',51.5117,-0.123],
 ['Holborn',51.5174,-0.1201],['Smithfield',51.5185,-0.1014],['Clerkenwell',51.5224,-0.103],
 ['Whitechapel',51.5175,-0.059],['London Bridge',51.5079,-0.0877],['Southwark',51.5035,-0.0865],
 ['Marshalsea',51.5013,-0.0914],['Borough High Street',51.503,-0.0915],
 ['Bleeding Heart Yard',51.5204,-0.1063],['Hampstead',51.5569,-0.178],
 ['Hampstead Heath',51.5609,-0.163],['Greenwich',51.4826,0.0077],
 ['Limehouse',51.5125,-0.039],['Rotherhithe',51.5004,-0.0555],
 ['Wapping',51.5056,-0.057],['Pentonville',51.5325,-0.1133],
 ['Cheapside',51.5141,-0.094],['St. Paul’s Cathedral',51.5138,-0.0984],
 ["St. Paul's Cathedral",51.5138,-0.0984],['Westminster Bridge',51.5008,-0.1217],
 ['Westminster Abbey',51.4993,-0.1273],['Piccadilly',51.5099,-0.1356],
 ['Soho Square',51.5152,-0.1323],['Trafalgar Square',51.508,-0.1281],
 ['Charing Cross',51.508,-0.1247],['Blackfriars Bridge',51.5097,-0.1044],
 ['Hatton Garden',51.5197,-0.1085],['Bishopsgate',51.5169,-0.0811]
];
const normalize=s=>s.replace(/\r\n?/g,'\n').replace(/[ \t]+/g,' ').trim();
await mkdir('public/books',{recursive:true});
for(const entry of entries){
 const urls=[
  'https://raw.githubusercontent.com/GITenberg/'+entry.repo+'/master/'+entry.id.slice(2)+'-0.txt',
  'https://raw.githubusercontent.com/GITenberg/'+entry.repo+'/master/'+entry.id.slice(2)+'.txt',
  'https://www.gutenberg.org/cache/epub/'+entry.id.slice(2)+'/pg'+entry.id.slice(2)+'.txt',
  'https://www.gutenberg.org/ebooks/'+entry.id.slice(2)+'.txt.utf-8'
 ];
 let text='',source='';
 for(const url of urls){
  try{const r=await fetch(url,{headers:{'User-Agent':'SHOE-literary-atlas/1.0'}});if(!r.ok)continue;const value=await r.text();if(value.length<50000||!value.includes('Project Gutenberg'))continue;text=value;source=url;break}catch{}
 }
 if(!text)throw Error('Cannot fetch verified Gutenberg text for '+entry.id);
 const start=text.search(/\*\*\* START OF (THE|THIS) PROJECT GUTENBERG EBOOK/i);
 const end=text.search(/\*\*\* END OF (THE|THIS) PROJECT GUTENBERG EBOOK/i);
 if(start<0||end<0||end<=start)throw Error('Gutenberg license boundaries missing '+entry.id);
 text=text.slice(text.indexOf('\n',start)+1,end);
 // Preserve paragraph boundaries, remove Gutenberg header and split chapter headings.
 const chunks=normalize(text).split(/\n\s*\n/).map(x=>normalize(x.replace(/\n(?!\n)/g,' '))).filter(Boolean);
 const blocks=chunks.map(text=>({kind:/^(chapter\s+[ivxlcdm\d]+\b|book\s+(?:the\s+)?[ivxlcdm\d]+\b)/i.test(text)?'chapter':'p',text}));
 if(blocks.length<350)throw Error('Insufficient source paragraphs '+entry.id+': '+blocks.length);
 const pages=[];let page=[],size=0;
 for(const b of blocks){
  if(page.length&&((b.kind==='chapter'&&size>100)||(size+b.text.length>1550&&size>700))){pages.push(page);page=[];size=0}
  page.push(b);size+=b.text.length+2;
 }
 if(page.length)pages.push(page);
 const pageTexts=pages.map(p=>p.map(b=>b.text).join('\n\n'));
 if(pageTexts.join('\n\n')!==blocks.map(b=>b.text).join('\n\n'))throw Error('Lossless QA failed '+entry.id);
 const locations=[];
 for(const [term,lat,lon] of sites){
  const re=new RegExp('\\b'+term.replaceAll('.', '\\.').replaceAll('?', '\\?')+'\\b','gi');
  for(let p=0;p<pageTexts.length;p++)for(const m of pageTexts[p].matchAll(re)){
   locations.push({term,place:term,city:'London',lat,lon,page:p,at:m.index,
    snippet:pageTexts[p].slice(Math.max(0,m.index-75),Math.min(pageTexts[p].length,m.index+term.length+105)),
    reviewStatus:'candidate',mapEligible:false,relationType:'direct'});
  }
 }
 const data={id:entry.id,title:entry.title,source,sourceType:'Project Gutenberg UTF-8 plain text',
 sourceSha256:createHash('sha256').update(text).digest('hex'),pages:pageTexts,blocks:pages,locations,
 qa:{paragraphs:blocks.length,pages:pages.length,places:new Set(locations.map(x=>x.place)).size,mentions:locations.length,lossless:true,locationReview:'pending'}};
 await writeFile('public/books/'+entry.id+'.json',JSON.stringify(data));
 console.log(entry.id,JSON.stringify(data.qa));
}
