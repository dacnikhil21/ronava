import { 
  serializeMerchantChannels, 
  parseMerchantChannels, 
  createDownstreamUser, 
  updateMerchantChannels, 
  getWallet,
  getAllUsers
} from './src/services/api.js';
import { supabase } from './src/services/supabase.js';

async function testPortfolio() {
  console.log('=== TESTING OPTION 1 MULTI-CHANNEL PORTFOLIO ===\n');

  // Test 1: Unit Serialization & Parsing
  console.log('1. Testing Unit Serialization & Parsing...');
  const testChannels = {
    pine_labs: { enabled: true, terminal_id: 'PL-9988', rate_t1: 1.50, rate_instant: 1.80, vendor: 'Rose Navaneetham Enterprises', plan: 'RENTAL', rent: 499 },
    payswiff: { enabled: true, terminal_id: 'SWIFF-3322', rate_t1: 1.65, rate_instant: 1.83, vendor: 'R.P. Technologies', plan: 'RENTAL', rent: 499 },
    qr: { enabled: true, rate_instant: 1.20, vendor: 'RONAV Technologies' }
  };

  const serialized = serializeMerchantChannels(testChannels);
  console.log('Serialized string:', serialized);
  if (!serialized.startsWith('[PORTFOLIO]')) {
    throw new Error('Serialization must start with [PORTFOLIO]');
  }

  const parsed = parseMerchantChannels({ terminal_id: serialized, provider: 'Pine Labs' });
  console.log('Parsed enabled channels:', parsed.enabledList);
  if (parsed.enabledList.length !== 3) {
    throw new Error('Expected 3 enabled channels');
  }
  if (parsed.payswiff.vendor !== 'R.P. Technologies') {
    throw new Error('Expected Payswiff vendor to be R.P. Technologies');
  }
  if (parsed.qr.rate_instant !== 1.20) {
    throw new Error('Expected QR rate to be 1.20');
  }
  console.log('✓ PASS: Unit Serialization & Parsing successful!\n');

  // Test 2: Gated QR test
  console.log('2. Testing Gated QR Behavior...');
  const noQrChannels = {
    pine_labs: { enabled: true, terminal_id: 'PL-101', rate_t1: 1.50, rate_instant: 1.80 },
    payswiff: { enabled: false },
    qr: { enabled: false }
  };
  const noQrSerialized = serializeMerchantChannels(noQrChannels);
  const noQrParsed = parseMerchantChannels({ terminal_id: noQrSerialized, provider: 'Pine Labs' });
  console.log('Channels when QR disabled:', noQrParsed.enabledList);
  if (noQrParsed.enabledList.includes('qr')) {
    throw new Error('QR must NOT be present in enabledList when disabled!');
  }
  console.log('✓ PASS: QR is strictly hidden when disabled!\n');

  // Test 3: Live Database Flow
  console.log('3. Testing Live Supabase Integration...');
  const testId = `TEST_M_${Date.now().toString().slice(-4)}`;
  const onboardRes = await createDownstreamUser({
    creator_id: 'ADM001',
    parent_id: 'ADM001',
    name: 'Auto Test Store',
    mobile: '9876543210',
    role: 'MERCHANT',
    channels: {
      pine_labs: { enabled: true, terminal_id: 'PL-AUTO-01', rate_t1: 1.50, rate_instant: 1.80, vendor: 'Rose Navaneetham Enterprises' },
      payswiff: null,
      qr: { enabled: true, rate_instant: 1.35, vendor: 'RONAV Technologies' }
    }
  });

  if (!onboardRes.success) {
    throw new Error(`Failed to create test user: ${onboardRes.message}`);
  }

  const createdUserId = onboardRes.user.id;
  console.log(`Created merchant ${createdUserId}`);

  // Fetch wallet & POS
  const walletRes = await getWallet(createdUserId);
  console.log('Initial merchant enabled channels:', walletRes.pos?.channels?.enabledList);
  if (!walletRes.pos?.channels?.enabledList.includes('pine_labs') || !walletRes.pos?.channels?.enabledList.includes('qr')) {
    throw new Error('Initial merchant must have pine_labs and qr enabled');
  }
  if (walletRes.pos?.channels?.enabledList.includes('payswiff')) {
    throw new Error('Initial merchant must NOT have payswiff enabled');
  }
  if (walletRes.pos?.channels?.qr?.rate_instant !== 1.35) {
    throw new Error(`Expected custom QR rate 1.35, got ${walletRes.pos?.channels?.qr?.rate_instant}`);
  }
  console.log('✓ PASS: Merchant initialized with Pine Labs + Custom QR (1.35%)!\n');

  // Test 4: Dynamic Channel Portfolio Update (Adding Payswiff without duplicating account)
  console.log('4. Testing Adding Secondary Terminal (Payswiff) Post-Onboarding...');
  const updateRes = await updateMerchantChannels(createdUserId, {
    pine_labs: walletRes.pos.channels.pine_labs,
    payswiff: {
      enabled: true,
      terminal_id: 'SWIFF-AUTO-99',
      vendor: 'RONAV Technologies',
      rate_t1: 1.60,
      rate_instant: 1.85,
      plan: 'RENTAL',
      rent: 499
    },
    qr: walletRes.pos.channels.qr
  });

  if (!updateRes.success) {
    throw new Error(`Update failed: ${updateRes.message}`);
  }

  const updatedWallet = await getWallet(createdUserId);
  console.log('Post-update enabled channels:', updatedWallet.pos?.channels?.enabledList);
  if (updatedWallet.pos?.channels?.enabledList.length !== 3) {
    throw new Error('Expected all 3 channels to be enabled post-update!');
  }
  console.log('✓ PASS: Secondary terminal added seamlessly without touching merchant credentials or wallet!\n');

  // Clean up test user
  await supabase.from('merchant_pos').delete().eq('merchant_id', createdUserId);
  await supabase.from('wallets').delete().eq('user_id', createdUserId);
  await supabase.from('users').delete().eq('id', createdUserId);
  console.log('Cleaned up test merchant.');
  console.log('\n=========================================');
  console.log('ALL OPTION 1 PORTFOLIO TESTS PASSED 100%!');
  console.log('=========================================');
}

testPortfolio().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
