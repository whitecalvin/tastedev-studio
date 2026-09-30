const {chromium}=require('@playwright/test');
(async()=>{const browser=await chromium.launch({headless:true,timeout:4000});try{console.log(JSON.stringify({playwright:require('@playwright/test/package.json').version,chromium:browser.version()}));}finally{await browser.close();}})().catch(()=>{process.exitCode=1;});
