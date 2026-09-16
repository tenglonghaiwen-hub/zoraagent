import {validatePptx} from '../packages/agent/pptx-validation.mjs';
const result=validatePptx(process.argv[2]);
console.log(JSON.stringify(result,null,2));
process.exitCode=result.ok?0:1;
