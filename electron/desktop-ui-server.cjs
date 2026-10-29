// Preserve the original renderer origin and all its localStorage, including the Kanban.
// The release serves its built files itself: no Vite, npm, CMD or additional process.
const http=require('node:http');const fs=require('node:fs');const path=require('node:path');
const UI_ORIGIN='http://127.0.0.1:5174';
function startDesktopUi({root,port=5174}={}){
 const dist=path.resolve(root,'dist');
 if(!fs.existsSync(path.join(dist,'index.html')))return Promise.reject(Error('Falta dist/index.html. Extraé la transición en la carpeta del programa.'));
 const server=http.createServer((req,res)=>{
  const fail=code=>{res.writeHead(code,{'Cache-Control':'no-store'});res.end();};
  if(!['GET','HEAD'].includes(req.method))return fail(405);
  if(req.headers.host!==`127.0.0.1:${server.address().port}`)return fail(403);
  let relative;
  try{relative=decodeURIComponent(String(req.url).split('?')[0]);}catch{return fail(400);}
  if(relative==='/'||relative==='/index.html')relative='/index.html';
  else if(!relative.startsWith('/assets/'))return fail(404);
  if(relative.includes('\\')||relative.includes('\0')||relative.split('/').some(p=>p==='..'||p==='.'))return fail(403);
  const file=path.resolve(dist,'.'+relative);
  if(!file.startsWith(dist+path.sep))return fail(403);
  try{
   if(!fs.statSync(file).isFile())return fail(404);
   const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream';
   res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
   if(req.method==='HEAD')return res.end();
   const stream=fs.createReadStream(file);stream.on('error',()=>res.destroy());stream.pipe(res);
  }catch{return fail(404);}
 });
 return new Promise((resolve,reject)=>{
  server.once('error',error=>{server.close();reject(error.code==='EADDRINUSE'?Error('El puerto de MSG Hub sigue ocupado. Cerrá el MSG Hub anterior y su consola antes de abrir MSGHub.exe. No se cambió tu perfil.'):error);});
  server.listen(port,'127.0.0.1',()=>resolve({server,url:`http://127.0.0.1:${server.address().port}`,close:()=>server.close()}));
 });
}
module.exports={startDesktopUi,UI_ORIGIN};
