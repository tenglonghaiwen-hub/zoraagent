import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
// Installed builds keep mutable state outside the application directory.
export const dataPath=(...parts)=>path.join(process.env.ZORA_DATA_DIR||path.join(root,'data'),...parts);
export const workspacePath=()=>process.env.ZORA_WORKSPACE_ROOT||path.join(root,'workspace');
export const bridgePath=name=>path.join(process.env.ZORA_BRIDGE_DIRECTORY||dataPath(),name);
