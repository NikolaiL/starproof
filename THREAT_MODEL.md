# What Starproof proves

## Trusted components

The verifier trusts its deployed code, the game's authoritative state, its clock and randomness, the pinned production Infineon CAs, and the secrecy of the certified factory private key. It does not trust browser labels, a claimed device model, a self-issued certificate, or an arbitrary P-256 public key.

## Attacks rejected by the current implementation

- A certificate copied from a real device without a matching signature.
- A software key or self-signed certificate claiming to be Trust M.
- A signature over a different destination, cost, action, origin or mission.
- Reusing an already committed action, an expired challenge, or a browser-cancelled request.
- Spending fuel or claiming an artifact without going through the verified strategic state transition.
- Replacing the chip midway through the expedition.

`npm test` covers these properties with a separate ephemeral PKI. The production verifier never loads that test PKI.

## Limits

1. **Hostile firmware / automation:** a genuine chip is still genuine when driven by a modified program. This device has no remote measured-firmware attestation or cryptographic proof of a physical button press. The stock app's physical-only `ui.ask` protects cooperative users; the remote verifier cannot establish that this app was running.
2. **Relaying / device farms:** an attacker can forward challenges to a real chip elsewhere. This is proof of chip participation, not proximity, one human, one account, or fair play. Sessions are not globally limited to one per chip.
3. **Local authority:** this demo runs on localhost. Anyone controlling the server can change its verifier or state. Shared gameplay needs an independently controlled service, or contract-enforced state transitions with authenticated key enrollment. A contract that only checks P-256 and accepts arbitrary keys does not prove Trust M origin.
4. **Physical possession:** someone holding the Wedgie may use its factory key. There is no PIN, chip revocation or recovery flow in this prototype.
5. **CA/revocation:** certificate dates and the pinned two-level chain are checked. CRLs/OCSP, production enrollment policy, CA rotations and compromised-device revocations are not implemented. See the certificate provenance in the [toolkit CA provenance](https://github.com/NikolaiL/wedgie-actions/tree/main/certs).
6. **Privacy:** the factory certificate is a stable identifier. A verifier can link its uses. Exported receipts include that certificate and should not be treated as anonymous.
7. **Prototype state:** sessions are memory-only, browser flight/scan state is cosmetic, no multiplayer, economic rewards, persistence, public deployment or security audit is included.

## Possible contract extension (not implemented)

A registry would admit genuine factory public keys only after manufacturer-chain verification. Each game action would bind the chain, game contract, player, action arguments, state sequence/nonce and deadline. The game contract would verify the registered key's P-256 signature before changing game state. Offchain enrollment introduces trust in its registrar; moving certificate verification onchain or proving it in ZK is a separate engineering task. None of these options establishes human presence or approved firmware by itself.
