# Hardware-controlled ERC-20 airdrop

Status: implementation prepared and tested on a local Base fork; no distributor has been deployed or funded on mainnet. The token is [STARPROOF on Base](TOKEN_LAUNCH_DRAFT.md), `0x469F27BC9CA19d78455867aAFc7aA4186d3cCccC`, with 18 decimals. Each eligible Trust M chip receives 1,000 tokens once per campaign. The administrator is the token deployment wallet, `0x8D6230427a37986D25Fe4D5B3d0aaEF1b924fEd6`, as selected by the user.

## Recommended device flow

Keep Starproof running. Receiving an ERC-20 transfer does not require the recipient Safe to send a transaction, so switching to Safe Signer for every claim is unnecessary. Device app 0.5.0 adds a dedicated proof command and confirmation screens.

The small `safe_prove` flow is adapted into the Starproof device app without importing all of Safe Signer. Reuse the existing chip connection. Read the initialized Safe public key from `DATA[11]` and inspect its and `KEY2`'s metadata. Require an already initialized, locked key; the approved proof signature validates the stored public key against it. Never call Safe Signer's startup helper: it can finish locking an interrupted setup. Starproof must not generate, replace, lock, or write wallet keys or public-key objects. Missing or incomplete setup goes through the official Safe Signer separately.

After physical approval, produce the two existing proof signatures: the Safe key signs the fresh claim challenge, and the factory key signs the Safe public-key binding. Return the certificate and signatures through a namespaced Starproof request. Pause navigation and other requests during approval; cancellation may deny, never approve. Returning from the prompt resumes gameplay without a reboot or another installation.

The upstream `safe_prove` screen accepts only a 24-character label and keeps its challenge code offscreen. Adapt its UI so the user reviews the full recipient address, token, network and amount before approving. Include every claim field in the exact signed payload. Do not silently inherit the abbreviated upstream screen.

## Wallet and chip identity

- The payout recipient is a deployed Safe smart-account address. Safe Signer's displayed owner/signer contract address is not the receiving wallet.
- Derive the signer-owner address from the proven P-256 public key using the pinned Safe passkey factory configuration. Discover candidate Safes, then verify the selected Safe's supported proxy/implementation and onchain ownership. A self-reported list or an arbitrary contract returning `isOwner=true` is insufficient.
- Verify the factory certificate chain and both signatures; compare the factory certificate with the game-connected chip when a mission identity exists. Treat the reported Pico UID only as a USB reconnect hint.
- The canonical device identity is SHA-256 of the validated factory P-256 public key encoded as `04 || X32 || Y32`. A certificate fingerprint is retained only for audit: alternative valid ECDSA certificate signatures can change its DER hash without changing the chip key. Use a campaign-specific hash of that identity as the claim identifier. New browser sessions, different Safes and game resets must not reset eligibility.

## Payout and permanent claim storage

Use a small, prefunded distributor contract plus an offchain proof verifier. The verifier issues an EIP-712 voucher binding campaign, device claim identifier, recipient Safe, token, amount, chain, distributor and deadline. The preceding chip proof also binds a fresh server nonce. A relayer can submit it, so the recipient needs neither gas nor a wallet transaction approval.

The contract fixes the token and amount, rejects used device identifiers, records consumption and transfers atomically using SafeERC20 and reentrancy protection. A reverted transfer leaves the claim available; a successful claim stays consumed onchain. Retries must reuse the same claim identifier and recipient. Display success only after a successful receipt and reconcile pending transactions after reload.

Configure 1,000 whole tokens using the verified token decimals, not a presumed 18 decimals. Inspect the selected token for transfer fees, rebasing or restrictions before promising an exact received amount. Fund the distributor explicitly; it does not mint an existing ERC-20 unless separately authorized to do so.

The existing game Redis records expire after two idle hours. They cannot be the permanent airdrop claim ledger. Game artifact claims and demo confirmation switches must never bypass airdrop approval or eligibility.

## Trust boundary and validation

Certificate verification remains offchain, so the distributor trusts the voucher issuer's enrollment decisions. A compromised issuer could authorize fake identities against the funded budget. The proof establishes certified-chip participation; it does not attest the complete Wedgie assembly, approved firmware or a unique human. Replacing the secure chip creates a different chip identity.

