import { chromium } from 'playwright';
import { config } from './config.js';

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function sanitizePoNumber(value) {
  return String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function extractNameFromShipTo(rawShipTo) {
  const line = String(rawShipTo || '').split(',')[0];
  return normalizeText(line);
}

function buildSearchTerms(order) {
  const terms = [];

  if (order.poNumber) {
    terms.push({
      type: 'po',
      raw: order.poNumber,
      normalized: sanitizePoNumber(order.poNumber)
    });
  }

  if (order.shipToName) {
    terms.push({
      type: 'name',
      raw: order.shipToName,
      normalized: normalizeText(order.shipToName)
    });
  }

  return terms.filter((term) => term.normalized);
}

async function waitForVisible(locator, timeout = 30000) {
  await locator.waitFor({ state: 'visible', timeout });
}

async function loginToUps(page) {
  // Only open the UPS URL and wait for user to log in manually
  await page.goto(config.upsHistoryUrl, { waitUntil: 'domcontentloaded' });
  console.log('Please log in to UPS.com manually in the opened browser window. Complete any CAPTCHA or security steps. When you are fully logged in and see your shipping history, press Enter in the terminal to continue.');
  await new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.pause();
      resolve();
    });
  });
  await page.waitForLoadState('domcontentloaded');
}

async function loginToRithum(page) {
  if (!config.rithumUsername || !config.rithumPassword) {
    throw new Error('Missing RITHUM_USERNAME or RITHUM_PASSWORD in environment.');
  }

  await page.goto(config.rithumLoginUrl, { waitUntil: 'domcontentloaded' });

  const usernameInput = page.locator('#username');
  await waitForVisible(usernameInput);
  await usernameInput.fill(config.rithumUsername);
  await page.locator('button._button-login-id').click();

  const passwordInput = page.locator('#password');
  await waitForVisible(passwordInput);
  await passwordInput.fill(config.rithumPassword);
  await page.locator('button._button-login-password').click();

  await page.waitForTimeout(config.loginDelayMs);

  // Go directly to the open orders page after login
  await page.goto(config.rithumOrdersUrl, { waitUntil: 'domcontentloaded' });
}

async function getOpenOrders(page) {
  const poLinks = page.locator('a.simple_link[href*="gotoOrderDetail.do?Hub_PO="]');
  const count = await poLinks.count();
  const orders = [];

  for (let index = 0; index < count; index += 1) {
    const poLink = poLinks.nth(index);
    const poNumber = (await poLink.innerText()).trim();
    const href = (await poLink.getAttribute('href')) || '';
    const hubPoMatch = href.match(/Hub_PO=([^&]+)/i);
    const hubPo = hubPoMatch?.[1] || '';
    const root = poLink.locator('xpath=ancestor::div[contains(@class, "framework_fiftyfifty_left_greenoutline") or contains(@class, "framework_fiftyfifty_right_greenoutline")][1]/preceding-sibling::*[1] | ancestor::table[1]');
    const section = root.first();
    const shipToContainer = section.locator('div.framework_fiftyfifty_left_greenoutline').first();
    const shipToText = (await shipToContainer.innerText()).replace(/Ship To:\s*/i, '').trim();
    const remainingCells = page.locator(
      `td[id^="cell.line.order(${hubPo}).box(1).item("][id$=").remaining"]`
    );
    const itemCount = await remainingCells.count();
    const items = [];
    for (let itemIndex = 0; itemIndex < itemCount; itemIndex += 1) {
      const cell = remainingCells.nth(itemIndex);
      const cellId = (await cell.getAttribute('id')) || '';
      const itemIdMatch = cellId.match(/item\((\d+)\)\.remaining$/i);
      const itemId = itemIdMatch?.[1] || '';
      const quantityRemaining = Number((await cell.innerText()).trim() || 1);
      const shipQuantityInput = page.locator(
        `#order\\(${hubPo}\\)\\.box\\(1\\)\\.item\\(${itemId}\\)\\.shipped`
      );
      items.push({ itemId, quantityRemaining, shipQuantityInput });
    }

    const trackingInput = page.locator(`#order\\(${hubPo}\\)\\.box\\(1\\)\\.trackingnumber`);
    const shipMethodSelect = page.locator(`#order\\(${hubPo}\\)\\.box\\(1\\)\\.shippingmethod`);

    orders.push({
      index,
      hubPo,
      panel: section,
      poNumber,
      shipToRaw: shipToText,
      shipToName: extractNameFromShipTo(shipToText),
      items,
      trackingInput,
      shipMethodSelect
    });
  }

  return orders;
}

