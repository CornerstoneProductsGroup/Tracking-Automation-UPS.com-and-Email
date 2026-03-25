# Tracking Automation for UPS and Rithum

This project provides a Playwright-based browser automation that:

1. Opens the UPS shipping history page.
2. Logs into Rithum with username and password.
3. Selects the `Cornerstone Products Group` identity.
4. Opens Home Depot `Open / No Activity` orders.
3. Reads each visible Rithum order block.
4. Tries to match that order by PO number or ship-to customer name against the UPS shipping history rows.
5. Fills the Rithum tracking number, shipping method, and ship quantity.

The current implementation uses the concrete Rithum selectors and navigation details you provided. UPS still pauses for manual login because that account flow was not specified yet.

## Requirements

- Node.js 20+
- A Chromium-compatible browser install handled by Playwright

## Setup

```bash
npm install
cp .env.example .env
```

Set these values in `.env` as needed:

- `UPS_HISTORY_URL`: UPS shipping history page URL
- `RITHUM_LOGIN_URL`: CommerceHub/Rithum login URL
- `RITHUM_USERNAME`: Rithum username
- `RITHUM_PASSWORD`: Rithum password
- `RITHUM_PROFILE_NAME`: defaults to `Cornerstone Products Group`
- `RITHUM_MERCHANT_ID`: defaults to `thehomedepot`
- `HEADLESS=false`: keep browser visible for login and debugging
- `LOGIN_DELAY_MS=5000`: delay after password submit before profile selection
- `DEFAULT_SHIP_METHOD=UPS Ground`: text matched against the shipping method dropdown
- `DEFAULT_SHIP_QUANTITY_MODE=remaining`: uses the quantity remaining from the order row. Any other value defaults to `1`.

## Run

```bash
npm start
```

The script pauses on UPS so you can complete login and land on shipping history. Rithum login is handled automatically from the values in `.env`.

## Current assumptions

- UPS shipping history rows are in a table where the third visible data column is `Ship To - Company or Name` and the fifth visible data column is `Shipment Tracking #`.
- Rithum PO links use `a.simple_link[href*="gotoOrderDetail.do?Hub_PO="]`.
- Rithum tracking and shipping method fields use IDs like `order(HUB_PO).box(1).trackingnumber` and `order(HUB_PO).box(1).shippingmethod`.
- The shipped quantity field is item-specific and uses IDs like `order(HUB_PO).box(1).item(ITEM_ID).shipped`.
- The quantity to enter is read from the matching remaining cell with an ID like `cell.line.order(HUB_PO).box(1).item(ITEM_ID).remaining`.

## Likely adjustments

The most likely areas to tune are in [src/index.js](/workspaces/Tracking-Automation-UPS.com-and-Email/src/index.js):

- `getOpenOrders()` if Rithum renders order sections with a different container hierarchy than expected
- `readUpsRows()` column indexes if UPS adds or hides columns
- `matchShipment()` if PO numbers appear in a different UPS field than `Ship To - Company or Name`

## Recommended next step

Run Playwright codegen against both pages and replace the broad selectors with exact ones from your live environment if the current version does not bind correctly.