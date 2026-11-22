// SHOE pilot: a newly imported public-domain edition. Old catalog and indices are not loaded.
const sherlock={id:'pg1661',title:'福尔摩斯探案集',author:'Arthur Conan Doyle',en:'THE ADVENTURES OF SHERLOCK HOLMES',edition:'Project Gutenberg · 英文原版 · 测试版',col:'blue',art:'window',pages:['正在加载正文…'],count:1,anchors:[],place:'',city:'',featured:0,source:'https://www.gutenberg.org/ebooks/1661',pilot:true};
export const books=[sherlock];
export const allBooks=books;
export const anchors=[];
export const pagesOrigin='https://zzx20040118-a11y.github.io';
export const cloudOrigin='https://wenxue-jingwei.vividchutney33.chatgpt.site';
let pending;
export async function loadBook(book){
 if(!book?.pilot||book.loaded)return;
 if(!pending)pending=(async()=>{
  const response=await fetch('/books/pg1661.json');
  if(!response.ok)throw Error('测试正文未部署：HTTP '+response.status);
  const data=await response.json();
  if(!Array.isArray(data.pages)||!data.pages.length||!data.pages.every(x=>typeof x==='string'))throw Error('测试正文格式错误');
  book.pages=data.pages;
  book.blocks=data.blocks||null;
  book.count=data.pages.length;
  book.anchors=(data.locations||[]).filter(x=>x.mapEligible&&x.reviewStatus==='approved').map((x,i)=>({...x,id:'pg1661-'+i,bookId:'pg1661',region:'欧洲',keywords:x.city}));
  anchors.splice(0,anchors.length,...book.anchors);
  book.loaded=true;
 })().finally(()=>pending=null);
 await pending;
}
