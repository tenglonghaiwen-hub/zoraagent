import {AsyncLocalStorage} from 'node:async_hooks';
export const cloudAgentContext=new AsyncLocalStorage();
export const CLOUD_AGENT_GATEWAY='https://zora-api.tenglonghaiwen.workers.dev';
