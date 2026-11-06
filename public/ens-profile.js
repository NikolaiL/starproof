import { encodeFunctionData, getAddress, parseAbi, toHex, zeroAddress } from 'viem';
import { normalize, packetToBytes } from 'viem/ens';

export const PROFILE_KEYS = { captain: 'games.starproof.captain', ship: 'games.starproof.ship', logbook: 'games.starproof.logbook' };
export const resolverAbi = parseAbi([
  'function setText(bytes name,string key,string value)',
  'function multicall(bytes[] data) returns(bytes[])',
  'function grantSetterRoles(bytes setter,address account)',
  'function revokeRoles(uint256 resource,uint256 roleBitmap,address account)',
]);
export function profileNames(captain, ship) {
  const names = { captain: normalize(captain.trim()), ship: normalize(ship.trim()) };
  if (!names.captain.includes('.') || !names.ship.includes('.') || names.captain === names.ship) throw new Error('Choose two distinct, registered ENS names for captain and ship.');
  return names;
}
export function textCall(name, key, value) {
  return encodeFunctionData({ abi: resolverAbi, functionName: 'setText', args: [toHex(packetToBytes(name)), key, value] });
}
export async function readProfile(client, names) {
  const [captain, ship, linkedShip, linkedCaptain, logbook] = await Promise.all([
    client.getEnsAddress({ name: names.captain }), client.getEnsAddress({ name: names.ship }),
    client.getEnsText({ name: names.captain, key: PROFILE_KEYS.ship }),
    client.getEnsText({ name: names.ship, key: PROFILE_KEYS.captain }),
    client.getEnsText({ name: names.ship, key: PROFILE_KEYS.logbook }),
  ]);
  if (!captain || captain === zeroAddress || !ship || ship === zeroAddress || captain.toLowerCase() !== ship.toLowerCase()) throw new Error('Both ENS names must resolve to the same captain wallet. Set their address records in ENS first.');
  if (linkedShip !== names.ship || linkedCaptain !== names.captain) throw new Error('These names are not linked as a Starproof captain and ship yet. Publish their profile first.');
  return { ...names, address: getAddress(captain), logbook: logbook || '' };
}
export async function currentResolver(client, name) {
  const resolver = await client.getEnsResolver({ name });
  if (!resolver || resolver === zeroAddress) throw new Error('This ENS name has no resolver. Set up an ENSv2 Permissioned Resolver first.');
  return resolver;
}
