async function createHierarchy() {
  const baseUrl = 'http://13.201.4.145';

  const usersToCreate = [
    {
      creator_id: 'ADM001',
      name: 'Balingam Master Partner',
      mobile: '9876543201',
      email: 'balingam.master@ronav.in',
      role: 'MASTER',
      password: 'Ronav@123',
      margin_rate: '0.75',
      commission_rate_t1: '1.00',
      commission_rate_instant: '1.20',
      channels: {
        pine_labs: { enabled: true, terminal_id: 'PL-MST1001', vendor: 'Rose Navaneetham Enterprises', plan: 'RENTAL', rent: '499', rate_t1: '1.00', rate_instant: '1.20' },
        payswiff: { enabled: true, terminal_id: 'SW-MST1001', vendor: 'RONAV Technologies', plan: 'RENTAL', rent: '499', rate_t1: '1.00', rate_instant: '1.20' },
        qr: { enabled: true, terminal_id: 'QR-MST1001', vendor: 'RONAV Technologies', plan: 'LIFETIME', rent: '0', rate_t1: '1.00', rate_instant: '1.20' }
      }
    },
    {
      creator_id: 'MST1001',
      name: 'Ramana Super Dist',
      mobile: '6301646462',
      email: 'ramana.sd@ronav.in',
      role: 'SUPER_DISTRIBUTOR',
      password: 'Ronav@123',
      margin_rate: '0.50',
      commission_rate_t1: '1.20',
      commission_rate_instant: '1.40',
      channels: {
        pine_labs: { enabled: true, terminal_id: 'PL-SD1001', vendor: 'Rose Navaneetham Enterprises', plan: 'RENTAL', rent: '499', rate_t1: '1.20', rate_instant: '1.40' },
        payswiff: { enabled: true, terminal_id: 'SW-SD1001', vendor: 'RONAV Technologies', plan: 'RENTAL', rent: '499', rate_t1: '1.20', rate_instant: '1.40' },
        qr: { enabled: true, terminal_id: 'QR-SD1001', vendor: 'RONAV Technologies', plan: 'LIFETIME', rent: '0', rate_t1: '1.20', rate_instant: '1.40' }
      }
    },
    {
      creator_id: 'SD1001',
      name: 'Bravo District Partner',
      mobile: '9876543203',
      email: 'bravo.dd@ronav.in',
      role: 'DIST_FRANCHISE',
      password: 'Ronav@123',
      margin_rate: '0.35',
      commission_rate_t1: '1.40',
      commission_rate_instant: '1.60',
      channels: {
        pine_labs: { enabled: true, terminal_id: 'PL-DD1001', vendor: 'Rose Navaneetham Enterprises', plan: 'RENTAL', rent: '499', rate_t1: '1.40', rate_instant: '1.60' },
        payswiff: { enabled: true, terminal_id: 'SW-DD1001', vendor: 'RONAV Technologies', plan: 'RENTAL', rent: '499', rate_t1: '1.40', rate_instant: '1.60' },
        qr: { enabled: true, terminal_id: 'QR-DD1001', vendor: 'RONAV Technologies', plan: 'LIFETIME', rent: '0', rate_t1: '1.40', rate_instant: '1.60' }
      }
    },
    {
      creator_id: 'DD1001',
      name: 'Charlie Area Dist',
      mobile: '9876543204',
      email: 'charlie.dist@ronav.in',
      role: 'DISTRIBUTOR',
      password: 'Ronav@123',
      margin_rate: '0.25',
      commission_rate_t1: '1.60',
      commission_rate_instant: '1.80',
      channels: {
        pine_labs: { enabled: true, terminal_id: 'PL-DIST1001', vendor: 'Rose Navaneetham Enterprises', plan: 'RENTAL', rent: '499', rate_t1: '1.60', rate_instant: '1.80' },
        payswiff: { enabled: true, terminal_id: 'SW-DIST1001', vendor: 'RONAV Technologies', plan: 'RENTAL', rent: '499', rate_t1: '1.60', rate_instant: '1.80' },
        qr: { enabled: true, terminal_id: 'QR-DIST1001', vendor: 'RONAV Technologies', plan: 'LIFETIME', rent: '0', rate_t1: '1.60', rate_instant: '1.80' }
      }
    },
    {
      creator_id: 'DIST1001',
      name: 'Retail Merchant Store',
      mobile: '9876543205',
      email: 'merchant.store@ronav.in',
      role: 'MERCHANT',
      password: 'Ronav@123',
      margin_rate: '0.00',
      commission_rate_t1: '1.80',
      commission_rate_instant: '2.00',
      channels: {
        pine_labs: { enabled: true, terminal_id: 'PL-MID1001', vendor: 'Rose Navaneetham Enterprises', plan: 'RENTAL', rent: '499', rate_t1: '1.80', rate_instant: '2.00' },
        payswiff: { enabled: true, terminal_id: 'SW-MID1001', vendor: 'RONAV Technologies', plan: 'RENTAL', rent: '499', rate_t1: '1.80', rate_instant: '2.00' },
        qr: { enabled: true, terminal_id: 'QR-MID1001', vendor: 'RONAV Technologies', plan: 'LIFETIME', rent: '0', rate_t1: '1.80', rate_instant: '2.00' }
      }
    }
  ];

  console.log('🚀 Creating 5-Tier Connected Hierarchy on AWS Live Server...\n');

  for (const uData of usersToCreate) {
    try {
      const res = await fetch(`${baseUrl}/api/users/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(uData)
      });
      const data = await res.json();
      console.log(`[${uData.role}] ${uData.name}:`, data.success ? `✅ Created (ID: ${data.user?.id})` : `❌ Error: ${data.message}`);
    } catch (e) {
      console.error(`Failed to create ${uData.name}:`, e.message);
    }
  }

  console.log('\n🔍 Verifying all live users on AWS:');
  const allRes = await fetch(`${baseUrl}/api/users`).then(r => r.json());
  console.table(allRes.users?.map(u => ({ id: u.id, name: u.name, role: u.role, creator: u.creator_id, mobile: u.mobile, rate_t1: u.commission_rate_t1 })));
}

createHierarchy();
