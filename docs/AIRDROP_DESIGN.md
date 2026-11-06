# Hardware-controlled ERC-20 airdrop

Status: proposed design, not implemented. The user selected an existing ERC-20; its network and contract address are pending. Each eligible Trust M chip should receive 1,000 tokens once per campaign.

## Recommended device flow

Keep Starproof running. Receiving an ERC-20 transfer does not require the recipient Safe to send a transaction, so switching to Safe Signer for every claim is unnecessary. One Starproof app update would add a dedicated proof command and confirmation screen.

Adapt the small `safe_prove` routine into the Starproof device app rather than importing all of Safe Signer. Reuse the existing chip connection. Read the initialized Safe public key from `DATA[11]` and inspect its and `KEY2`'s metadata. Require an already initialized, locked key; the approved proof signature validates the stored public key against it. Never call Safe Signer's startup helper: it can finish locking an interrupted setup. Starproof must not generate, replace, lock, or write wallet keys or public-key objects. Missing or incomplete setup goes through the official Safe Signer separately.

After physical approval, produce the two existing proof signatures: the Safe key signs the fresh claim challenge, and the factory key signs the Safe public-key binding. Return the certificate and signatures through a namespaced Starproof request. Pause navigation and other requests during approval; cancellation may deny, never approve. Returning from the prompt resumes gameplay without a reboot or another installation.

The upstream `safe_prove` screen accepts only a 24-character label and keeps its challenge code offscreen. Adapt its UI so the user reviews the full recipient address, token, network and amount before approving. Include every claim field in the exact signed payload. Do not silently inherit the abbreviated upstream screen.

## Wallet and chip identity

- The payout recipient is a deployed Safe smart-account address. Safe Signer's displayed owner/signer contract address is not the receiving wallet.
- Derive the signer-owner address from the proven P-256 public key using the pinned Safe passkey factory configuration. Discover candidate Safes, then verify the selected Safe's supported proxy/implementation and onchain ownership. A self-reported list or an arbitrary contract returning `isOwner=true` is insufficient.
- Verify the factory certificate chain and both signatures; compare the factory certificate with the game-connected chip when a mission identity exists. Treat the reported Pico UID only as a USB reconnect hint.
- The canonical device identity is SHA-256 of the validated certificate's DER bytes. Use a campaign-specific hash of that identity as the claim identifier. New browser sessions, different Safes and game resets must not reset eligibility.

## Payout and permanent claim storage

Use a small, prefunded distributor contract plus an offchain proof verifier. The verifier issues an EIP-712 voucher binding campaign, device claim identifier, recipient Safe, token, amount, chain, distributor, nonce and deadline. A relayer can submit it, so the recipient needs neither gas nor a wallet transaction approval.

The contract fixes the token and amount, rejects used device identifiers, records consumption and transfers atomically using SafeERC20 and reentrancy protection. A reverted transfer leaves the claim available; a successful claim stays consumed onchain. Retries must reuse the same claim identifier and recipient. Display success only after a successful receipt and reconcile pending transactions after reload.

Configure 1,000 whole tokens using the verified token decimals, not a presumed 18 decimals. Inspect the selected token for transfer fees, rebasing or restrictions before promising an exact received amount. Fund the distributor explicitly; it does not mint an existing ERC-20 unless separately authorized to do so.

The existing game Redis records expire after two idle hours. They cannot be the permanent airdrop claim ledger. Game artifact claims and demo confirmation switches must never bypass airdrop approval or eligibility.

## Trust boundary and validation

Certificate verification remains offchain, so the distributor trusts the voucher issuer's enrollment decisions. A compromised issuer could authorize fake identities against the funded budget. The proof establishes certified-chip participation; it does not attest the complete Wedgie assembly, approved firmware or a unique human. Replacing the secure chip creates a different chip identity.

Before deployment, test the configured chain/token on a local fork: both proof signatures, substituted recipient/key/certificate, expired/replayed vouchers, simultaneous claims, different-wallet repeats, decimals, failed token transfers, relayer retries and Safe ownership validation. Test physical approval, cancellation, RAM and return to gameplay on hardware. No funding, keys or contracts were changed during this research.

## Sources checked

- [Wedgie Safe guide](https://wedgie.dev/safe.md): `safe_prove`, Safe owner versus wallet, initialization.
- [Safe Signer proof source, reviewed snapshot](https://github.com/clawdbotatg/wedgie-safe/blob/0b1c19cb095ea433db29202c4a090b6dddc332b6/safe_msg.py): proof preimages, physical keys and display limits. This is a research snapshot, not an installation approval.
- [Safe key handling](https://github.com/clawdbotatg/wedgie-safe/blob/0b1c19cb095ea433db29202c4a090b6dddc332b6/safe_key.py): public-key storage, validation and startup locking behavior.
- [Trust M guide](https://wedgie.dev/trustm.md): factory identity and reserved Safe slots.
- [Firmware cartridge slot](https://github.com/clawdbotatg/wedgie-dev/blob/main/firmware/slot.py): changing apps installs and restarts the active app.
- [Safe ownership API](https://docs.safe.global/reference-smart-account/owners/isOwner) and [SafeERC20](https://docs.openzeppelin.com/contracts/5.x/api/token/erc20#SafeERC20).
