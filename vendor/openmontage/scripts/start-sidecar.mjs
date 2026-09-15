#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// When living under vendor/openmontage/scripts, adapter is at ../../packages/adapters
const adapterUrl = pathToFileURL(path.resolve(__dirname, '../../../packages/adapters/openmontage.mjs')).href;
const { startSidecar } = await import(adapterUrl);
const force = process.argv.includes('--force');
const result = await startSidecar({ force });
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
