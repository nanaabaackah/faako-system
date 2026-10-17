// Serve only generated static output for isolated local QA; not a deployment server.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(process.argv[2]||'apps/ttngh/dist');
if(!fs.existsSync(path.join(root,'index.html')))throw Error('Build output required');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.otf':'font/otf','.json':'application/json','.ics':'text/calendar'};
const server=http.createServer((req,res)=>{
 try {
  let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end();}
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  if(!fs.existsSync(file)){
   file=path.join(root,'404.html');
   res.statusCode=404;
   if(!fs.existsSync(file))return res.end('Not found');
  }
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
  fs.createReadStream(file).pipe(res);
 }catch{res.writeHead(400);res.end();}
});
server.listen(Number(process.argv[3]||4177),'127.0.0.1',()=>console.log('Local static QA ready'));
