const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Start tournament/i }).click();
  await page.waitForURL("**/duel");
  await page.waitForSelector(".duel__arena");
  for (let i = 0; i < 40; i++) {
    if (page.url().includes("/results")) break;
    await page.keyboard.press("1");
    await page.waitForTimeout(100);
  }
  await page.waitForURL("**/results", { timeout: 20000 });
  const ranks = await page.locator(".rank-list__row").count();
  const title = await page.locator("h1").first().textContent();
  console.log(JSON.stringify({ title, ranks, errors, url: page.url() }));
  await browser.close();
  if (ranks < 2) process.exit(2);
  if (errors.length) process.exit(3);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
