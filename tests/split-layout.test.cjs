const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../electron/main.cjs'), 'utf8');
const geometry = source.slice(source.indexOf('function globalSplitCellRects('), source.indexOf('function fitMobilePreview('));
const ratioCode = source.slice(source.indexOf('function applySplitRatios('), source.indexOf("ipcMain.on('splitter-pointer'"));
function context(ids) {
 const c = vm.createContext({ contentTop:100, currentSplitRatio:50, currentSplitRatio2:70, currentAiRatios:{x:50,x2:70,y:50}, currentSplitIds:ids, sites:Object.fromEntries(ids.map(id=>[id,{}])), resizeCurrentSplitViews(){}, publishSplitRatios(){} });
 vm.runInContext(geometry + ratioCode, c); return c;
}
test('two messaging panes resize in both directions and fill the window',()=>{
 const c=context(['wa-personal','telegram']);
 for(const x of [25,37,65,75]) {
  c.applySplitRatios({x});
  const r=c.globalSplitCellRects(c.currentSplitIds,{width:1200,height:900});
  assert.equal(r[0].width,Math.floor(1195*x/100));
  assert.equal(r[1].x,r[0].width+5);
  assert.equal(r[1].x+r[1].width,1200);
 }
});
test('three panes have two independent dividers with bounded widths',()=>{
 const c=context(['wa-personal','telegram','telegram-2']);
 c.applySplitRatios({x:30,x2:78});
 const r=c.globalSplitCellRects(c.currentSplitIds,{width:1200,height:900});
 assert.equal(r[0].width,357); assert.equal(r[1].width,571);
 assert.equal(r[2].x+r[2].width,1200);
 c.applySplitRatios({x:99,x2:0});
 assert.ok(c.currentSplitRatio2-c.currentSplitRatio>=18);
});
test('four-pane vertical resize remains finite',()=>{
 const c=context(['a','b','c','d']); c.applySplitRatios({y:70});
 const r=c.globalSplitCellRects(c.currentSplitIds,{width:1200,height:900});
 assert.equal(c.currentAiRatios.y,70);assert.equal(r[2].y,r[0].y+r[0].height+5);
 assert.equal(r[2].y+r[2].height,875);
});
