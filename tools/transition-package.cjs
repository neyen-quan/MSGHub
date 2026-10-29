const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const engine=require(fs.existsSync(path.join(__dirname,'engine.cjs'))?path.join(__dirname,'engine.cjs'):path.join(process.env.MSGHUB_SOURCE_ROOT||path.join(__dirname,'..'),'electron/desktop-update.cjs'));
function validate(buffer,from,to){const files=engine.unzip(buffer),m=JSON.parse(files.get('msghub-patch.json'));if(m.appId!=='agency.neyen.msghub'||m.format!==1||!m.fromVersions.includes(from)||m.version!==to)throw Error('Transición de otra identidad o versión.');for(const f of m.files){if(!/^(electron\/transition\/|electron\/main.cjs$|package.json$)/.test(f.path))throw Error('Ruta de transición no permitida');const b=files.get(f.path);if(!b||b.length!==f.size||engine.sha(b)!==f.sha256)throw Error('Transición dañada');}if(files.size!==m.files.length+1)throw Error('Archivos extra en transición');return m;}
function build(out,releaseDir,repo,version){
 const root=process.env.MSGHUB_SOURCE_ROOT||path.resolve(__dirname,'..'),script=path.join(__dirname,'transition-package.py');
 const fromVersions=['1.6.0','1.6.1'],name='MSGHub-'+version+'-transition.zip',file=path.join(releaseDir,name);
 execFileSync(process.env.PYTHON||'python',[script,out,file,fromVersions.join(','),version],{stdio:'inherit'});
 const bytes=fs.readFileSync(file);return fromVersions.map(from=>{validate(bytes,from,version);return {from,to:version,url:'https://github.com/'+repo+'/releases/download/v'+version+'/'+name,size:bytes.length,sha256:engine.sha(bytes)};});
}
module.exports={build,validate};
