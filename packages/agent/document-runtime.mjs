import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
export function documentRuntimeInstructions(){
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'runtime/runtime-manifest.json'),'utf8'));
 return `文档运行环境：应用根目录 ${JSON.stringify(root)}；包内 Node ${JSON.stringify(path.join(root,manifest.nodeRelativePath))}。生成脚本请保存到工作区，用 createRequire(${JSON.stringify(path.join(root,'package.json'))}) 加载包内 pptxgenjs、exceljs、docx、pdf-lib，不依赖工作区 node_modules 或系统 Python。生成 PPTX 时使用成熟库，不手写 ZIP/XML。交付前用包内 Node 执行 ${JSON.stringify(path.join(root,'scripts/validate-pptx.mjs'))} 并传入文件绝对路径。校验失败先修复；结构检查不代表已验证 WPS 渲染。\n`;
}
