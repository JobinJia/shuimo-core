# Debugging Seed Consistency Issue

## Test Steps

### 1. Open FlowerCompare page
- URL: http://localhost:3000/flower-compare
- Open browser console (F12)

### 2. Input test seed
- Enter seed: `test-123`
- Click "Generate Both"

### 3. Check console output

Expected output for **BOTH** sides:

```
['int seed', 499469522675]  // Hash value for 'test-123'
```

This value comes from:
- Original: reference-code/flowers/main.js line 57
- SVG: packages/core/src/drawing/flower/FlowerPRNG.ts line 70

### 4. If int seed values don't match

**Problem**: Hash function is still different
**Check**:
- Is btoa() available in browser?
- Are both using same hash algorithm?

### 5. If int seed values match BUT flowers are different

**Possible causes**:

a) **Random sequence offset**
   - Add debug logging to count random() calls
   - Check if noise initialization happens at same time

b) **Plant type mismatch**
   - Original uses `Math.random() <= 0.5` to decide
   - SVG should also use 'random' type (FIXED in FlowerCompare.vue)

c) **Parameter generation difference**
   - Original: genParams() in woody()/herbal()
   - SVG: same genParams() should be called

d) **Noise initialization timing**
   - Should happen during first paper() call
   - Consumes 4096 random() calls

### 6. Manual verification

Run this in console BEFORE generating:

```javascript
// Test Original PRNG
Math.seed('test-123');
const orig1 = Math.random();
const orig2 = Math.random();
const orig3 = Math.random();
console.log('Original first 3:', [orig1, orig2, orig3]);

// Test SVG PRNG
import { seedPRNG, random } from '@shuimo/core';
seedPRNG('test-123');
// Note: warm-up already done in seed()
const svg1 = Math.random(); // should use overridden Math.random
const svg2 = Math.random();
const svg3 = Math.random();
console.log('SVG first 3:', [svg1, svg2, svg3]);
```

**Expected**: Both arrays should be IDENTICAL

### 7. Count random() calls

Add this to track calls:

```javascript
let callCount = 0;
const originalRandom = Math.random;
Math.random = function() {
  callCount++;
  const result = originalRandom.call(this);
  if (callCount <= 20) {
    console.log(`Random call #${callCount}: ${result}`);
  }
  return result;
};
```

Then generate and check if call counts match at key points:
- After noise init: should be ~4106 (10 warmup + 4096 noise)
- After paper: should be ~66000+
- After plant type decision: +1

## Known Issues Fixed

1. ✅ Hash function - added btoa() encoding
2. ✅ PatternId - using seed-based ID instead of Math.random()
3. ✅ FlowerCompare.vue - using 'random' type
