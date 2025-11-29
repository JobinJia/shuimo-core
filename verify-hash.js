// Node.js script to verify hash function produces same results as original

// Simulate original hash function
function originalHash(x) {
  const jsonStr = JSON.stringify(x);
  // In browser: window.btoa(jsonStr)
  // In Node: Buffer.from(jsonStr).toString('base64')
  const encoded = Buffer.from(jsonStr).toString('base64');

  let z = 0;
  for (let i = 0; i < encoded.length; i++) {
    z += encoded.charCodeAt(i) * Math.pow(128, i);
  }
  return z;
}

// Simulate PRNG seed function
function simulateSeed(x, hashFunc) {
  const p = 999979;
  const q = 999983;
  const m = p * q;

  let y = 0;
  let z = 0;

  while (y % p === 0 || y % q === 0 || y === 0 || y === 1) {
    y = (hashFunc(x) + z) % m;
    z += 1;
  }

  return y;
}

// Test with various seeds
const testSeeds = [
  'test-123',
  '1733151234567-abc',
  '12345',
  'woody-plant',
  'herbal-plant'
];

console.log('='.repeat(70));
console.log('Hash Function Verification');
console.log('='.repeat(70));
console.log('');

testSeeds.forEach(seed => {
  const intSeed = simulateSeed(seed, originalHash);
  console.log(`Seed: "${seed}"`);
  console.log(`  -> int seed: ${intSeed}`);
  console.log('');
});

console.log('='.repeat(70));
console.log('Copy these "int seed" values and compare with browser console output');
console.log('when testing the SVG implementation');
console.log('='.repeat(70));
