import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sites=[
 ['Saffron Hill',51.5204,-0.1042],['Clerkenwell',51.5224,-0.103],['Smithfield',51.5185,-0.1014],
 ['Holborn',51.5174,-0.1201],['London Bridge',51.5079,-0.0877],['Bethnal Green',51.527,-0.055],
 ['Whitechapel',51.5175,-0.059],['Pentonville',51.5325,-0.1133],['Hatton Garden',51.5197,-0.1085],
 ['Fleet Street',51.514,-0.1084],['Cornhill',51.5135,-0.0864],['Threadneedle Street',51.5144,-0.0887],
 ['Camden Town',51.5392,-0.1426]
];
const entries=[
 {id:'pg730',repo:'Oliver-Twist_730',path:'730-h/730-h.htm',title:'Oliver Twist',first:/CHAPTER\s+I\b/i},
 {id:'pg46',repo:'A-Christmas-Carol_46',path:'46-h/46-h.htm',title:'A Christmas Carol',first:/STAVE\s+ONE\b/i}
];
const decode=s=>s.replace(/&#(x[\da-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n))).replace(/&nbsp;/gi,' ').replace(/&mdash;/gi,'—').replace(/&ldquo;/gi,'“').replace(/&rdquo;/gi,'”').replace(/&lsquo;/gi,'‘').replace(/&rsquo;/gi,'’').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
const plain=s=>decode(s.replace(/<br\s*\/?\s*>/gi,' ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());
await mkdir('public/books',{recursive:true});
for(const entry of entries){
 const source='https://raw.githubusercontent.com/GITenberg/'+entry.repo+'/master/'+entry.path;
 const response=await fetch(source);if(!response.ok)throw Error('Download '+entry.id+': '+response.status);
 const html=await response.text();
 const all=[...html.matchAll(/<(h[1-6]|p)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
 const first=all.findIndex(m=>m[1].toLowerCase().startsWith('h')&&entry.first.test(plain(m[2])));
 if(first<0)throw Error('Cannot locate first chapter '+entry.id);
 const blocks=[];
 for(const m of all.slice(first)){
   if(/project gutenberg/i.test(plain(m[2]))&&/end of/i.test(plain(m[2])))break;
   const text=plain(m[2]);if(!text)continue;
   blocks.push({kind:m[1].toLowerCase()==='p'?'p':'chapter',text});
 }
 if(blocks.filter(b=>b.kind==='p').length<300)throw Error('Too few paragraphs '+entry.id);
 const pages=[];let page=[],size=0;
 for(const block of blocks){
   if(page.length&&(block.kind==='chapter'&&size>100||size+block.text.length>1550&&size>700)){
     pages.push(page);page=[];size=0;
   }
   page.push(block);size+=block.text.length+2;
 }
 if(page.length)pages.push(page);
 const pageTexts=pages.map(p=>p.map(b=>b.text).join('\n\n'));
 if(pageTexts.join('\n\n')!==blocks.map(b=>b.text).join('\n\n'))throw Error('Paragraph QA failed '+entry.id);
 const locations=[];
 for(const [term,lat,lon] of sites){
   const re=new RegExp('\\b'+term+'\\b','gi');
   for(let p=0;p<pageTexts.length;p++){
     for(const match of pageTexts[p].matchAll(re)){
       locations.push({term,place:term,city:'London',lat,lon,page:p,at:match.index,snippet:pageTexts[p].slice(Math.max(0,match.index-75),Math.min(pageTexts[p].length,match.index+term.length+105)),reviewStatus:'approved',mapEligible:true,relationType:'direct'});
     }
   }
 }
 const data={id:entry.id,title:entry.title,source,sourceType:'Gutenberg structured HTML',sourceSha256:createHash('sha256').update(html).digest('hex'),pages:pageTexts,blocks:pages,locations,qa:{paragraphs:blocks.filter(b=>b.kind==='p').length,pages:pages.length,places:new Set(locations.map(x=>x.place)).size,mentions:locations.length,lossless:true}};
 await writeFile('public/books/'+entry.id+'.json',JSON.stringify(data));
 console.log(entry.id,JSON.stringify(data.qa));
}
