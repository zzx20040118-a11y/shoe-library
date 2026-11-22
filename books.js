// SHOE pilot: a newly imported public-domain edition. Old catalog and indices are not loaded.
const sherlock={id:'pg1661',title:'福尔摩斯探案集',author:'Arthur Conan Doyle',en:'THE ADVENTURES OF SHERLOCK HOLMES',edition:'Project Gutenberg · 英文原版 · 测试版',col:'blue',art:'window',pages:['正在加载正文…'],count:1,anchors:[],place:'',city:'',featured:0,source:'https://www.gutenberg.org/ebooks/1661',pilot:true};
const dickens=[
 {id:'pg730',title:'雾都孤儿',author:'Charles Dickens',en:'OLIVER TWIST',edition:'Project Gutenberg · 英文原版',col:'brown',art:'window',pages:['正在加载正文…'],count:1,anchors:[],pilot:true,source:'https://www.gutenberg.org/ebooks/730'},
 {id:'pg46',title:'圣诞颂歌',author:'Charles Dickens',en:'A CHRISTMAS CAROL',edition:'Project Gutenberg · 英文原版',col:'green',art:'window',pages:['正在加载正文…'],count:1,anchors:[],pilot:true,source:'https://www.gutenberg.org/ebooks/46'},
 {id:'pg98',title:'双城记',author:'Charles Dickens',en:'A TALE OF TWO CITIES',edition:'Project Gutenberg · 英文原版',col:'brown',art:'window',pages:['正在加载正文…'],count:1,anchors:[],pilot:true,source:'https://www.gutenberg.org/ebooks/98'},
 {id:'pg174',title:'道林·格雷的画像',author:'Oscar Wilde',en:'THE PICTURE OF DORIAN GRAY',edition:'Project Gutenberg · 英文原版',col:'green',art:'window',pages:['正在加载正文…'],count:1,anchors:[],pilot:true,source:'https://www.gutenberg.org/ebooks/174'},
 {id:'pg43',title:'化身博士',author:'Robert Louis Stevenson',en:'DR. JEKYLL AND MR. HYDE',edition:'Project Gutenberg · 英文原版',col:'blue',art:'window',pages:['正在加载正文…'],count:1,anchors:[],pilot:true,source:'https://www.gutenberg.org/ebooks/43'}
];
const londonClassics=[
 {id:'pg1023',title:'荒凉山庄',author:'Charles Dickens',en:'BLEAK HOUSE',edition:'Project Gutenberg · 英文原版',col:'green',art:'window',pages:['正在加载正文…'],count:1,anchors:[],pilot:true,source:'https://www.gutenberg.org/ebooks/1023'},
 {id:'pg963',title:'小杜丽',author:'Charles Dickens',en:'LITTLE DORRIT',edition:'Project Gutenberg · 英文原版',col:'brown',art:'window',pages:['正在加载正文…'],count:1,anchors:[],pilot:true,source:'https://www.gutenberg.org/ebooks/963'},
 {id:'pg883',title:'我们共同的朋友',author:'Charles Dickens',en:'OUR MUTUAL FRIEND',edition:'Project Gutenberg · 英文原版',col:'blue',art:'window',pages:['正在加载正文…'],count:1,anchors:[],pilot:true,source:'https://www.gutenberg.org/ebooks/883'},
 {id:'pg700',title:'老古玩店',author:'Charles Dickens',en:'THE OLD CURIOSITY SHOP',edition:'Project Gutenberg · 英文原版',col:'brown',art:'window',pages:['正在加载正文…'],count:1,anchors:[],pilot:true,source:'https://www.gutenberg.org/ebooks/700'}
];
const chineseClassics=[
 {id:'zh-chaohua',title:'朝花夕拾',author:'鲁迅',en:'DAWN BLOSSOMS PLUCKED AT DUSK',edition:'维基文库 · 中文原著 · 公有领域',lang:'中文',col:'green',art:'window',pages:['正在加载正文…'],count:1,anchors:[],pilot:true,source:'https://zh.wikisource.org/wiki/朝花夕拾'},
 {id:'zh-chunfeng',title:'春风沉醉的晚上',author:'郁达夫',en:'A NIGHT OF INTOXICATING SPRING BREEZE',edition:'维基文库 · 中文原著 · 公有领域',lang:'中文',col:'brown',art:'window',pages:['正在加载正文…'],count:1,anchors:[],pilot:true,source:'https://zh.wikisource.org/wiki/春風沉醉的晚上'},
 {id:'zh-qinhuai',title:'桨声灯影里的秦淮河',author:'朱自清',en:'QINHUAI RIVER',edition:'维基文库 · 中文原著 · 公有领域',lang:'中文',col:'blue',art:'window',pages:['正在加载正文…'],count:1,anchors:[],pilot:true,source:'https://zh.wikisource.org/wiki/槳聲燈影裏的秦淮河'}
];
export const books=[...chineseClassics,sherlock,...dickens,...londonClassics];
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
