import { parseMerchantChannels, parsePosTerminalRates } from '../src/services/api.js';

const tid = '[PORTFOLIO]{"pine_labs":{"enabled":true,"terminal_id":" bbh h","vendor":"Rose Navaneetham Enterprises","plan":"RENTAL","rent":"499.00","rate_t1":"1.6","rate_instant":"1.70"},"payswiff":{"enabled":true,"terminal_id":" h h","vendor":"RONAV Technologies","plan":"RENTAL","rent":"499.00","rate_t1":"1.80","rate_instant":"1.90"},"qr":{"enabled":true,"vendor":"RONAV Technologies","rate_instant":"2.0"}}';

const pos = { terminal_id: tid, commission_rate: '1.6' };
console.log('CHANNELS:', JSON.stringify(parseMerchantChannels(pos), null, 2));
console.log('RATES:', JSON.stringify(parsePosTerminalRates(tid, '1.6'), null, 2));