Before deployment, test the configured chain/token on a local fork: both proof signatures, substituted recipient/key/certificate, expired/replayed vouchers, simultaneous claims, different-wallet repeats, decimals, failed token transfers, relayer retries and Safe ownership validation. Test physical approval, cancellation, RAM and return to gameplay on hardware. No mainnet funds or keys were changed during implementation.

## Sources checked

- [Wedgie Safe guide](https://wedgie.dev/safe.md): `safe_prove`, Safe owner versus wallet, initialization.
- [Safe Signer proof source, reviewed snapshot](https://github.com/clawdbotatg/wedgie-safe/blob/0b1c19cb095ea433db29202c4a090b6dddc332b6/safe_msg.py): proof preimages, physical keys and display limits. This is a research snapshot, not an installation approval.
- [Safe key handling](https://github.com/clawdbotatg/wedgie-safe/blob/0b1c19cb095ea433db29202c4a090b6dddc332b6/safe_key.py): public-key storage, validation and startup locking behavior.
- [Trust M guide](https://wedgie.dev/trustm.md): factory identity and reserved Safe slots.
- [Firmware cartridge slot](https://github.com/clawdbotatg/wedgie-dev/blob/main/firmware/slot.py): changing apps installs and restarts the active app.
- [Safe ownership API](https://docs.safe.global/reference-smart-account/owners/isOwner) and [SafeERC20](https://docs.openzeppelin.com/contracts/5.x/api/token/erc20#SafeERC20).


## Configure and deploy

1. Use a dedicated server-side proof-issuer account, separate from the administrator. Set its private key as `AIRDROP_ISSUER_PRIVATE_KEY` and a private Base RPC URL as `AIRDROP_RPC_URL` in server secrets. Never send private keys in chat. Creating a new key requires the user’s instruction under this workspace’s AGENTS.md.
2. Open `/airdrop-setup.html`, verify the full public issuer address and source, and use the token deployment wallet to review and deploy the contract. This page prepares wallet transactions; the wallet signs them.
3. Choose the number of 1,000-token claims to fund. There is no default funding budget. The wallet reviews a separate ERC-20 transfer into the newly deployed distributor.
4. Pin the confirmed distributor address in `AIRDROP_CONTRACT`. The backend checks its compiled runtime, fixed token/amount/campaign, owner and issuer before enabling claims. Fund only the dedicated issuer’s gas balance with the chosen relay budget.
5. Connect Wedgie to install device app 0.5.0, then test both physical review pages, browser cancellation and a complete claim. Device RAM and physical behavior have not yet been verified for this version.

The UI lists supported deployed Safe 1.4.1 accounts owned by the proven signer, allows an explicitly entered address, and verifies proxy and singleton bytecode plus onchain ownership. Safes created by the current official Wedgie flow use this version. Older versions require separate support rather than being silently accepted.

Redis holds durable relay transactions outside the expiring game session. A transaction is signed and persisted before broadcasting, so an interrupted request retries the same bytes. A per-distributor relay lease serializes nonce preparation. Keep its issuer account dedicated to this single distributor; sharing it across contracts would introduce cross-contract nonce races. Consumed/replaced nonces are reconciled; a persistently underpriced pending transaction still requires operator fee replacement. Successful device claims remain onchain independently of this operational state.

## Local verification

```sh
npm ci
git submodule update --init --recursive
npm test
npm run contracts:build
npm run test:contracts
# Start an isolated local fork; never point writable tests at mainnet.
anvil --fork-url "$BASE_RPC_URL" --fork-block-number 53986156 --chain-id 31337 --port 18545
BASE_FORK_URL=http://127.0.0.1:18545 npm run test:fork
BASE_FORK_URL=http://127.0.0.1:18545 npm run test:contracts
```

Solidity uses OpenZeppelin Contracts 5.6.1; Foundry tests use forge-std v1.9.7. The committed JS artifact is checked by `forge build && node tools/sync-airdrop.js --check`. `lib/safe.js` derives the owner using Wedgie’s MIT constants and checks canonical Safe 1.4.1 runtime hashes from the published Safe artifacts. The Safe package was used only for artifact verification and is not a runtime dependency.
