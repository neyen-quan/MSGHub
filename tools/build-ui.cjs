const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(process.env.MSGHUB_SOURCE_ROOT||path.join(__dirname,'..'));
require(require.resolve('esbuild',{paths:[root]})).buildSync({entryPoints:[path.join(root,'src/main.jsx')],bundle:true,minify:true,outdir:path.join(root,'dist/assets'),define:{'process.env.NODE_ENV':'"production"'},target:'chrome148',legalComments:'eof'});
fs.copyFileSync(path.join(root,'index.html'),path.join(root,'dist/index.html'));
fs.copyFileSync(path.join(root,'assets/msghub.png'),path.join(root,'dist/msghub.png'));
fs.copyFileSync(path.join(root,'assets/msghub.svg'),path.join(root,'dist/assets/msghub.svg'));


fs.copyFileSync(path.join(root,'assets/msghub.ico'),path.join(root,'assets/msghub-taskbar.ico'));
