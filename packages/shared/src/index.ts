export * from './features.js';
export * from './enums.js';

let lastTimestamp = -1n;
let sequence = 0n;
const NODE_ID = BigInt((typeof process !== 'undefined' && process.pid ? process.pid : Math.floor(Math.random() * 1024)) & 1023);
const EPOCH = 1704067200000n; // 2024-01-01T00:00:00Z

export function nextSnowflakeId(): bigint {
  let now = BigInt(Date.now());
  if (now <= lastTimestamp) {
    now = lastTimestamp;
    sequence = (sequence + 1n) & 4095n;
    if (sequence === 0n) {
      now = lastTimestamp + 1n;
    }
  } else {
    sequence = 0n;
  }
  lastTimestamp = now;
  return ((now - EPOCH) << 22n) | (NODE_ID << 12n) | sequence;
}
