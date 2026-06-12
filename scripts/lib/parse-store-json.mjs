#!/usr/bin/env node
/**
 * Parse JSON from `shopify store execute -j` output (strips CLI progress lines).
 */
import { readFileSync } from 'node:fs';

const raw = readFileSync(0, 'utf8');
const jsonStart = raw.indexOf('{');
if (jsonStart === -1) {
  console.error('No JSON found in store execute output');
  process.exit(1);
}

const data = JSON.parse(raw.slice(jsonStart));
const payload = data.data ?? data;
process.stdout.write(JSON.stringify(payload));
