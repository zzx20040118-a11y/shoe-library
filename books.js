// SHOE pilot: a newly imported public-domain edition. Old catalog and indices are not loaded.
const sherlock={id:'pg1661',title:'福尔摩斯探案集',author:'Arthur Conan Doyle',en:'THE ADVENTURES OF SHERLOCK HOLMES',edition:'Project Gutenberg · 英文原版 · 测试版',col:'blue',art:'window',pages:['正在加载正文…'],count:1,anchors:[],place:'',city:'',featured:0,source:'https://www.gutenberg.org/ebooks/1661',pilot:true};
const dickens=[
 {id:'pg730',title:'雾都孤儿',author:'Charles Dickens',en:'OLIVER TWIST',edition:'Project Gutenberg · 英文原版',col:'brown',art:'window',pages:['正在加载正文…'],count:1,anchors:[],pilot:true,source:'https://www.gutenberg.org/ebooks/730'},
 {id:'pg46',title:'圣诞颂歌',author:'Charles Dickens',en:'A CHRISTMAS CAROL',edition:'Project Gutenberg · 英文原版',col:'green',art:'window',pages:['正在加载正文…'],count:1,anchors:[],pilot:true,source:'https://www.gutenberg.org/ebooks/46'}
];
export const books=[sherlock,...dickens];
export const allBooks=books;
export const anchors=[];
export const pagesOrigin='https://zzx20040118-a11y.github.io';
export const cloudOrigin='https://wenxue-jingwei.vividchutney33.chatgpt.site';
const pending=new Map();
export async function loadBook(book){
 if(!book?.pilot||book.loaded)return;
 if(!pending.has(book.id))pending.set(book.id,(async()=>{
  const response=await fetch('/books/'+book.id+'.json');
  if(!response.ok)throw Error('测试正文未部署：HTTP '+response.status);
  const data=await response.json();
  if(!Array.isArray(data.pages)||!data.pages.length||!data.pages.every(x=>typeof x==='string'))throw Error('测试正文格式错误');
  book.pages=data.pages;
  book.blocks=data.blocks||null;
  book.count=data.pages.length;
  book.anchors=(data.locations||[]).filter(x=>x.mapEligible&&x.reviewStatus==='approved').map((x,i)=>({...x,id:book.id+'-'+i,bookId:book.id,region:'欧洲',keywords:x.city}));
  anchors.splice(0,anchors.length,...books.flatMap(b=>b.anchors||[]));
  book.loaded=true;
 })().finally(()=>pending.delete(book.id)));
 await pending.get(book.id);
}
