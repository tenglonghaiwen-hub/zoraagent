export const MINIMAX_BASE='https://api.minimax.cn';
export function minimaxCredentials(key=process.env.MINIMAX_API_KEY){if(!key?.trim())throw Error('未配置 MiniMax 官方 MINIMAX_API_KEY；不会回退到中转密钥');return {base:MINIMAX_BASE,key:key.trim()};}
