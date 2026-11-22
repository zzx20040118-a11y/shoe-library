#!/usr/bin/env node
// Import the publisher's structured HTML edition, not hard-wrapped TXT.
// Preserve each original <p> and chapter heading as a discrete book block.
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const source='https://raw.githubusercontent.com/GITenberg/The-Adventures-of-Sherlock-Holmes_1661/master/1661-h/1661-h.htm';
const response=await fetch(source);
if(!response.ok)throw Error('Structured Gutenberg HTML unavailable: '+response.status);
const html=await response.text();
const begin=html.search(/<center>\s*<h3>\s*<a\s+name=["']1["']/i);
if(begin<0)throw Error('First story heading missing');
const tail=html.slice(begin);
const stop=tail.search(/<\/div>\s*<pre>/i);
const body=stop>0?tail.slice(0,stop):tail;
const decode=s=>s.replace(/&#(x[\da-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n)))
.replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
const plain=s=>decode(s.replace(/<br\s*\/?\s*>/gi,' ').replace(/<[^>]*>/g,' ').replace(/[\r\n]+/g,' ').replace(/[ \t\u00a0]+/g,' ').trim());
const blocks=[];
const tokens=body.split(/(<center>\s*<h3>[\s\S]*?<\/h3>\s*<\/center>|<p\b[^>]*>)/gi);
let kind='text';
for(const token of tokens){
 if(!token)continue;
 if(/^<p\b/i.test(token)){kind='p';continue}
 if(/^<center>\s*<h3>/i.test(token)){
   const title=plain(token);
   if(/^(?:ADVENTURE\s+)?[IVX]+\./i.test(title))blocks.push({kind:'chapter',text:title});
   kind='text';continue;
 }
 const text=plain(token);
 if(!text)continue;
 // The edition's <p> tags are intentionally unclosed (HTML 4); each starts a new paragraph.
 // Text before the first <p> after a heading is a section numeral such as "I.".
 if(kind==='p')blocks.push({kind:'p',text});
 else if(/^([IVX]+\.)$/.test(text))blocks.push({kind:'section',text});
 else if(!/^(?:Project Gutenberg|End of Project Gutenberg)/i.test(text))blocks.push({kind:'p',text});
 kind='text';
}
if(blocks.length<1800||blocks.filter(b=>b.kind==='chapter').length!==12)throw Error('Unexpected structured content: '+blocks.length+' blocks; chapters '+blocks.filter(b=>b.kind==='chapter').length);
const pages=[];let current=[],length=0;
for(const block of blocks){
 const size=block.text.length;
 if(current.length&&(block.kind==='chapter'||(length+size>1550&&length>700))){
   pages.push(current);current=[];length=0;
 }
 current.push(block);length+=size+2;
}
if(current.length)pages.push(current);
const pageTexts=pages.map(p=>p.map(b=>b.text).join('\n\n'));
const reconstructed=pageTexts.join('\n\n');
const expected=blocks.map(b=>b.text).join('\n\n');
if(reconstructed!==expected)throw Error('Paragraph-preservation QA failed');
const chapterCount=blocks.filter(b=>b.kind==='chapter').length;
const data={id:'pg1661',title:'The Adventures of Sherlock Holmes',source,sourceType:'Gutenberg structured HTML',sourceSha256:createHash('sha256').update(html).digest('hex'),pages:pageTexts,blocks:pages,locations:[],qa:{chapters:chapterCount,paragraphs:blocks.filter(b=>b.kind==='p').length,pages:pages.length,lossless:true}};
await mkdir('public/books',{recursive:true});
await writeFile('public/books/pg1661.json',JSON.stringify(data));
console.log(JSON.stringify(data.qa));
