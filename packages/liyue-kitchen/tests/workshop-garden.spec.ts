import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { newGame } from "../src/domain/game.ts";
import { growRealFruit, getSavedGame, putSavedGame } from "./support/worldFixture";
import { remoteBrowserContextOptions } from "./support/browserContextOptions";

type Point = { x:number; y:number };
async function center(page:Page,id:string):Promise<Point> {
  const b=await page.getByTestId(id).first().boundingBox();
  if(!b)throw Error("Missing "+id);
  return {x:b.x+b.width/2,y:b.y+b.height/2};
}
async function fruit(page:Page,index:number):Promise<Point> {
  const b=await page.getByTestId("crystal-canvas").boundingBox();
  if(!b)throw Error("Garden canvas not mounted");
  const rad=Math.min(b.width/11,b.height/7,70);
  return {x:b.x+b.width/2+(index-1)*rad*.43,y:b.y+b.height/2-rad*.57};
}
async function floor(page:Page):Promise<Point> {
  const b=await page.getByTestId("crystal-canvas").boundingBox();
  if(!b)throw Error("Garden canvas missing");
  return {x:b.x+b.width*.36,y:b.y+b.height*.69};
}
async function mouseDrag(page:Page,a:Point,b:Point) {
  await page.mouse.move(a.x,a.y);await page.mouse.down();
  await page.mouse.move(b.x,b.y,{steps:18});await page.mouse.up();
}
async function touchDrag(page:Page,ctx:BrowserContext,a:Point,b:Point) {
  const cdp=await ctx.newCDPSession(page);
  try {
    await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{...a,id:0}]});
    for(let i=1;i<=18;i++)await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{
      x:a.x+(b.x-a.x)*i/18,y:a.y+(b.y-a.y)*i/18,id:0}]});
    await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  } finally { await cdp.detach(); }
}
async function load(page:Page){
  await page.goto("/");
  await expect(page.getByTestId("loading-save")).toHaveCount(0);
  if(await page.getByTestId("night-report").count())await page.getByTestId("close-report").click();
}
async function enter(page:Page) {
  await page.getByTestId("enter-garden").click();
  await expect(page.getByTestId("garden-scene")).toBeVisible();
  await expect(page.getByTestId("crystal-canvas")).toHaveCount(1);
}
async function back(page:Page) {
  await page.getByTestId("back-workshop").click();
  await expect(page.getByTestId("workshop-scene")).toBeVisible();
  await expect(page.getByTestId("crystal-canvas")).toHaveCount(0);
}

