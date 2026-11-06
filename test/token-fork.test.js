import test from 'node:test';
import assert from 'node:assert/strict';
import { TOKEN } from '../public/token.js';

const forkUrl = process.env.BASE_FORK_URL;
test('the deployed STARPROOF token transfers the exact reward on a local Base fork', { skip: !forkUrl }, async () => {
  const url = new URL(forkUrl);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'writes are allowed only against a local fork');
  let id = 0;
  const rpc = async (method, params = []) => {
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) });
    const reply = await response.json();
    if (reply.error) throw new Error(method + ': ' + reply.error.message);
    return reply.result;
  };
  assert.equal(BigInt(await rpc('eth_chainId')), 31337n, 'require an explicitly configured local test chain');
  const word = value => value.replace(/^0x/, '').toLowerCase().padStart(64, '0');
  const call = data => rpc('eth_call', [{ to: TOKEN.address, data }, 'latest']);
  const balance = async address => BigInt(await call('0x70a08231' + word(address)));
  assert.notEqual(await rpc('eth_getCode', [TOKEN.address, 'latest']), '0x');
  assert.equal(BigInt(await call('0x313ce567')), BigInt(TOKEN.decimals));
  assert.equal(TOKEN.claimAmountUnits, (BigInt(TOKEN.claimAmount) * 10n ** BigInt(TOKEN.decimals)).toString());
  const owner = '0x8D6230427a37986D25Fe4D5B3d0aaEF1b924fEd6';
  const first = '0x1111111111111111111111111111111111111111', second = '0x2222222222222222222222222222222222222222';
  const amount = BigInt(TOKEN.claimAmountUnits), snapshot = await rpc('evm_snapshot');
  try {
    for (const [from, to] of [[owner, first], [first, second]]) {
      const before = await balance(to);
      await rpc('anvil_impersonateAccount', [from]);
      try {
        await rpc('anvil_setBalance', [from, '0x8ac7230489e80000']);
        const hash = await rpc('eth_sendTransaction', [{ from, to: TOKEN.address, data: '0xa9059cbb' + word(to) + amount.toString(16).padStart(64, '0'), gas: '0x7a120' }]);
        let receipt;
        const deadline = Date.now() + 20_000;
        while (!(receipt = await rpc('eth_getTransactionReceipt', [hash])) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
        assert.equal(receipt?.status, '0x1', 'the local fork transfer must confirm successfully');
        assert.equal(await balance(to) - before, amount, 'ordinary transfers must deliver exactly 1,000 tokens');
      } finally { await rpc('anvil_stopImpersonatingAccount', [from]); }
    }
  } finally { await rpc('evm_revert', [snapshot]); }
});
