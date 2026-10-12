import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "playwright";

const port=5193,base="http://127.0.0.1:"+port,dir="artifacts/hero";
const report={checks:[],errors:[]};
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1","--port",String(port),"--strictPort"],{
  stdio:"ignore",env:{...process.env,VITE_API_BASE_URL:"https://api.example.invalid"}
});
let browser;
try{
  await mkdir(dir,{recursive:true});
  let ready=false;
  for(let i=0;i<100;i++){
    try{if((await fetch(base,{signal:AbortSignal.timeout(700)})).ok){ready=true;break;}}catch{}
    await sleep(150);
  }
  assert.ok(ready,"Local preview unavailable");
  browser=await chromium.launch({headless:true});
  for(const width of [1440,390]){
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:"reduce",locale:"fr-FR"});
    const page=await context.newPage(),errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.goto(base,{waitUntil:"domcontentloaded"});
    await page.locator(".cfh-photo").waitFor({state:"visible"});
    assert.match(await page.locator("#cfh-heading").innerText(),/Montrez vos produits/);
    assert.equal(await page.locator(".cfh-primary").getAttribute("href"),"/app");
    assert.equal(await page.locator(".cfh-secondary").getAttribute("href"),"#whatsapp");
    assert.equal(await page.locator(".cfh-pick").count(),3);
    for(const [index,title,price,theme] of [
      [1,"Sony WH-1000XM5","230 000 FCFA","tech"],
      [2,"Kit éclat hydratant","22 500 FCFA","beauty"],
      [0,"Ensemble deux pièces en lin","35 000 FCFA","fashion"]
    ]){
      await page.locator(".cfh-pick").nth(index).click();
      assert.ok((await page.locator(".cfh-product-name").innerText()).includes(title));
      assert.ok((await page.locator(".cfh-message p").innerText()).includes(price));
      assert.ok((await page.locator(".cfh-stage").getAttribute("class")).includes("cfh-stage--"+theme));
      assert.equal(await page.locator(".cfh-pick").nth(index).getAttribute("aria-pressed"),"true");
    }
    await page.getByRole("button",{name:"EN",exact:true}).click();
    assert.match(await page.locator("#cfh-heading").innerText(),/Show your products/);
    assert.ok((await page.locator(".cfh-message p").innerText()).includes("35,000 FCFA"));
    await page.getByRole("button",{name:"FR",exact:true}).click();
    const metrics=await page.evaluate(()=>{
      const photo=document.querySelector(".cfh-photo");
      const rect=photo.getBoundingClientRect();
      return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,photoTop:rect.top,
        imageLoaded:photo.complete && photo.naturalWidth>0,source:photo.currentSrc};
    });
    assert.ok(metrics.imageLoaded,"Hero photograph failed to load: "+JSON.stringify(metrics));
    assert.ok(metrics.source.includes(".avif"),"Expected locally optimized AVIF: "+JSON.stringify(metrics));
    assert.ok(metrics.scrollWidth<=metrics.viewport+1,"Horizontal overflow: "+JSON.stringify(metrics));
    if(width===390)assert.ok(metrics.photoTop<730,"Product photo is still below first mobile fold: "+JSON.stringify(metrics));
    assert.deepEqual(errors,[],"Uncaught browser errors");
    await page.screenshot({path:dir+"/hero-"+width+".png",animations:"disabled"});
    report.checks.push({width,passed:true,...metrics});

    // A CSS sticky declaration alone is insufficient when an ancestor creates
    // an unintended scrolling box (as happened with .site-shell overflow:hidden).
    // Test the rendered header after real viewport scroll on every public shell.
    for (const [route, selector] of [
      ["/", ".site-header"],
      ["/help", ".info-header"],
      ["/themes", ".theme-gallery-header"],
      ["/app", ".admin-header"],
      ["/demo/faya-computer", ".demo-header"]
    ]) {
      await page.goto(base + route, {waitUntil:"domcontentloaded"});
      await page.locator(selector).waitFor({state:"visible"});
      const nav = await page.evaluate((headerSelector) => {
        const header = document.querySelector(headerSelector);
        if (!header?.parentElement) throw new Error("Navigation header missing");
        const spacer = document.createElement("div");
        spacer.style.height = "1600px";
        spacer.setAttribute("aria-hidden", "true");
        header.parentElement.appendChild(spacer);
        window.scrollTo({top:1000,behavior:"instant"});
        return {
          top:header.getBoundingClientRect().top,
          position:getComputedStyle(header).position,
          scrollY:window.scrollY
        };
      }, selector);
      assert.ok(nav.scrollY >= 500, "Viewport did not scroll for " + route + ": " + JSON.stringify(nav));
      assert.equal(nav.position, "sticky", "Header not sticky on " + route);
      assert.ok(Math.abs(nav.top) <= 2, "Header scrolled away on " + route + ": " + JSON.stringify(nav));
      report.checks.push({width,route,passed:true,...nav});
    }
    await context.close();
  }
}catch(error){
  report.errors.push(String(error?.stack??error));
  process.exitCode=1;
}finally{
  if(browser)await browser.close();
  server.kill("SIGTERM");
  await mkdir(dir,{recursive:true});
  await writeFile(dir+"/report.json",JSON.stringify(report,null,2)+"\n");
  if(report.errors.length)process.stderr.write(report.errors.join("\n")+"\n");
  else process.stdout.write(JSON.stringify(report)+"\n");
}