test("desktop workshop and garden: harvest → store → two commissions, peel, juice and save",async({page},info)=>{
  test.setTimeout(180_000);
  await page.setViewportSize({width:1600,height:900});
  await load(page);
  await expect(page.getByTestId("workshop-scene")).toBeVisible();
  await expect(page.getByTestId("region-crystal")).toHaveCount(0);
  const {game,indices}=growRealFruit(newGame(1747),2,130);
  await putSavedGame(page,game);
  await page.reload();
  if(await page.getByTestId("night-report").count())await page.getByTestId("close-report").click();
  await expect(page.getByTestId("garden-overview")).toContainText("挂果");
  await page.getByTestId("accept-order").click();
  const initial=await getSavedGame(page);
  await enter(page);
  const first=await fruit(page,indices[0]);await page.mouse.click(first.x,first.y);
  await expect(page.getByTestId("feedback")).toContainText("已采摘");
  const firstId=await page.getByTestId("selected-item").getAttribute("data-item-id");
  await mouseDrag(page,await floor(page),await center(page,"region-storage"));
  await expect(page.locator('[data-testid="fruit-storage"][data-item-id="'+firstId+'"]')).toHaveCount(1);
  await back(page);
  await page.getByTestId("deliver-order").click();
  await expect(page.getByTestId("order-history").first()).toContainText("已交付");
  await page.getByTestId("accept-order").click();
  await enter(page);
  const next=await fruit(page,indices[1]);await page.mouse.click(next.x,next.y);
  const secondId=await page.getByTestId("selected-item").getAttribute("data-item-id");
  await mouseDrag(page,await floor(page),await center(page,"region-inventory"));
  await expect(page.locator('[data-testid="fruit-inventory"][data-item-id="'+secondId+'"]')).toHaveCount(1);
  await back(page);
  await mouseDrag(page,await center(page,"fruit-inventory"),await center(page,"peel-drop"));
  await expect(page.getByTestId("peel-action")).toBeEnabled();
  await page.getByTestId("peel-action").click();
  await mouseDrag(page,await center(page,"peel-item"),await center(page,"juice-drop"));
  await page.getByTestId("juice-action").click();
  await page.getByTestId("cup-action").click();
  const cupId=await page.getByTestId("juice-item").getAttribute("data-item-id");
  await mouseDrag(page,await center(page,"juice-item"),await center(page,"region-inventory"));
  await page.getByTestId("deliver-order").click();
  await expect(page.getByTestId("order-history").first()).toContainText("已交付");
  const end=await getSavedGame(page);
  expect(end.day).toBe(initial.day);
  expect(end.items[firstId!]).toBeUndefined();
  expect(end.items[cupId!]).toBeUndefined();
  await page.screenshot({path:info.outputPath("workshop-desktop-1600x900.png")});
  await page.reload();
  if(await page.getByTestId("night-report").count()) await page.getByTestId("close-report").click();
  await expect(page.getByTestId("workshop-scene")).toBeVisible();
  await expect(page.getByTestId("order-history")).toHaveCount(2);
  await enter(page);
  await page.screenshot({path:info.outputPath("garden-desktop-1600x900.png")});
});

test("touch workshop to garden: wrong drag, planting, night, reset and garden re-entry",async({browser},info)=>{
  test.setTimeout(180_000);
  const ctx=await browser.newContext({...remoteBrowserContextOptions,viewport:{width:1280,height:720},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  try {
    const page=await ctx.newPage();await load(page);
    await expect(page.getByTestId("workshop-scene")).toBeVisible();
    await page.getByTestId("enter-garden").tap();
    await expect(page.getByTestId("crystal-canvas")).toHaveCount(1);
    const original=await getSavedGame(page);
    await touchDrag(page,ctx,await center(page,"seed-item"),await center(page,"back-workshop"));
    await expect(page.getByTestId("seed-item")).toHaveCount(1);
    await expect(page.getByTestId("feedback")).toContainText("未消耗");
    await touchDrag(page,ctx,await center(page,"seed-item"),await center(page,"crystal-canvas"));
    await expect(page.getByTestId("seed-item")).toHaveCount(0);
    await page.getByTestId("condense").tap();
    await page.getByTestId("end-day").tap();
    await page.getByTestId("confirm-day").tap();
    await expect(page.getByTestId("night-report")).toBeVisible();
    await page.getByTestId("close-report").tap();
    await expect(page.getByTestId("day")).toContainText("第 2 天");
    await page.getByTestId("back-workshop").tap();
    await expect(page.getByTestId("workshop-scene")).toBeVisible();
    await page.screenshot({path:info.outputPath("workshop-touch-1280x720.png")});
    await page.getByTestId("save-open").tap();
    await page.getByTestId("save-restart").tap();
    await page.getByTestId("save-restart-confirm").tap();
    await expect(page.getByTestId("workshop-scene")).toBeVisible();
    await expect(page.getByTestId("seed-item")).toHaveCount(1);
    const reset=await getSavedGame(page);
    expect(reset.randomState).not.toBe(original.randomState);
    expect(reset.day).toBe(1);
    await page.getByTestId("enter-garden").tap();
    await expect(page.getByTestId("crystal-canvas")).toHaveCount(1);
    await page.screenshot({path:info.outputPath("garden-touch-1280x720.png")});
  } finally {await ctx.close();}
});
