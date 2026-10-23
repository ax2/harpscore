import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.json':'application/json; charset=utf-8', '.ico':'image/x-icon' };
export function createStaticServer(directory) {
  const root = path.resolve(directory);
  return createServer(async (request,response) => {
    if (!['GET','HEAD'].includes(request.method)) {
      response.writeHead(405,{Allow:'GET, HEAD'}).end();
      return;
    }
    try {
      const requested = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
      const relative = requested === '/' ? 'index.html' : requested.slice(1);
      const target = path.resolve(root,relative);
      if (relative.includes('\\') || relative.includes('\0') || !target.startsWith(root+path.sep)) {
        response.writeHead(403).end();
        return;
      }
      const content = await readFile(target);
      response.writeHead(200,{'Content-Type':mime[path.extname(target)]??'application/octet-stream','Content-Length':content.length,'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch (error) {
      response.writeHead(error instanceof URIError ? 400 : 404).end();
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4178);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535');
  const server = createStaticServer(path.join(path.dirname(fileURLToPath(import.meta.url)),'dist'));
  server.on('error',error => { console.error(error.message); process.exitCode=1; });
  server.listen(port,'127.0.0.1',()=>console.log(`HarpScore: http://127.0.0.1:${port}\nPress Ctrl+C to stop.`));
}
