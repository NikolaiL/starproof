import {readFile,writeFile} from 'node:fs/promises';
const compiled=JSON.parse(await readFile(new URL('../out/StarproofAirdrop.sol/StarproofAirdrop.json',import.meta.url),'utf8'));
const output=JSON.stringify({abi:compiled.abi,bytecode:compiled.bytecode.object,deployedBytecode:compiled.deployedBytecode.object,immutableReferences:compiled.deployedBytecode.immutableReferences});
const target=new URL('../lib/airdrop-artifact.json',import.meta.url);
if(process.argv.includes('--check')){if(await readFile(target,'utf8')!==output)throw new Error('Rebuild the committed airdrop artifact.');}
else await writeFile(target,output);
