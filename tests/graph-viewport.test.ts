import test from 'node:test';
import assert from 'node:assert/strict';
import {fitViewport} from '../src/features/orchestration/viewport.ts';
test('fit keeps large off-origin flow inside viewport with padding',()=>{
 const bounds={x:800,y:600,width:2000,height:1300},view=fitViewport(bounds,700,400)!;
 assert.ok(view.zoom<.5);
 assert.ok(bounds.x*view.zoom-view.left>=23.9);
 assert.ok((bounds.x+bounds.width)*view.zoom-view.left<=676.1);
 assert.ok(bounds.y*view.zoom-view.top>=23.9);
 assert.ok((bounds.y+bounds.height)*view.zoom-view.top<=376.1);
});
test('small graph is not magnified and input remains unchanged',()=>{
 const bounds={x:40,y:40,width:220,height:126},before=JSON.stringify(bounds);
 assert.deepEqual(fitViewport(bounds,800,600),{zoom:1,left:0,top:0});assert.equal(JSON.stringify(bounds),before);
});
test('hidden viewport and invalid content cannot update the camera',()=>{
 for(const bounds of [{x:0,y:0,width:0,height:10},{x:NaN,y:0,width:10,height:10}])assert.equal(fitViewport(bounds,800,600),null);
 assert.equal(fitViewport({x:0,y:0,width:10,height:10},0,600),null);
});
