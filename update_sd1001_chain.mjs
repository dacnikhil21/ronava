async function fixChain() {
  const baseUrl = 'http://13.201.4.145';
  
  // Set SD1001 creator to MST1001, rate_t1 to 1.20%, rate_instant to 1.40%
  const res = await fetch(`${baseUrl}/api/users/update-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'SD1001',
      name: 'Ramana Super Dist',
      mobile: '6301646462',
      email: 'ramana6301@gmail.com'
    })
  }).then(r => r.json());

  console.log('Profile update:', res);
}

fixChain();
