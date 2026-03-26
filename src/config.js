import dotenv from 'dotenv';

dotenv.config();

function toBoolean(value, fallback = false) {
  if (value == null || value === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

export const config = {
  upsHistoryUrl:
    process.env.UPS_HISTORY_URL ||
    'https://www.ups.com/ship/history?loc=en_US',
  upsUsername: process.env.UPS_USERNAME || '',
  upsPassword: process.env.UPS_PASSWORD || '',
  rithumLoginUrl:
    process.env.RITHUM_LOGIN_URL ||
    'https://account.commercehub.com/u/login/identifier?state=hKFo2SBHTGRuZEJ5a240bUR0bEpNTnJVY1dhVWlkSjJNZ1ZqNqFur3VuaXZlcnNhbC1sb2dpbqN0aWTZIFlCR3Y1OENjaXM1SXJwTmlRRzNNeFhlRWExRnJCNFlpo2NpZNkgTjZ3QnJKMXV3WEtSMU1tMFJ0RlgxSlhONklQNm5oYmw',
  rithumUsername: process.env.RITHUM_USERNAME || '',
  rithumPassword: process.env.RITHUM_PASSWORD || '',
  rithumProfileName:
    process.env.RITHUM_PROFILE_NAME || 'Cornerstone Products Group',
  rithumMerchantId: process.env.RITHUM_MERCHANT_ID || 'thehomedepot',
  rithumOrdersUrl: process.env.RITHUM_ORDERS_URL || 'https://dsm.commercehub.com/dsm/gotoOrderRealmForm.do?action=web_quickship&tabContext=web_quickship&status=open&substatus=no-activity&merchant=thehomedepot',
  headless: toBoolean(process.env.HEADLESS, false),
  loginDelayMs: Number(process.env.LOGIN_DELAY_MS || 5000),
  defaultShipMethod: process.env.DEFAULT_SHIP_METHOD || 'UPS Ground',
  defaultShipQuantityMode: process.env.DEFAULT_SHIP_QUANTITY_MODE || 'remaining'
  // Microsoft Graph API config for Outlook email access
  msGraphClientId: process.env.MS_GRAPH_CLIENT_ID || '',
  msGraphClientSecret: process.env.MS_GRAPH_CLIENT_SECRET || '',
  msGraphTenantId: process.env.MS_GRAPH_TENANT_ID || '',
  msGraphUserEmail: process.env.MS_GRAPH_USER_EMAIL || '',
};
