import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('public',{recursive:true});
for(const file of ['index.html','app.js','books.js','catalog.js','legacy.js','fusheng.js','hero.jpg','paris.jpg','style.css']){
  await copyFile(file,'public/'+file);
}

