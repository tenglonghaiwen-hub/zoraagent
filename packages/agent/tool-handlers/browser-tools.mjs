import { callBrowser } from '../browser-client.mjs';
import { callDesktop } from '../desktop-client.mjs';

/**
 * Handle browser and desktop tools.
 * Returns undefined if the tool name doesn't match.
 */
export async function handleBrowserTool(name, args) {
  if (name === 'desktop_jianying') {
    return callDesktop(args);
  }
  if (name === 'browser_open' || name === 'browser_search' || name === 'browser_read') {
    return callBrowser({ ...args, action: name.slice(8) });
  }
  return undefined;
}
