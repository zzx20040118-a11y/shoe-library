import {fushengPages} from './fusheng.js';
import {books as legacy} from './legacy.js';

export const books = [
  {id:'fusheng',title:'浮生六记',author:'沈复',edition:'清 · 存世四卷全文',en:'SIX RECORDS OF A FLOATING LIFE',col:'olive',art:'window',pages:fushengPages,source:'https://www.gutenberg.org/ebooks/25192',
   sites:[
    ['滄浪亭','沧浪亭','苏州','华东',31.2902,120.6240,'苏州园林 吴门'],
    ['虎丘','虎丘','苏州','华东',31.3381,120.5773,'虎丘山 吴门'],
    ['斷橋','断桥','杭州','华东',30.2595,120.1474,'西湖 断桥残雪 钱塘'],
    ['平山堂','平山堂','扬州','华东',32.4224,119.4086,'大明寺 广陵'],
    ['趵突泉','趵突泉','济南','华东',36.6607,117.0092,'泉城 泉水 山东'],
    ['大明湖','大明湖','济南','华东',36.6752,117.0216,'泉城 山东'],
    ['滕王閣','滕王阁','南昌','华东',28.6812,115.8812,'赣江 江西']
   ]},
  {id:'huxin',title:'湖心亭看雪',author:'张岱',edition:'明末清初 ·《陶庵梦忆》单篇全文',en:'SNOW AT THE LAKE PAVILION',col:'blue',art:'moon',source:'https://zh.wikisource.org/wiki/湖心亭看雪',
   pages:['崇祯五年十二月，余住西湖。大雪三日，湖中人鸟声俱绝。','是日更定矣，余拏一小舟，拥毳衣炉火，独往湖心亭看雪。雾凇沆砀，天与云与山与水，上下一白。湖上影子，惟长堤一痕、湖心亭一点、与余舟一芥、舟中人两三粒而已。','到亭上，有两人铺毡对坐，一童子烧酒炉正沸。见余，大喜曰：“湖中焉得更有此人！”拉余同饮。余强饮三大白而别。问其姓氏，是金陵人，客此。及下船，舟子喃喃曰：“莫说相公痴，更有痴似相公者！”'],
   sites:[['西湖','西湖','杭州','华东',30.246,120.143,'浙江 湖泊'],['湖心亭','湖心亭','杭州','华东',30.246,120.141,'西湖 雪夜'],['金陵','南京','南京','华东',32.046,118.788,'金陵 江苏 籍贯']]},
  {id:'yueyang',title:'岳阳楼记',author:'范仲淹',edition:'北宋 ·《范文正公集》单篇全文',en:'YUEYANG TOWER',col:'rust',art:'water',source:'https://zh.wikisource.org/wiki/岳陽樓記',
   pages:['庆历四年春，滕子京谪守巴陵郡。越明年，政通人和，百废具兴，乃重修岳阳楼，增其旧制，刻唐贤今人诗赋于其上，属予作文以记之。','予观夫巴陵胜状，在洞庭一湖。衔远山，吞长江，浩浩汤汤，横无际涯，朝晖夕阴，气象万千，此则岳阳楼之大观也，前人之述备矣。然则北通巫峡，南极潇湘，迁客骚人，多会于此，览物之情，得无异乎？','若夫淫雨霏霏，连月不开，阴风怒号，浊浪排空，日星隐曜，山岳潜形，商旅不行，樯倾楫摧，薄暮冥冥，虎啸猿啼。登斯楼也，则有去国怀乡，忧谗畏讥，满目萧然，感极而悲者矣。','至若春和景明，波澜不惊，上下天光，一碧万顷，沙鸥翔集，锦鳞游泳，岸芷汀兰，郁郁青青。而或长烟一空，皓月千里，浮光跃金，静影沉璧，渔歌互答，此乐何极！登斯楼也，则有心旷神怡，宠辱偕忘，把酒临风，其喜洋洋者矣。','嗟夫！予尝求古仁人之心，或异二者之为，何哉？不以物喜，不以己悲。居庙堂之高则忧其民，处江湖之远则忧其君。是进亦忧，退亦忧。然则何时而乐耶？其必曰：“先天下之忧而忧，后天下之乐而乐”乎！噫！微斯人，吾谁与归？时六年九月十五日。'],
   sites:[['岳阳楼','岳阳楼','岳阳','华中',29.3846,113.0878,'湖南 洞庭湖畔'],['巴陵','岳阳','岳阳','华中',29.377,113.091,'巴陵郡 岳州 湖南'],['洞庭','洞庭湖','岳阳','华中',29.375,113.075,'东洞庭湖 湖南 湖泊']]},
  {id:'huanghe',title:'黄鹤楼送孟浩然之广陵',author:'李白',edition:'唐 · 七言绝句全文',en:'FAREWELL AT YELLOW CRANE TOWER',col:'wine',art:'mountain',source:'https://zh.wikisource.org/wiki/黃鶴樓送孟浩然之廣陵',
   pages:['故人西辞黄鹤楼，烟花三月下扬州。\n孤帆远影碧空尽，唯见长江天际流。'],
   sites:[['黄鹤楼','黄鹤楼','武汉','华中',30.5446,114.3026,'武昌 湖北 江城 送别'],['扬州','扬州','扬州','华东',32.395,119.414,'广陵 江苏 三月']]}
];

export const allBooks = [...books,...legacy];
export const anchors = [];
for (const book of books) {
  book.anchors = [];
  for (const [term,place,city,region,lat,lon,keywords] of book.sites) {
    book.pages.forEach((text,page) => {
      for (let at=text.indexOf(term); at>=0; at=text.indexOf(term,at+term.length)) {
        const anchor = {id:book.id+'-'+page+'-'+at,bookId:book.id,page,at,term,place,city,region,lat,lon,keywords};
        book.anchors.push(anchor);
        anchors.push(anchor);
      }
    });
  }
  const first = book.anchors[0];
  Object.assign(book,{place:first.place,city:first.city,region:first.region,lat:first.lat,lon:first.lon,featured:first.page,aliases:[],tags:[]});
}
