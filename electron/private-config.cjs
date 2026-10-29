// Private defaults are extracted on the user's PC, never bundled or published.
const fs=require('node:fs'),path=require('node:path');
function loadPrivateConfig(profile){
 try{return JSON.parse(fs.readFileSync(path.join(profile,'private-config.json'),'utf8'));}
 catch(error){if(error.code==='ENOENT')return {};throw Error('No se pudo leer la configuración privada. Se conservó intacta: '+error.message);}
}
function captureLegacyConfig(root,profile,{mainFile=path.join(root,'electron/main.cjs')}={}){
 const current=loadPrivateConfig(profile),emails={},urls={},labels={};
 const file=mainFile;let text='';try{text=fs.readFileSync(file,'utf8');}catch{}
 const literal=text.match(/const gmailAccounts = (\{[\s\S]*?\});/);
 if(literal)for(const m of literal[1].matchAll(/['"](gmail-[^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g))emails[m[1]]=m[2];
 for(const key of ['ia-nico','microinfluencers','facebook','linkedin']){
  const safe=key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const m=text.match(new RegExp("(?:['\"]"+safe+"['\"]|\\b"+safe+")\\s*:\\s*['\"](https?:[^'\"]+)['\"]"));if(m)urls[key]=m[1];
 }
 let kanbanSeed=current.kanbanSeed;
 if(!kanbanSeed){try{const data=JSON.parse(fs.readFileSync(path.join(root,'src/kanban-seed.json'),'utf8'));if(Array.isArray(data.cards))kanbanSeed=data;}catch{}}
 try{const source=fs.readFileSync(path.join(root,'src/main.jsx'),'utf8');
  for(const m of source.matchAll(/\{\s*id:\s*['"]([^'"]+)['"][^}]*?\b(?:short|name):\s*['"]([^'"]+)['"]/g))labels[m[1]]=m[2];
 }catch{}
 const initialTopics=[...(current.initialTopics||[])];
 try{const source=fs.readFileSync(path.join(root,'src/kanban-rules.mjs'),'utf8');for(const match of source.matchAll(/addTopic\(next,\s*['"]([^'"]+)['"],\s*['"](Trabajo|Personal|Esports|Sistema)['"]\)/g))if(!initialTopics.some(t=>t.name===match[1]))initialTopics.push({name:match[1],group:match[2]});}catch{}
 return {...current,labels:{...labels,...current.labels},emails:{...emails,...current.emails},urls:{...urls,...current.urls},...(kanbanSeed?{kanbanSeed}:{}),initialTopics};
}
module.exports={loadPrivateConfig,captureLegacyConfig};
