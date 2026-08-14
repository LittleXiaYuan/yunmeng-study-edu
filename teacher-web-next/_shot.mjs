import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const accounts = [
  { role: "admin", user: "admin", pass: "admin123456", path: "/admin" },
  { role: "teacher", user: "teacher", pass: "teacher123456", path: "/teacher" },
];

const browser = await chromium.launch();
for (const a of accounts) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push("PAGEERR: " + e.message));

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });

  // fill login — find inputs by placeholder/type
  const inputs = page.locator("input");
  const n = await inputs.count();
  console.log(`[${a.role}] login inputs: ${n}`);
  // username = first text input, password = input[type=password]
  await page.locator('input[type="text"], input:not([type="password"]):not([type="checkbox"])').first().fill(a.user);
  await page.locator('input[type="password"]').first().fill(a.pass);
  await page.locator('button:has-text("登录"), button[type="submit"]').first().click();

  await page.waitForTimeout(3500);
  console.log(`[${a.role}] url after login: ${page.url()}`);

  // if not on portal path, try navigate
  if (!page.url().includes(a.path)) {
    await page.goto(`${BASE}${a.path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
  }

  await page.screenshot({ path: `_shot_${a.role}_dashboard.png`, fullPage: true });

  // click through nav items to capture each view
  const navBtns = page.locator("nav button, aside button, [role='navigation'] button");
  const cnt = await navBtns.count();
  console.log(`[${a.role}] nav buttons: ${cnt}`);
  for (let i = 0; i < Math.min(cnt, 5); i++) {
    try {
      await navBtns.nth(i).click();
      await page.waitForTimeout(1500);
      const label = (await navBtns.nth(i).innerText()).replace(/\s+/g, "");
      await page.screenshot({ path: `_shot_${a.role}_${i}_${label}.png`, fullPage: true });
    } catch (e) { console.log(`  nav ${i} click failed: ${e.message}`); }
  }

  if (errs.length) console.log(`[${a.role}] console errors:\n  ` + errs.slice(0, 8).join("\n  "));
  await ctx.close();
}
await browser.close();
console.log("DONE");
