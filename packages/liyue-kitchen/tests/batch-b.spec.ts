import { expect, test, type Page, type BrowserContext } from "@playwright/test";
type Point = { x: number; y: number };
async function center(page: Page, testId: string): Promise<Point> {
  const b = await page.getByTestId(testId).first().boundingBox();
  if (!b) throw Error("missing " + testId);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
async function scene(page: Page, type: "center"|"ball"|"fruit"|"plot", index=0): Promise<Point> {
  const b = await page.getByTestId("crystal-canvas").boundingBox();
  if (!b) throw Error("canvas");
  const rad = Math.min(b.width/11, b.height/7, 70), x = b.x+b.width/2, y=b.y+b.height/2;
  if (type === "center") return {x,y};
  if (type === "fruit") return {x:x+(index-1)*rad*.43,y:y-rad*.57};
  if (type === "ball") {
    const a=-Math.PI/2+(index/8)*Math.PI*2+.18;
    return {x:x+Math.cos(a)*(rad*2.96+18), y:y+Math.sin(a)*(rad*2.96+18)};
  }
  const a=(index-1)*Math.PI/3-Math.PI/2;
  return {x:x+Math.cos(a)*rad*1.86,y:y+Math.sin(a)*rad*1.86};
}
async function press(page: Page, id: string, touch: boolean) {
  if(touch) await page.getByTestId(id).tap(); else await page.getByTestId(id).click();
}
async function tap(page: Page, p: Point, touch: boolean) {
  if(touch) await page.touchscreen.tap(p.x,p.y); else await page.mouse.click(p.x,p.y);
}
async function drag(page: Page, ctx: BrowserContext, from: Point, to: Point, touch: boolean) {
  if (!touch) {
    await page.mouse.move(from.x,from.y); await page.mouse.down();
    await page.mouse.move(to.x,to.y,{steps:14}); await page.mouse.up(); return;
  }
  const cdp=await ctx.newCDPSession(page);
  try {
    await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{...from,id:0}]});
    for(let i=1;i<=14;i++) await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",
      touchPoints:[{x:from.x+(to.x-from.x)*i/14,y:from.y+(to.y-from.y)*i/14,id:0}]});
    await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  } finally { await cdp.detach(); }
}
async function snapshot(page:Page) {
  return page.evaluate(async()=>{
    const {gameStore}=await import(/* @vite-ignore */ "/src/domain/store.ts");
    const g=gameStore.getSnapshot();
    return { day:g.day, discoveries:Object.keys(g.discoveries), energy:g.adeptalEnergy,
      used:g.dayCondenseUsed, limit:g.dayCondenseLimit,
      ballCount:Object.keys(g.looseBalls).length,
      held:g.heldElements.reduce((a,b)=>a+b,0),
      bag:!!g.technology.collectBag,
      P02Growth:g.plots.P02.plant?.treeGrowth.reduce((a,b)=>a+b,0)??0 };
  });
}
/** Only accelerates the real domain commands. No fake growth, fruit, or currency. */
async function mature(page: Page):Promise<number[]> {
  const indices=await page.evaluate(async()=>{
    const {applyCommand}=await import(/* @vite-ignore */ "/src/domain/game.ts");
    const {gameStore}=await import(/* @vite-ignore */ "/src/domain/store.ts");
    let g=structuredClone(gameStore.getSnapshot());
    let indices:number[]=[];
    for(let d=0;d<90;d++){
      for(let k=0;k<g.dayCondenseLimit;k++){
        g=applyCommand(g,{type:"CONDENSE"});
        const ball=Object.values(g.looseBalls).at(-1)!;
        g=applyCommand(g,{type:"COLLECT_BALL",ballId:ball.id});
        g=applyCommand(g,{type:"WATER_PLOT",plotId:"P01",element:ball.element});
      }
      const req=applyCommand(g,{type:"REQUEST_END_DAY"});
      g=applyCommand(req,{type:"CONFIRM_END_DAY",expectedDay:g.day});
      indices=g.plots.P01.plant!.leaves.flatMap((leaf,i)=>leaf.fruit?.stage==="MatureFruit"?[i]:[]);
      if(indices.length>=2)break;
    }
    if(indices.length<2 || g.day>46)throw Error("Real fruit maturity/deadline failed");
    await new Promise<void>((resolve,reject)=>{
      const req=indexedDB.open("liyue-kitchen",6);
      req.onerror=()=>reject(req.error);
      req.onsuccess=()=>{
        const db=req.result,tx=db.transaction("game-saves","readwrite");
        tx.objectStore("game-saves").put({version:6,game:g},"primary");
        tx.oncomplete=()=>{db.close();resolve();};
        tx.onerror=()=>{db.close();reject(tx.error);};
      };
    });
    return indices;
  });
  await page.reload();
  await expect(page.getByTestId("loading-save")).toHaveCount(0);
  if(await page.getByTestId("night-report").count())await page.getByTestId("close-report").click();
  return indices;
}
async function scenario(page:Page,ctx:BrowserContext,touch:boolean,proof:string){
  page.setDefaultTimeout(20_000);
  await page.goto("/");
  await expect(page.getByTestId("crystal-canvas")).toHaveCount(1);
  await drag(page,ctx,await center(page,"seed-item"),await scene(page,"center"),touch);
  await expect(page.getByTestId("seed-item")).toHaveCount(0);
  await press(page,"accept-order",touch);
  for(let i=0;i<3;i++)await press(page,"condense",touch);
  for(let i=0;i<3;i++)await tap(page,await scene(page,"ball",i),touch);
  const water=page.locator('[data-testid^="water-"]');
  while(await water.count()) { if(touch)await water.first().tap(); else await water.first().click(); }
  await press(page,"end-day",touch); await press(page,"confirm-day",touch);
  await press(page,"close-report",touch);
  await expect(page.getByTestId("save-status")).toContainText("已保存");
  const start=await snapshot(page);
  expect(start.day).toBe(2);
  expect(start.discoveries).toContain("A18");
  expect(start.discoveries).toContain("A03");

  const indices=await mature(page);
  let state=await snapshot(page);
  for(const id of ["A00","A01","A02","A03","A07","A12","A18","H01"])
    expect(state.discoveries).toContain(id);
  await press(page,"open-discoveries",touch);
  await expect(page.locator('[data-node-id="H01"]')).toHaveAttribute("data-status","completed");
  await expect(page.getByTestId("graph-zoom")).toContainText("100%");
  await press(page,"zoom-in",touch);
  await expect(page.getByTestId("graph-zoom")).toContainText("110%");
  await expect(page.getByTestId("discovery-evidence-A12")).toContainText("种出第一枚成熟水瓜");
  await press(page,"close-discoveries",touch);

  await tap(page,await scene(page,"fruit",indices[0]),touch);
  await expect(page.getByTestId("feedback")).toContainText("已采摘");
  await drag(page,ctx,await scene(page,"center").then(async()=> {
    const b=await page.getByTestId("crystal-canvas").boundingBox();
    if(!b)throw Error("canvas");return{x:b.x+b.width*.36,y:b.y+b.height*.69};
  }),await center(page,"region-storage"),touch);
  await expect(page.getByTestId("fruit-storage")).toHaveCount(1);
  await press(page,"deliver-order",touch);
  await expect(page.getByTestId("order-requirement")).toContainText("杯装水瓜汁");
  await press(page,"accept-order",touch);

  await press(page,"open-discoveries",touch);
  await press(page,"buy-collect-bag",touch);
  await expect(page.getByTestId("bag-qualification")).toContainText("永久解锁");
  await press(page,"close-discoveries",touch);
  await expect(page.getByTestId("collect-all")).toBeVisible();
  const before=await snapshot(page);
  for(let i=0;i<3;i++)await press(page,"condense",touch);
  await press(page,"collect-all",touch);
  const after=await snapshot(page);
  expect(after.ballCount).toBe(0);
  expect(after.held-before.held).toBe(150);
  expect(after.used-before.used).toBe(3);
  expect(after.limit).toBe(before.limit);
  expect(after.energy.earnedTotal-after.energy.spentTotal).toBe(after.energy.balance);

  await tap(page,await scene(page,"fruit",indices[1]),touch);
  const b=await page.getByTestId("crystal-canvas").boundingBox();
  if(!b)throw Error("canvas");
  const ground={x:b.x+b.width*.36,y:b.y+b.height*.69};
  await drag(page,ctx,ground,await center(page,"peel-drop"),touch);
  await press(page,"peel-action",touch);
  await drag(page,ctx,await center(page,"peel-item"),await center(page,"juice-drop"),touch);
  await press(page,"juice-action",touch);
  await press(page,"cup-action",touch);
  await drag(page,ctx,await center(page,"juice-item"),await center(page,"region-inventory"),touch);
  await press(page,"deliver-order",touch);
  await expect(page.getByTestId("order-history").first()).toContainText("已交付");

  await press(page,"unlock-P02",touch);
  await expect(page.getByTestId("unlock-P02")).toHaveCount(0);
  await drag(page,ctx,await center(page,"seed-item"),await scene(page,"plot",1),touch);
  await expect(page.getByTestId("selected-plot")).toContainText("2号地");
  const nutrients=page.locator('[data-testid^="water-"]');
  while(await nutrients.count()){if(touch)await nutrients.first().tap();else await nutrients.first().click();}
  await press(page,"end-day",touch);await press(page,"confirm-day",touch);
  await press(page,"close-report",touch);
  state=await snapshot(page);
  expect(state.P02Growth).toBeGreaterThan(0);
  for(const id of ["A13","A14","A16","A17"])expect(state.discoveries).toContain(id);
  expect(state.energy.earnedTotal-state.energy.spentTotal).toBe(state.energy.balance);
  await press(page,"open-discoveries",touch);
  await expect(page.getByTestId("discovery-evidence-A16")).toContainText("交付真正的杯装水瓜汁");
  await page.screenshot({path:proof});
  await press(page,"close-discoveries",touch);
  await expect(page.getByTestId("save-status")).toContainText("已保存");
  await page.reload();
  await expect(page.getByTestId("unlock-P02")).toHaveCount(0);
  await expect(page.getByTestId("collect-all")).toBeVisible();
  const restored=await snapshot(page);
  expect(restored.bag).toBe(true);
  expect(restored.P02Growth).toBeGreaterThan(0);
}
test("U8 mouse: real start through dual commission, discovery, technology and second plot",async({page},info)=>{
  test.setTimeout(240_000);
  await page.setViewportSize({width:1600,height:900});
  await scenario(page,page.context(),false,info.outputPath("core-loop-desktop.png"));
});
test("U8 simulated touch: same full workflow with actual pointer drags",async({browser},info)=>{
  test.setTimeout(240_000);
  const ctx=await browser.newContext({viewport:{width:1280,height:720},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  try {await scenario(await ctx.newPage(),ctx,true,info.outputPath("core-loop-touch.png"));}
  finally {await ctx.close();}
});
