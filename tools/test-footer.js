const http=require("http"),fs=require("fs"),path=require("path");const {chromium,devices}=require("playwright");
const ROOT=path.resolve(__dirname,"..");const T={".css":"text/css",".js":"text/javascript",".svg":"image/svg+xml",".json":"application/json",".html":"text/html",".woff2":"font/woff2",".webp":"image/webp",".mp4":"video/mp4"};
const srv=http.createServer((q,r)=>{let f=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,"index.html");if(!fs.existsSync(f)){r.writeHead(404);return r.end()}r.writeHead(200,{"content-type":T[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r)});
(async()=>{await new Promise(r=>srv.listen(0,r));const b=await chromium.launch();const ctx=await b.newContext({...devices["iPhone 13"]});const p=await ctx.newPage();
const base=`http://localhost:${srv.address().port}`;await p.goto(base+"/en/about/index.html");await p.waitForTimeout(800);
const st=()=>p.evaluate(()=>({y:Math.round(scrollY),max:document.documentElement.scrollHeight-innerHeight,run:document.querySelector(".sfoot-run").offsetHeight,p:+getComputedStyle(document.querySelector(".sfoot")).getPropertyValue("--p"),url:location.pathname}));
// 1. fast fling from the middle to the very end
await p.evaluate(()=>scrollTo({top:document.body.scrollHeight/2,behavior:"instant"}));await p.waitForTimeout(300);
await p.evaluate(()=>scrollTo({top:999999,behavior:"instant"}));
let peak=0;for(let i=0;i<20;i++){await p.waitForTimeout(50);const s=await st();peak=Math.max(peak,s.p);}
let s=await st();console.log("after fling: peak p",peak.toFixed(2),"now",s);
await p.waitForTimeout(800);s=await st();console.log("after rest:",s);
// 2. scroll halfway into the stretch and stop: should ease back
await p.evaluate(()=>scrollBy({top:200,behavior:"instant"}));await p.waitForTimeout(150);console.log("mid:",await st());await p.waitForTimeout(1200);console.log("eased back:",await st());
// 3. scroll to the end of the stretch: next page opens
await p.evaluate(async()=>{for(let i=0;i<30;i++){scrollBy({top:40,behavior:"instant"});await new Promise(r=>setTimeout(r,16));}}).catch(()=>{});
await p.waitForTimeout(2500);console.log("after full:",p.url());
// 4. top bar
await p.goto(base+"/en/index.html");await p.waitForTimeout(500);
console.log(await p.evaluate(()=>{const r=e=>document.querySelector(e).getBoundingClientRect();return {bar:r(".mbar").height,brand:Math.round(r(".mbar .brand").top),btn:Math.round(r(".mbar__btn").top),main:getComputedStyle(document.querySelector(".main")).paddingTop}}));
await p.click(".mbar__btn");await p.waitForTimeout(500);
console.log("menu open:",await p.evaluate(()=>{const r=e=>document.querySelector(e).getBoundingClientRect();return {brand:Math.round(r(".mmenu .brand").top),close:Math.round(r(".mmenu [data-close]").top)}}));
await b.close();srv.close()})();
