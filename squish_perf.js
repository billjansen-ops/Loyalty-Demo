// Squish/Unsquish Performance Test
// 1 million round trips - measure speed

// squish127: convert number to base-127 bytes
function squish127(value, bytes) {
  const buffer = Buffer.alloc(bytes);
  let remaining = value;
  for (let i = 0; i < bytes; i++) {
    buffer[i] = (remaining % 127) + 1;
    remaining = Math.floor(remaining / 127);
  }
  return buffer.toString('latin1');
}

// unsquish127: convert base-127 string back to number
function unsquish127(str) {
  let value = 0;
  for (let i = str.length - 1; i >= 0; i--) {
    value = value * 127 + (str.charCodeAt(i) - 1);
  }
  return value;
}

const iterations = 1_000_000;
const bytes = 5;  // Test with 5-byte (activity.link size)

console.log(`Testing ${iterations.toLocaleString()} squish/unsquish round trips (${bytes} bytes)\n`);

let errors = 0;

const start = performance.now();

for (let i = 1; i <= iterations; i++) {
  const squished = squish127(i, bytes);
  const unsquished = unsquish127(squished);
  if (unsquished !== i) {
    errors++;
  }
}

const end = performance.now();
const elapsed = end - start;
const perSecond = Math.round(iterations / (elapsed / 1000));

console.log(`Completed: ${iterations.toLocaleString()} iterations`);
console.log(`Time: ${elapsed.toFixed(2)} ms`);
console.log(`Rate: ${perSecond.toLocaleString()} round-trips/second`);
console.log(`Errors: ${errors}`);
