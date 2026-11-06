// Protótipo local, vinculado à sessão assinada do Treinamentos local.
const http = require('node:http');
const crypto = require('node:crypto');
const drive = require('./drive-local.cjs');
const secret = process.env.TRAINING_SESSION_SECRET;
if (!secret) throw new Error('TRAINING_SESSION_SECRET é necessário.');
function session(req) {
  const cookie = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('mnls_training_session='));
  if (!cookie) return null;
  const parts = cookie.slice('mnls_training_session='.length).split('.');
  if (parts.length !== 2) return null;
  const signature = crypto.createHmac('sha256', secret).update(parts[0]).digest('base64url');
  if (parts[1].length !== signature.length || !crypto.timingSafeEqual(Buffer.from(parts[1]), Buffer.from(signature))) return null;
  try { const value=JSON.parse(Buffer.from(parts[0], 'base64url')); return value.exp > Date.now()/1000 ? value : null; } catch { return null; }
}
http.createServer((req,res) => {
  const user=session(req);
  if (!user) { res.writeHead(303,{Location:'http://127.0.0.1:3080/login'}); return res.end(); }
  if (user.role !== 'admin') { res.writeHead(403,{'Content-Type':'text/plain; charset=utf-8'}); return res.end('O FAQ é restrito a administradores.'); }
  const master = (process.env.FAQ_MASTER_EMAILS || '').split(',').map(x=>x.trim().toLowerCase()).includes(String(user.email || '').toLowerCase());
  const endpoint = new URL(req.url, 'http://127.0.0.1');
  if (endpoint.pathname === '/api/plantoes/permissao') { res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}); return res.end(JSON.stringify({master})); }
  if (endpoint.pathname === '/api/plantoes/edicao' && req.method !== 'GET' && !master) { res.writeHead(403,{'Content-Type':'application/json'}); return res.end(JSON.stringify({error:'Acesso exclusivo do master.'})); }
  if (endpoint.pathname === '/api/plantoes/atual') {
    if (req.method !== 'GET') { res.writeHead(405); return res.end(); }
    drive.read().then(data=>{res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))}).catch(err=>{res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:err.message,master}))});return;
  }
  if (endpoint.pathname === '/google-drive/conectar') {
    if (!master || req.method !== 'POST' || req.headers.origin !== 'http://127.0.0.1:3081') { res.writeHead(403); return res.end(); }
    try { const location=drive.begin(user); res.writeHead(303,{Location:location,'Cache-Control':'no-store'}); return res.end(); } catch(err) { res.writeHead(503,{'Content-Type':'text/plain; charset=utf-8'}); return res.end(err.message); }
  }
  if (endpoint.pathname === '/google-drive/callback') {
    if (!master || req.method !== 'GET') { res.writeHead(403); return res.end(); }
    drive.finish(user,endpoint.searchParams).then(()=>{res.writeHead(303,{Location:'/plantoes.html','Cache-Control':'no-store'});res.end()}).catch(err=>{res.writeHead(400,{'Content-Type':'text/plain; charset=utf-8'});res.end(err.message)}); return;
  }
  if (new URL(req.url, 'http://127.0.0.1').pathname === '/api/auditoria' && !master) { res.writeHead(403,{'Content-Type':'application/json'}); return res.end(JSON.stringify({error:'Histórico restrito ao master.'})); }
  const actor = user.email;
  const proof = crypto.createHmac('sha256',secret).update(actor).digest('hex');
  const headers={...req.headers,host:'127.0.0.1:5173',cookie:'__sites_local_auth=1','x-local-actor':actor,'x-local-proof':proof,'accept-encoding':'identity'};
  if (headers.origin) headers.origin='http://127.0.0.1:5173';
  const upstream=http.request({host:'127.0.0.1',port:5173,path:req.url,method:req.method,headers},r=>{
    if (!master && new URL(req.url,'http://127.0.0.1').pathname === '/faq.html' && r.statusCode === 200) {
      const chunks=[]; r.on('data',chunk=>chunks.push(chunk)); r.on('end',()=>{
        const body=Buffer.concat(chunks).toString('utf8').replace('<head>','<head><script>document.addEventListener("keydown",function(e){if(e.ctrlKey && e.key.toLowerCase()==="m"){e.preventDefault();e.stopImmediatePropagation()}},true)</script>');
        delete r.headers['content-length']; res.writeHead(r.statusCode,r.headers); res.end(body);
      });
    } else { res.writeHead(r.statusCode,r.headers);r.pipe(res); }
  });
  upstream.on('error',()=>{if(!res.headersSent)res.writeHead(503);res.end('FAQ local indisponível');});req.pipe(upstream);
}).listen(3081,'127.0.0.1',()=>console.log('FAQ local autorizado: http://127.0.0.1:3081/faq.html'));
