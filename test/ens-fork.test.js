import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPublicClient, createWalletClient, encodeFunctionData, http, parseAbi, toHex, zeroAddress } from 'viem';
import { sepolia } from 'viem/chains';
import { packetToBytes } from 'viem/ens';
import { profileNames, readProfile, publishProfile, delegateLogbook, writeLogbook } from '../vendor/collectibles.js';

// Official ENSv2 Sepolia deployments at ensdomains/contracts-v2 commit 07e55a0.
// Only local fork state is changed. Registrar impersonation seeds fixtures; it is not a registration/payment demo.
const ETH_REGISTRY = '0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4';
const ETH_REGISTRAR = '0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3';
const RESOLVER_IMPL = '0x115eb53F0c60696633855F90b138178Fb40b2b2C';
const REGISTRY_IMPL = '0x9bd8a88719068d09ecee662f36c0e3856708366a';
const url = process.env.SEPOLIA_FORK_URL;
test('ENSv2 fork: captain and nested ship resolve through the real hierarchy, publish records, and enforce navigator revocation', {skip:!url,timeout:90000}, async t => {
  assert.ok(['localhost','127.0.0.1'].includes(new URL(url).hostname), 'write only to an explicitly local fork');
  const client = createPublicClient({chain:sepolia,transport:http(url)});
  assert.equal(await client.getChainId(),sepolia.id);
  const snapshot = await client.request({method:'evm_snapshot'});
  t.after(() => client.request({method:'evm_revert',params:[snapshot]}));
  const captain = '0x1234567890123456789012345678901234567890';
  const navigator = '0x2222333344445555666677778888999900001111';
  for (const address of [captain,navigator,ETH_REGISTRAR]) {
    await client.request({method:'anvil_impersonateAccount',params:[address]});
    await client.request({method:'anvil_setBalance',params:[address,'0x8ac7230489e80000']});
  }
  const wallet = createWalletClient({account:captain,chain:sepolia,transport:http(url)});
  const connection = {account:captain,client,wallet};
  const proxy = JSON.parse(await readFile(new URL('../out/ERC1967Proxy.sol/ERC1967Proxy.json',import.meta.url)));
  async function deployProxy(implementation,data) {
    assert.notEqual(await client.getCode({address:implementation}),undefined);
    const receipt = await client.waitForTransactionReceipt({hash:await wallet.deployContract({abi:proxy.abi,bytecode:proxy.bytecode.object,args:[implementation,data]})});
    assert.equal(receipt.status,'success');return receipt.contractAddress;
  }
  const label = 'starcaptain-fork-' + Date.now();
  const names = profileNames(label + '.eth','starship.' + label + '.eth');
  const resolverInit = parseAbi(['function initialize((address account,uint256 roleBitmap)[] grants,bytes[] calls)','function setAddress(bytes name,uint256 coinType,bytes addressBytes)']);
  const registryAbi = parseAbi(['function initialize((address account,uint256 roleBitmap)[] grants)','function setParent(address parent,string label)','function register(string label,address owner,address registry,address resolver,uint256 roleBitmap,uint64 expiry) returns(uint256)']);
  const resolvers = [];
  for (const name of [names.captain,names.ship]) {
    const roleBitmap = 17n | (17n << 128n); // Address/text roles and their delegating admins.
    const initial = encodeFunctionData({abi:resolverInit,functionName:'setAddress',args:[toHex(packetToBytes(name)),60n,captain]});
    const resolver = await deployProxy(RESOLVER_IMPL,encodeFunctionData({abi:resolverInit,functionName:'initialize',args:[[{account:captain,roleBitmap}],[]]}));
    // Self-multicall has no runtime during an ERC1967Proxy constructor; seed records after deployment.
    assert.equal((await client.waitForTransactionReceipt({hash:await wallet.sendTransaction({to:resolver,data:initial})})).status,'success');
    resolvers.push(resolver);
  }
  const registry = await deployProxy(REGISTRY_IMPL,encodeFunctionData({abi:registryAbi,functionName:'initialize',args:[[{account:captain,roleBitmap:257n}]]}));
  const send = async (sender,address,functionName,args) => {
    const w = createWalletClient({account:sender,chain:sepolia,transport:http(url)});
    const {request} = await client.simulateContract({account:sender,address,abi:registryAbi,functionName,args});
    assert.equal((await client.waitForTransactionReceipt({hash:await w.writeContract(request)})).status,'success');
  };
  await send(captain,registry,'setParent',[ETH_REGISTRY,label]);
  const expiry = (await client.getBlock()).timestamp + 86400n;
  await send(ETH_REGISTRAR,ETH_REGISTRY,'register',[label,captain,registry,resolvers[0],0n,expiry]);
  await send(captain,registry,'register',['starship',captain,zeroAddress,resolvers[1],0n,expiry]);
  assert.equal(await client.getEnsAddress({name:names.ship}),captain);
  const profile = await publishProfile(connection,names);
  assert.equal(profile.captain,names.captain);assert.equal(profile.ship,names.ship);
  await delegateLogbook(connection,names,navigator);
  const nav = {account:navigator,client,wallet:createWalletClient({account:navigator,chain:sepolia,transport:http(url)})};
  await writeLogbook(nav,names,'Reached Kepler');
  assert.equal((await readProfile(client,names)).logbook,'Reached Kepler');
  await assert.rejects(publishProfile(nav,names),/connected wallet/);
  await delegateLogbook(connection,names,navigator,true);
  await assert.rejects(writeLogbook(nav,names,'This must not publish'));
  assert.equal((await readProfile(client,names)).logbook,'Reached Kepler');
});
