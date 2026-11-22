import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['scripts/pilot-sherlock.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['scripts/import-london.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['scripts/import-more-london.mjs'],{stdio:'inherit'});
import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('public',{recursive:true});
for(const file of ['index.html','app.js','books.js','account-data.js','account-ui.js','landscape.js','style.css']){
  await copyFile(file,'public/'+file);
}


await mkdir('public/vendor',{recursive:true});
for(const name of ['supabase-2.49.8.js','SUPABASE-LICENSE'])await copyFile('vendor/'+name,'public/vendor/'+name);
