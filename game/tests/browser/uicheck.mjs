// Browser smoke check of the multiplayer UI — the one thing Node tests cannot see.
// A host creates a room, a guest joins by code (its own browser context = its own device),
// a bot fills a seat, the game starts, a few decisions are clicked, nobody sees anybody else's
// cards, and the guest reloads the page and must land back in their seat.
//
//   npm --prefix game/web run build      # ?server=... needs no special build; P2P is the default
//   npm run server                       # serves the build and the rooms on :8080
//   npm run uicheck                      # MODE=server (default) | MODE=p2p, BASE=<url>
//
// Needs a local browser: BROWSER_PATH (default: Firefox), or Chrome via BROWSER=chrome.
import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8080';
const OUT = process.env.OUT ?? '.';
const MODE = process.env.MODE ?? 'server';
const BROWSER = process.env.BROWSER ?? 'firefox';
const PATHS = {
  firefox: 'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
  chrome: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
};
const EXE = process.env.BROWSER_PATH ?? PATHS[BROWSER];
const query = MODE === 'server' ? '?server=same' : '';
const log = (...a) => console.log(...a);

const browser = await puppeteer.launch({
  browser: BROWSER,
  executablePath: EXE,
  headless: process.env.HEADED !== '1',
  ...(BROWSER === 'firefox' ? { protocol: 'webDriverBiDi' } : {}),
});
const done = async (code) => { await browser.close(); process.exit(code); };
const fail = async (msg, pages = []) => {
  log('FAIL:', msg);
  for (const [n, p] of pages) { try { await p.screenshot({ path: `${OUT}/fail-${n}.png` }); } catch { /* gone */ } }
  await done(1);
};

async function clickText(page, text, sel = 'button') {
  const h = await page.evaluateHandle((t, g) => [...document.querySelectorAll(g)].find((e) => e.textContent.includes(t) && !e.disabled) ?? null, text, sel);
  const el = h.asElement();
  if (!el) throw new Error(`no ${sel} with text "${text}"`);
  await el.click();
}
const bodyText = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
const hand = (page) => page.evaluate(() => [...document.querySelectorAll('.hand .gc-name')].map((e) => e.textContent.trim()));

// ---- the host makes a room ----------------------------------------------------------------
const host = await (await browser.createBrowserContext()).newPage();
host.on('pageerror', (e) => log('HOST PAGE ERROR:', e.message));
await host.goto(`${BASE}/${query}`, { waitUntil: 'load' });
await clickText(host, 'Игра по сети');
await host.waitForFunction(() => document.body.innerText.includes('Создать комнату'), { timeout: 15000 });
await clickText(host, 'Создать комнату');
await host.waitForFunction(() => /Код комнаты/.test(document.body.innerText), { timeout: 20000 })
  .catch(() => fail('the room was not created', [['host', host]]));
const code = await host.$eval('.rc-code', (e) => e.textContent.trim());
log(`mode ${MODE} · room code: ${code}`);
if (!/^[A-Z]{4}$/.test(code)) await fail('bad room code', [['host', host]]);

// ---- a guest joins by code (separate context = separate device and token) --------------------
const guest = await (await browser.createBrowserContext()).newPage();
guest.on('pageerror', (e) => log('GUEST PAGE ERROR:', e.message));
await guest.goto(`${BASE}/${query}${query ? '&' : '?'}room=${code}`, { waitUntil: 'load' });
await guest.waitForFunction(() => document.body.innerText.includes('Войти по коду'), { timeout: 15000 });
await guest.$eval('.code-big', (e, c) => {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(e, c);
  e.dispatchEvent(new Event('input', { bubbles: true }));
}, code);
await clickText(guest, 'Войти');
await guest.waitForFunction(() => /Комната собирается/.test(document.body.innerText), { timeout: 25000 })
  .catch(() => fail('the guest never reached the lobby', [['guest', guest]]));
await host.waitForFunction(() => document.querySelectorAll('.seat').length === 2, { timeout: 15000 })
  .catch(() => fail('the host does not see the guest', [['host', host], ['guest', guest]]));
log('lobby: host + guest');

// ---- a bot on the third seat, then start -----------------------------------------------------
await clickText(host, 'Посадить бота');
await host.waitForFunction(() => document.querySelectorAll('.seat').length === 3, { timeout: 10000 });
await clickText(host, 'Начать партию');
for (const [n, p] of [['host', host], ['guest', guest]]) {
  await p.waitForFunction(() => /Раунд \d+/.test(document.body.innerText), { timeout: 30000 }).catch(() => fail(`${n} never reached the table`, [[n, p]]));
}
log('both at the table');

// ---- play a few decisions --------------------------------------------------------------------
let moves = 0;
for (let i = 0; i < 60 && moves < 8; i++) {
  let acted = false;
  for (const p of [host, guest]) {
    const ok = await p.evaluate(() => {
      const b = [...document.querySelectorAll('.stage-actions button, .react-row button')].find((x) => !x.disabled);
      if (!b) return false;
      b.click();
      return true;
    });
    if (ok) { acted = true; moves++; }
  }
  await new Promise((r) => setTimeout(r, acted ? 400 : 700));
}
const round = (s) => /Раунд (\d+)/.exec(s)?.[1];
const [hostRound, guestRound] = [round(await bodyText(host)), round(await bodyText(guest))];
log('decisions clicked:', moves, '· round:', hostRound);
if (!hostRound || hostRound !== guestRound) await fail(`the two screens disagree: round ${hostRound} vs ${guestRound}`, [['host', host], ['guest', guest]]);

// ---- hidden information ------------------------------------------------------------------------
// A card name may legitimately show up in the log or as a played card (the deck has duplicates),
// so the check is structural: no face-up card and no hand peek in the opponents' area.
log('host hand:', (await hand(host)).join(' | ') || '(empty)', '· guest hand:', (await hand(guest)).join(' | ') || '(empty)');
const peek = await guest.evaluate(() => ({
  peeks: document.querySelectorAll('.mat-peek').length,
  faces: document.querySelectorAll('.opponents .gc-name').length,
  mats: document.querySelectorAll('.opponents .mat').length,
}));
log('opponents area as the guest sees it:', JSON.stringify(peek));
if (peek.peeks || peek.faces) await fail(`somebody else's cards are visible: ${JSON.stringify(peek)}`, [['guest', guest]]);

// ---- the guest reloads (phone locked, tab restored) ---------------------------------------------
await guest.reload({ waitUntil: 'load' });
await guest.waitForFunction(() => /Раунд \d+/.test(document.body.innerText), { timeout: 40000 })
  .catch(() => fail('the guest did not get back to their seat after a reload', [['guest', guest]]));
log('the guest is back at the table after a reload');

await host.screenshot({ path: `${OUT}/host.png` });
await guest.screenshot({ path: `${OUT}/guest.png` });
log('OK');
await done(0);
