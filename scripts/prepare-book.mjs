#!/usr/bin/env node
/**
 * SHOE text preparation. Node >=18, no external dependencies.
 * node scripts/prepare-book.mjs --id pg4300
 * node scripts/prepare-book.mjs --id pg4300 --annotations research/pg4300.places.json
 * Reads library/<id>.json.gz and writes research/generated/<id>.json.
 * NEVER changes the original book or the live catalog.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const flag=name=>args[args.indexOf(name)+1];
const id=flag('--id');
if(!id||!/^pg\d+$/.test(id)){console.error('Usage: node scripts/prepare-book.mjs --id pg4300 [--annotations path]');process.exit(2)}
const source=resolve(root,'library',id+'.json.gz');
let raw;
try { raw=await readFile(source); }
catch(error){
  if(error.code!=='ENOENT')throw error;
  const archive='https://raw.githubusercontent.com/zzx20040118-a11y/shoe-library/876228c00a71644e54d00fd94fe818f4fa5fa8ca/library/'+id+'.json.gz';
  console.error('Local original unavailable; fetching archived edition: '+archive);
  const response=await fetch(archive);
  if(!response.ok)throw Error('Archived text unavailable: HTTP '+response.status);
  raw=Buffer.from(await response.arrayBuffer());
}

const oldPages=JSON.parse((raw[0]===31&&raw[1]===139?gunzipSync(raw):raw).toString('utf8'));
if(!Array.isArray(oldPages)||!oldPages.every(p=>typeof p==='string'))throw Error('Invalid original pages');
const original=oldPages.join('');
const hash=s=>createHash('sha256').update(s).digest('hex');
const oldOffsets=[];let running=0;
for(const p of oldPages){oldOffsets.push(running);running+=p.length}
const isCJK=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(original.slice(0,6000));
const target=Number(flag('--target'))|| (isCJK?950:1500);
if(target<300||target>10000)throw Error('Target must be between 300 and 10000');
function boundary(from){
  const desired=Math.min(original.length,from+target);
  if(desired===original.length)return desired;
  const searchEnd=Math.min(original.length,from+Math.round(target*1.7));
  const searchStart=Math.max(from+Math.round(target*.55),0);
  const candidates=[];
  const pattern=/\n\s*\n|[。！？!?][”’"'）】]*\s*|[.!?][”’"')\]]*(?=\s|$)\s*|[;；]\s+/gu;
  pattern.lastIndex=searchStart;
  for(let m; (m=pattern.exec(original))&&m.index<searchEnd;){
    const end=m.index+m[0].length;
    if(end>from&&end<=searchEnd)candidates.push({end,paragraph:/^\n\s*\n/.test(m[0])});
    if(m[0].length===0)pattern.lastIndex++;
  }
  if(candidates.length){
    candidates.sort((a,b)=> (Math.abs(a.end-desired)-(a.paragraph?target*.18:0))-(Math.abs(b.end-desired)-(b.paragraph?target*.18:0)));
    return candidates[0].end;
  }
  // Never cut through an unpunctuated sentence merely to meet a length limit.
  pattern.lastIndex=searchEnd;
  const next=pattern.exec(original);
  return next?next.index+next[0].length:original.length;
}
const pages=[];let from=0;
while(from<original.length){
  const to=boundary(from);
  if(to<=from)throw Error('Non-advancing pagination');
  pages.push({start:from,end:to,text:original.slice(from,to)});
  from=to;
}
if(pages.map(p=>p.text).join('')!==original)throw Error('Text fidelity check failed');
function originalToAbsolute(page,at){
  if(!Number.isInteger(page)||!Number.isInteger(at)||page<0||page>=oldPages.length||at<0||at>oldPages[page].length)throw Error('Invalid original position');
  return oldOffsets[page]+at;
}
function absoluteToNew(at){
  if(at<0||at>original.length)throw Error('Invalid absolute position');
  let lo=0,hi=pages.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(at>=pages[mid].end)lo=mid+1;else hi=mid}
  return {page:lo,at:at-pages[lo].start};
}
let annotations=[];
if(args.includes('--annotations')){
  const path=resolve(root,flag('--annotations'));
  annotations=JSON.parse(await readFile(path,'utf8'));
  if(!Array.isArray(annotations))throw Error('Annotations must be an array');
}
const locations=annotations.map((entry,i)=>{
  const {term,place,city,kind,sourceUrl,oldPage,oldAt,confidence}=entry;
  if(!['direct','prototype','city-context'].includes(kind))throw Error('Invalid kind at annotation '+i);
  if(!term||!place||!city)throw Error('Missing place fields at annotation '+i);
  if(kind==='prototype'&&!sourceUrl)throw Error('Prototype needs evidence URL at annotation '+i);
  const absolute=originalToAbsolute(oldPage,oldAt);
  if(original.slice(absolute,absolute+term.length)!==term)throw Error('Text mismatch at annotation '+i);
  const mapped=absoluteToNew(absolute);
  return {...entry,confidence:confidence||'pending-review',absolute,page:mapped.page,at:mapped.at,mapEligible:kind!=='city-context'&&Number.isFinite(entry.lat)&&Number.isFinite(entry.lon)};
});
const result={schemaVersion:1,id,source:{file:'library/'+id+'.json.gz',sha256:hash(original),originalPageCount:oldPages.length},policy:{preserveOriginal:true,clickToTurn:true,locationKinds:['direct','prototype','city-context'],aiReviewed:false},pages,locations,qa:{characterCount:original.length,newPageCount:pages.length,identicalText:true,unverifiedPlaces:locations.filter(x=>x.confidence==='pending-review').length}};
const out=resolve(root,'research/generated',id+'.json');
await mkdir(dirname(out),{recursive:true});
await writeFile(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({id,oldPages:oldPages.length,newPages:pages.length,locations:locations.length,output:out,sha256:hash(original)},null,2));
