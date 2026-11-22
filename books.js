// SHOE 书库重建：只有通过新流程审核并正式发布的作品才会进入这里。
// 旧书籍、旧正文和旧地点索引不再加载。
export const books=[];
export const allBooks=books;
export const anchors=[];
export const pagesOrigin='https://zzx20040118-a11y.github.io';
export const cloudOrigin='https://wenxue-jingwei.vividchutney33.chatgpt.site';
export async function loadBook(book){
  if(!book)throw Error('Book not found');
  if(!Array.isArray(book.pages))throw Error('Book text is unavailable');
}
