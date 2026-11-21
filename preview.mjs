import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import worker from './dist/server/index.js';

const host = '127.0.0.1';
const port = Number(process.env.ATLAS_PREVIEW_PORT || 4173);
const server = createServer(async (incoming,outgoing) => {
  const url = new URL(incoming.url,`http://${host}:${port}`);
  if (url.pathname === '/signin-with-chatgpt' || url.pathname === '/signout-with-chatgpt') {
    outgoing.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});
    outgoing.end('<!doctype html><html lang="zh-Hans"><meta charset="utf-8"><title>本地预览</title><main style="margin:4rem;font-family:system-ui"><h1>本地预览</h1><p>账号登录和跨设备同步由 Sites 提供。本地预览使用此浏览器的访客书架。</p><a href="/">返回SHOE/书</a></main></html>');
    return;
  }
  const method = incoming.method;
  const request = new Request(url,{method});
  const response = await worker.fetch(request,{});
  outgoing.writeHead(response.status,Object.fromEntries(response.headers));
  if (response.body) Readable.fromWeb(response.body).pipe(outgoing);
  else outgoing.end();
});
server.listen(port,host,() => console.log(`SHOE/书预览 http://${host}:${port}`));
