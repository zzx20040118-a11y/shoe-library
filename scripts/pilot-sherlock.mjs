#!/usr/bin/env node
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const id='pg1661';
const urls=['https://www.gutenberg.org/cache/epub/1661/pg1661.txt','https://www.gutenberg.org/ebooks/1661.txt.utf-8'];
let raw='',source='';
for(const url of urls){try{const r=await fetch(url);if(r.ok){raw=await r.text();source=url;break}}catch(e){console.warn(e.message)}}
if(!raw)throw Error('Source download failed; no book published');
const start=raw.search(/\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i);
const end=raw.search(/\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i);
if(start<0||end<=start)throw Error('Gutenberg delimiters missing');
const original=raw.slice(raw.indexOf('\n',start)+1,end).replace(/\r\n?/g,'\n').trim();
if(original.length<100000||!original.includes('Baker Street'))throw Error('Unexpected source text');
const sha256=s=>createHash('sha256').update(s).digest('hex');
const headings=[...original.matchAll(/^(?:THE ADVENTURES OF SHERLOCK HOLMES|A SCANDAL IN BOHEMIA|THE RED-HEADED LEAGUE|A CASE OF IDENTITY|THE BOSCOMBE VALLEY MYSTERY|THE FIVE ORANGE PIPS|THE MAN WITH THE TWISTED LIP|THE ADVENTURE OF THE BLUE CARBUNCLE|THE ADVENTURE OF THE SPECKLED BAND|THE ADVENTURE OF THE ENGINEER'S THUMB|THE ADVENTURE OF THE NOBLE BACHELOR|THE ADVENTURE OF THE BERYL CORONET|THE ADVENTURE OF THE COPPER BEECHES)\s*$/gm)].map(m=>({title:m[0],offset:m.index}));
const target=1500;
const paragraphs=[...original.matchAll(/\n[ \t]*\n/g)].map(m=>m.index+m[0].length);
const offsets=[0];let from=0;
while(from<original.length){
 const ideal=from+target;
 if(ideal>=original.length){offsets.push(original.length);break}
 const min=from+975,max=Math.min(original.length,from+2475);
 const chapter=headings.filter(h=>h.offset>=min&&h.offset<=max);
 let next=chapter.length?chapter.reduce((a,b)=>Math.abs(a.offset-ideal)<Math.abs(b.offset-ideal)?a:b).offset:null;
 if(next===null){const options=paragraphs.filter(x=>x>=min&&x<=max);if(options.length)next=options.reduce((a,b)=>Math.abs(a-ideal)<Math.abs(b-ideal)?a:b)}
 if(next===null){const m=/[.!?][”"')\]]*\s+/.exec(original.slice(ideal));next=m?ideal+m.index+m[0].length:original.length}
 if(next<=from)throw Error('Non advancing pagination');
 offsets.push(next);from=next;
}
const pages=offsets.slice(0,-1).map((start,i)=>({start,end:offsets[i+1],text:original.slice(start,offsets[i+1])}));
if(pages.map(p=>p.text).join('')!==original)throw Error('Lossless QA failed');
const candidates=[
 ['Baker Street','贝克街','伦敦','direct',51.5237,-0.1585],
 ['Hyde Park','海德公园','伦敦','direct',51.507,-0.166],
 ['Charing Cross','查令十字','伦敦','direct',null,null],
 ['Trafalgar Square','特拉法加广场','伦敦','direct',51.508,-0.1281],
 ['London','伦敦','伦敦','city-context',null,null],
 ['Paris','巴黎','巴黎','city-context',null,null]
];
const locations=[];
for(const [term,place,city,kind,lat,lon] of candidates){
 const re=new RegExp('\\b'+term.replaceAll(' ','\\s+')+'\\b','gi');
 for(const m of original.matchAll(re)){
  const absolute=m.index;let low=0,high=pages.length-1;
  while(low<high){const mid=(low+high)>>1;if(absolute>=pages[mid].end)low=mid+1;else high=mid}
  locations.push({term:m[0],place,city,kind,lat,lon,absolute,page:low,at:absolute-pages[low].start,snippet:original.slice(Math.max(0,absolute-80),Math.min(original.length,absolute+110)),reviewStatus:'pending',mapEligible:false});
 }
}
for(const l of locations)if(pages[l.page].text.slice(l.at,l.at+l.term.length)!==l.term)throw Error('Location offset QA failed');
const result={schemaVersion:1,id,title:'The Adventures of Sherlock Holmes',author:'Arthur Conan Doyle',language:'en',source,sourceSha256:sha256(original),reviewStatus:'pending',qa:{lossless:true,characters:original.length,pages:pages.length,chaptersDetected:headings.length,locations:locations.length,reviewedLocations:0},chapters:headings.map(h=>({...h,page:pages.findIndex(p=>h.offset>=p.start&&h.offset<p.end)})),pages,locations};
await mkdir('research/generated',{recursive:true});
await writeFile('research/generated/pg1661-pilot.json',JSON.stringify(result,null,2)+'\n');
await mkdir('public/books',{recursive:true});
await writeFile('public/books/pg1661.json',JSON.stringify({id,title:result.title,source:result.source,sourceSha256:result.sourceSha256,pages:pages.map(p=>p.text),locations:locations.filter(l=>l.kind==='direct').map(l=>({term:l.term,place:l.place,city:l.city,page:l.page,at:l.at,lat:l.lat,lon:l.lon,reviewStatus:'pending',mapEligible:false}))}));
console.log(JSON.stringify(result.qa,null,2));
console.log('Pilot draft only. No automatic publication.');
