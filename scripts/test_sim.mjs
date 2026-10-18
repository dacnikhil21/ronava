import { parseMerchantChannels, parsePosTerminalRates } from '../src/services/api.js';

const posRecord = {
  provider: 'Pine Labs',
  terminal_id: '[PORTFOLIO]{"pine_labs":{"enabled":true,"terminal_id":"dfv","vendor":"Rose Navaneetham Enterprises","plan":"RENTAL","rent":"499.00","rate_t1":"1.20","rate_instant":"1.30"},"payswiff":{"enabled":true,"terminal_id":" fvev","vendor":"RONAV Technologies","plan":"RENTAL","rent":"499.00","rate_t1":"1.40","rate_instant":"1.50"},"qr":{"enabled":true,"vendor":"RONAV Technologies","rate_instant":"1.60"}}',
  commission_rate: '1.2'
};

const user = { id: 'MST1002', channels: {} };
const merchantChannels = parseMerchantChannels(posRecord);
console.log('merchantChannels:', merchantChannels);

const effectiveKey = 'pine_labs';
const ch = user?.channels?.[effectiveKey] || merchantChannels?.[effectiveKey];
console.log('ch:', ch);

const userPosRates = parsePosTerminalRates(posRecord.terminal_id, posRecord.commission_rate);
console.log('userPosRates:', userPosRates);
