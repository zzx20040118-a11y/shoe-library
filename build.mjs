import {readFile, mkdir, writeFile, copyFile} from 'node:fs/promises';

const files = {
  '/':['index.html','text/html;charset=utf-8'],
  '/style.css':['style.css','text/css;charset=utf-8'],
  '/app.js':['app.js','text/javascript;charset=utf-8'],
  '/books.js':['books.js','text/javascript;charset=utf-8'],
  '/hero.jpg':['hero.jpg','image/jpeg']
};
const assets = await Promise.all(Object.entries(files).map(async ([route,[path,type]]) => [
  route, {data: (await readFile(path)).toString(type === 'image/jpeg' ? 'base64' : 'utf8'),type}
]));
const source = await readFile('worker.mjs','utf8');
await mkdir('dist/server',{recursive:true});
await mkdir('dist/.openai',{recursive:true});
await copyFile('.openai/hosting.json','dist/.openai/hosting.json');
await writeFile('dist/server/index.js', 'const assets = ' + JSON.stringify(Object.fromEntries(assets)) + ';\n' + source);
