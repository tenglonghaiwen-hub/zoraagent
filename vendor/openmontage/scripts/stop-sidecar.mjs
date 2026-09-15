#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const adapterUrl = pathToFileURL(path.resolve(__dirname, '../../../packages/adapters/openmontage.mjs')).href;
const { stopSidecar } = await import(adapterUrl);
const result = await stopSidecar();
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
