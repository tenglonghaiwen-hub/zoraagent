import { callBrowser } from '../browser-client.mjs';
import { callDesktop } from '../desktop-client.mjs';

/**
 * Handle browser and desktop tools.
 * Returns undefined if the tool name doesn't match.
 */
export async function handleBrowserTool(name, args) {
  if (name === 'desktop_control') {
    if(!['focus','openApp','listWindows','readWindow','captureWindow','click','type','keys'].includes(args.action))return {ok:false,error:'不支持的桌面操作'};
    return callDesktop({...args,scope:'desktop'});
  }
  if (name === 'desktop_apps') {
    if(!['listApps','launchApp'].includes(args.action))return {ok:false,error:'不支持的应用操作'};
    return callDesktop(args);
  }
  if (name === 'desktop_jianying') {
    return callDesktop(args);
  }
  if (name === 'browser_open' || name === 'browser_search' || name === 'browser_read') {
    return callBrowser({ ...args, action: name.slice(8) });
  }
  return undefined;
}
