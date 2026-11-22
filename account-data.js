const client=window.supabase.createClient('https://lpthebrmpazqclutxfpa.supabase.co','sb_publishable_qacbuxGD9H0VQ8bTO2iBqw_mvfPpqUn',{auth:{flowType:'pkce',storageKey:'shoe-auth-v1'}});
function checked(result){if(result.error) throw result.error;return result.data}
export async function sessionUser(){const {data,error}=await client.auth.getSession();if(error)throw error;return data.session?.user || null}
export function watchSession(id){client.auth.onAuthStateChange((event,session)=>{if(event!=='INITIAL_SESSION' && (session?.user.id||null)!==id)setTimeout(()=>location.reload(),0)})}
export async function emailLink(email){checked(await client.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+'/',shouldCreateUser:true}}))}
// Enable only after the owner has configured and approved an SMS provider.
export const phoneLoginEnabled=false;
export async function requestSms(phone){
  if(!phoneLoginEnabled)throw Error('短信登录尚未开放');
  checked(await client.auth.signInWithOtp({phone}));
}
export async function confirmSms(phone,token){
  if(!phoneLoginEnabled)throw Error('短信登录尚未开放');
  checked(await client.auth.verifyOtp({phone,token,type:'sms'}));
}
export async function signout(){checked(await client.auth.signOut({scope:'local'}))}
export async function profile(uid){return checked(await client.from('profiles').select('display_name,save_history').eq('user_id',uid).maybeSingle()) || {display_name:'',save_history:true}}
export async function updateProfile(uid,patch){checked(await client.from('profiles').upsert({user_id:uid,...patch},{onConflict:'user_id',defaultToNull:false}))}
async function readRows(table,uid,order){
  const rows=[];
  for(let at=0;;at+=100){const batch=checked(await client.from(table).select('*').eq('user_id',uid).order(order).range(at,at+99));rows.push(...batch);if(batch.length<100)return rows}
}
export async function cloudRecords(uid){
  const [shelf,progress,excerpts,journal]=await Promise.all([['user_books','book_id'],['reading_progress','book_id'],['saved_excerpts','id'],['journal_entries','id']].map(([t,k])=>readRows(t,uid,k)));
  const records={};
  for(const r of shelf)records['book:'+r.book_id]={shelf:r.shelf,discovery:r.discovery,page:0,updated:0};
  for(const r of progress){const key='book:'+r.book_id;records[key]={...records[key],page:r.page,updated:r.updated}}
  for(const r of [...excerpts,...journal])records['craft:'+r.id]={...r.data,book:r.book_id,shared:false};
  return records;
}
export async function persist(uid,key,value,membership,importing=false){
  if(key.startsWith('book:')){
    if((await sessionUser())?.id!==uid)throw Error('账号已变更');
    checked(await client.rpc('shoe_save_book',{book:key.slice(5),pos:value.page,stamp:value.updated,membership:membership??null,origin_text:value.discovery||'',importing}));return;
  }
  if(!/^craft:[0-9a-f-]{36}$/i.test(key))throw Error('无效记录');
  const table=value.type==='quote'?'saved_excerpts':'journal_entries';
  checked(await client.from(table).upsert({user_id:uid,id:key.slice(6),book_id:value.book,data:{...value,shared:false}},{onConflict:'user_id,id',ignoreDuplicates:importing}));
}
export async function logSearch(q){if(q)checked(await client.rpc('shoe_search',{q:q.slice(0,80)}))}
export async function history(uid){return checked(await client.from('search_history').select('term').eq('user_id',uid).order('searched_at',{ascending:false}).limit(100))}
export async function clearHistory(uid){checked(await client.from('search_history').delete().eq('user_id',uid))}

export async function isPlaceAdmin(){
 const {data,error}=await client.auth.getUser();
 if(error||!data.user)return false;
 return data.user.app_metadata?.shoe_role==='admin';
}
export async function listPlaceReviews(bookId){
 return checked(await client.from('place_reviews').select('*').eq('book_id',bookId).order('page').limit(10000));
}
export async function savePlaceReview(payload){
 if(!await isPlaceAdmin())throw Error('管理员身份已失效，请重新登录');
 return checked(await client.from('place_reviews').upsert(payload,{onConflict:'book_id,page,at_offset,term'}).select().single());
}

export async function approvedPlaceReviews(bookId){
 return checked(await client.from('place_reviews').select('id,book_id,term,page,at_offset,place_name,city,lat,lon,relation_type').eq('book_id',bookId).eq('decision','approved').limit(10000));
}
