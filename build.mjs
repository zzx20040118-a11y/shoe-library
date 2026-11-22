import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['scripts/pilot-sherlock.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['scripts/import-london.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['scripts/import-more-london.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['scripts/import-chinese.mjs'],{stdio:'inherit'});
import {readFile, mkdir, writeFile, copyFile} from 'node:fs/promises';

import {allBooks,anchors} from './books.js';

const files = {
  '/books/pg1661.json':['public/books/pg1661.json','application/json;charset=utf-8'],
  '/books/pg730.json':['public/books/pg730.json','application/json;charset=utf-8'],
  '/books/pg46.json':['public/books/pg46.json','application/json;charset=utf-8'],
  '/books/pg98.json':['public/books/pg98.json','application/json;charset=utf-8'],
  '/books/pg174.json':['public/books/pg174.json','application/json;charset=utf-8'],
  '/books/pg1023.json':['public/books/pg1023.json','application/json;charset=utf-8'],
  '/books/pg963.json':['public/books/pg963.json','application/json;charset=utf-8'],
  '/books/pg883.json':['public/books/pg883.json','application/json;charset=utf-8'],
  '/books/pg700.json':['public/books/pg700.json','application/json;charset=utf-8'],
  '/books/zh-chaohua.json':['public/books/zh-chaohua.json','application/json;charset=utf-8'],
  '/books/zh-chunfeng.json':['public/books/zh-chunfeng.json','application/json;charset=utf-8'],
  '/books/zh-qinhuai.json':['public/books/zh-qinhuai.json','application/json;charset=utf-8'],
  '/books/pg43.json':['public/books/pg43.json','application/json;charset=utf-8'],
  '/':['index.html','text/html;charset=utf-8'],
  '/style.css':['style.css','text/css;charset=utf-8'],
  '/app.js':['app.js','text/javascript;charset=utf-8'],
  '/books.js':['books.js','text/javascript;charset=utf-8'],
  '/account-data.js':['account-data.js','text/javascript;charset=utf-8'],
  '/account-ui.js':['account-ui.js','text/javascript;charset=utf-8'],
  '/landscape.js':['landscape.js','text/javascript;charset=utf-8'],
  '/vendor/supabase-2.49.8.js':['vendor/supabase-2.49.8.js','text/javascript;charset=utf-8'],
  '/vendor/SUPABASE-LICENSE':['vendor/SUPABASE-LICENSE','text/plain;charset=utf-8']
};
const assets = await Promise.all(Object.entries(files).map(async ([route,[path,type]]) => [
  route, {data: (await readFile(path)).toString(type === 'image/jpeg' ? 'base64' : 'utf8'),type}
]));
const source = await readFile('worker.mjs','utf8');
await mkdir('dist/server',{recursive:true});
await mkdir('dist/.openai',{recursive:true});
await copyFile('.openai/hosting.json','dist/.openai/hosting.json');
await writeFile('dist/server/index.js', 'const pageCounts = '+JSON.stringify(Object.fromEntries(allBooks.map(b=>[b.id,b.pages.length])))+';\nconst anchorPages = '+JSON.stringify(Object.fromEntries(anchors.map(a=>[a.id,[a.bookId,a.page]])))+';\nconst assets = ' + JSON.stringify(Object.fromEntries(assets)) + ';\n' + source);
