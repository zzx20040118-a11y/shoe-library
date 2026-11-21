const recordKey = /^(book:(tide|snow|moon|lamp|rain|harbor)|craft:[a-f0-9-]{36})$/;
const photoRoute = /^\/api\/photo\/([a-f0-9-]{36})$/;
const privateHeaders = {'Cache-Control':'private, no-store'};

function json(value, status = 200) {
  return Response.json(value,{status,headers:privateHeaders});
}

function identity(request) {
  const id = request.headers.get('oai-authenticated-user-id');
  if (!id) return null;
  let name = request.headers.get('oai-authenticated-user-full-name');
  if (name && request.headers.get('oai-authenticated-user-full-name-encoding') === 'percent-encoded-utf-8') {
    try { name = decodeURIComponent(name); }
    catch { name = null; }
  }
  return {id,name:name || request.headers.get('oai-authenticated-user-email') || '已登录'};
}

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  return origin === new URL(request.url).origin;
}

function validRecord(key,value) {
  if (!recordKey.test(key) || !value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (!Number.isInteger(value.page) || value.page < 0 || value.page > 2 || !Number.isFinite(value.updated)) return false;
  if (key.startsWith('book:')) return typeof value.shelf === 'boolean' && typeof value.discovery === 'string' && value.discovery.length <= 100;
  if (!recordKey.test('book:'+value.book) || !['bookmark','quote'].includes(value.type)) return false;
  if (!['paper','green','rose','night'].includes(value.theme) || !['serif','sans','mono'].includes(value.font)) return false;
  if (typeof value.title !== 'string' || value.title.length > 70 || typeof value.memo !== 'string' || value.memo.length > 1500) return false;
  if (!Array.isArray(value.stickers) || value.stickers.length > 8 || !value.stickers.every(item => typeof item === 'string' && item.length <= 4)) return false;
  if (value.photo !== '' && (typeof value.photo !== 'string' || !photoRoute.test(value.photo))) return false;
  if (value.type === 'bookmark') return value.quote == null && value.range == null;
  const {quote,range} = value;
  return typeof quote === 'string' && quote.length <= 1000 && Array.isArray(range) && range.length === 2 &&
    range.every(Number.isInteger) && range[0] >= 0 && range[1] > range[0] && range[1] <= 1000;
}

async function records(request, env, user) {
  if (request.method === 'GET') {
    if (!user) return json({user:null,records:{}});
    const {results} = await env.DB.prepare('SELECT record_key, value FROM atlas_records WHERE user_id = ?').bind(user.id).all();
    return json({user:{name:user.name},records:Object.fromEntries(results.map(row => [row.record_key,JSON.parse(row.value)]))});
  }
  if (request.method !== 'PUT') return json({error:'method'},405);
  if (!user || !sameOrigin(request)) return json({error:'access'},403);
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({error:'type'},415);
  const body = await request.text();
  if (body.length > 16000) return json({error:'size'},413);
  let record;
  try { record = JSON.parse(body); }
  catch { return json({error:'invalid'},400); }
  if (!record || typeof record.key !== 'string' || !validRecord(record.key,record.value)) return json({error:'invalid'},400);
  await env.DB.prepare(
    'INSERT INTO atlas_records (user_id, record_key, value) VALUES (?, ?, ?) ON CONFLICT (user_id, record_key) DO UPDATE SET value = excluded.value'
  ).bind(user.id,record.key,JSON.stringify(record.value)).run();
  return json({ok:true});
}

async function photo(request, env, user, id) {
  if (!user) return json({error:'access'},403);
  const key = encodeURIComponent(user.id) + '/' + id;
  if (request.method === 'GET') {
    const object = await env.BUCKET.get(key);
    if (!object) return json({error:'missing'},404);
    return new Response(object.body,{headers:{...privateHeaders,'Content-Type':'image/jpeg','X-Content-Type-Options':'nosniff'}});
  }
  if (!sameOrigin(request)) return json({error:'access'},403);
  if (request.method === 'DELETE') {
    await env.BUCKET.delete(key);
    return json({ok:true});
  }
  if (request.method !== 'PUT') return json({error:'method'},405);
  if (request.headers.get('Content-Type') !== 'image/jpeg') return json({error:'type'},415);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length > 1_500_000) return json({error:'size'},413);
  if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) return json({error:'invalid'},400);
  await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:'image/jpeg'}});
  return json({ok:true});
}

export default {
  async fetch(request,env) {
    const {pathname} = new URL(request.url);
    try {
      if (pathname === '/api/records') return await records(request,env,identity(request));
      const match = photoRoute.exec(pathname);
      if (match) return await photo(request,env,identity(request),match[1]);
      const asset = Object.hasOwn(assets,pathname) ? assets[pathname] : null;
      if (!asset) return new Response('找不到页面',{status:404});
      if (!['GET','HEAD'].includes(request.method)) return new Response(null,{status:405});
      const data = asset.type === 'image/jpeg' ? Uint8Array.from(atob(asset.data),char => char.charCodeAt(0)) : asset.data;
      return new Response(request.method === 'HEAD' ? null : data,{headers:{
        'Content-Type':asset.type,'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin',
        'Cache-Control': pathname === '/hero.jpg' ? 'public, max-age=3600' : 'no-cache'
      }});
    } catch (error) {
      console.error('Atlas request failed',pathname,error?.message);
      return json({error:'storage_unavailable'},503);
    }
  }
};