async function readUpsRows(page) {
  let shipments = [];
  let pageNum = 1;
  // Find column indexes by header text
  let shipToCol = null;
  let trackingCol = null;
  // Wait for table header
  await page.waitForSelector('table thead tr th');
  const headers = page.locator('table thead tr th');
  const headerCount = await headers.count();
  for (let i = 0; i < headerCount; i++) {
    const text = (await headers.nth(i).innerText()).replace(/\s+/g, ' ').trim().toLowerCase();
    if (text.includes('ship to') && text.includes('company')) shipToCol = i;
    if (text.includes('tracking')) trackingCol = i;
  }
  if (shipToCol == null || trackingCol == null) {
    throw new Error('Could not find Ship To or Tracking # columns in UPS table header.');
  }
  while (true) {
    await page.waitForSelector('table tbody tr');
    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    for (let index = 0; index < count; index += 1) {
      const row = rows.nth(index);
      const cells = row.locator('td');
      const cellCount = await cells.count();
      if (cellCount <= Math.max(shipToCol, trackingCol)) continue;
      // Ship To cell may have a span
      let shipToName = '';
      try {
        const shipToCell = cells.nth(shipToCol);
        const shipToSpan = shipToCell.locator('span');
        if (await shipToSpan.count() > 0) {
          shipToName = normalizeText(await shipToSpan.first().innerText());
        } else {
          shipToName = normalizeText(await shipToCell.innerText());
        }
      } catch (e) {}
      // Tracking cell may have a link
      let trackingNumber = '';
      try {
        const trackingCell = cells.nth(trackingCol);
        const trackingLink = trackingCell.locator('a');
        if (await trackingLink.count() > 0) {
          trackingNumber = (await trackingLink.first().innerText()).trim().toUpperCase();
        } else {
          trackingNumber = (await trackingCell.innerText()).trim().toUpperCase();
        }
      } catch (e) {}
      shipments.push({
        page: pageNum,
        index,
        shipToName,
        trackingNumber
      });
    }
    // Look for a next page button that is enabled
    const nextBtn = page.locator('button[aria-label="Next Page"]:not([disabled])');
    if (await nextBtn.count() > 0) {
      await nextBtn.click();
      await page.waitForTimeout(1000);
      pageNum += 1;
    } else {
      break;
    }
  }
  return shipments;
}

function matchShipment(order, shipments) {
  const searchTerms = buildSearchTerms(order);

  for (const shipment of shipments) {
    for (const term of searchTerms) {
      if (term.type === 'po' && shipment.shipToName.includes(term.normalized)) {
        return shipment;
      }

      if (term.type === 'name' && shipment.shipToName.includes(term.normalized)) {
        return shipment;
      }
    }
  }

  return null;
}

async function fillOrder(order, shipment) {
  await order.trackingInput.fill(shipment.trackingNumber);
  await order.shipMethodSelect.selectOption({ label: config.defaultShipMethod });

  for (const item of order.items) {
    const quantity =
      config.defaultShipQuantityMode === 'remaining' ? item.quantityRemaining : 1;
    await item.shipQuantityInput.fill(String(quantity));
  }
}

async function main() {
  const browser = await chromium.launch({ headless: config.headless, slowMo: 100 });
  const context = await browser.newContext();
  const upsPage = await context.newPage();
  const rithumPage = await context.newPage();

  try {
    await loginToUps(upsPage);
    await loginToRithum(rithumPage);

    const orders = await getOpenOrders(rithumPage);
    const shipments = await readUpsRows(upsPage);

    let matchedCount = 0;
    for (const order of orders) {
      const shipment = matchShipment(order, shipments);
      if (!shipment) {
        console.log(
          `No UPS match found for PO ${order.poNumber || 'unknown'} / ${order.shipToName || 'unknown name'}`
        );
        continue;
      }

      await fillOrder(order, shipment);
      matchedCount += 1;
      console.log(
        `Filled order ${order.poNumber || order.index + 1} with tracking ${shipment.trackingNumber} (${order.items.length} line item${order.items.length === 1 ? '' : 's'})`
      );
    }

    console.log(`Completed. Filled ${matchedCount} of ${orders.length} visible orders.`);
    await rithumPage.pause();
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});