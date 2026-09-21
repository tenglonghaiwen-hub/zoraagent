import {AsyncLocalStorage} from 'node:async_hooks';
export const cloudAgentContext=new AsyncLocalStorage();
const relay=process.env.ZORA_CLOUD_RELAY;
export const CLOUD_AGENT_GATEWAY=relay&&/^http:\/\/127\.0\.0\.1:\d+\/[a-f0-9]{64}$/.test(relay)?relay:'https://zora-api.tenglonghaiwen.workers.dev';
