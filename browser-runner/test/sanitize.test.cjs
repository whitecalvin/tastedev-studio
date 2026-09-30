const test=require('node:test'),assert=require('node:assert/strict');
const {sanitizer}=require('../sanitize.cjs');
test('Evidence masks authorization, token, password, URL/query and known environment values',()=>{
 const clean=sanitizer(['dummy-private-value']);const output=JSON.stringify(clean({message:'authorization: Bearer abc password=hunter token=xyz dummy-private-value https://user:pass@localhost:3000/api?token=query#hash',headers:{authorization:'private'},body:'private',secret:'value'}));
 for(const forbidden of ['hunter','xyz','dummy-private-value','user:pass','query','private"'])assert(!output.includes(forbidden),output);assert(output.includes('redacted'));
});

test('Trace query values and header/cookie arrays are removed without corrupting numeric sizes',()=>{const clean=sanitizer([]);const value=clean({queryString:[{name:'password',value:'dummy-password'}],headers:[{name:'authorization',value:'Bearer dummy'}],cookies:[{name:'session',value:'dummy'}],bodySize:123});assert.deepEqual(value,{queryString:[],headers:[],cookies:[],bodySize:123});});
