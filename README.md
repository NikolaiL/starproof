# Starproof

A browser space-exploration demo and reusable action-signing toolkit for Wedgie with an **OPTIGA Trust M** chip. A manufacturer-certified factory key signs the launch of an expedition and its strategic decisions. Flying, scanning and inspecting destinations need no signature.

## Run

Requires Node.js 24+ and desktop Chrome or Edge for Web Serial. There are no npm runtime dependencies.

```sh
npm start
# http://localhost:4173
npm test
```

Tests also require OpenSSL and Python 3. They create an ephemeral test CA, exercise real P-256 signatures, and verify that the production verifier rejects that software-generated identity. Test trust roots never enter the running app.

## Install the Wedgie app

Download the official CLI from <https://wedgie.dev/wedgie.py>. With `pyserial` installed on the computer, run it from **this folder**, which contains `wedgie.json`:

```sh
python3 /path/to/wedgie.py install .
# Or: uv run --with pyserial python3 /path/to/wedgie.py install .
```

Close other tabs/tools holding the serial port first. Installation asks for the real green button on the device's FULL CONTROL prompt. It switches the one app slot from the current app to Starproof. This app creates no keys, locks no objects, and never writes Safe Signer's key slots. The factory key and its existing certificate are read/used as provisioned. Restart closes installer access.

If the browser says “unknown type,” Starproof is not running on the device yet. Install it, reload the browser page, and reconnect. To return to Safe Signer later, use the official CLI's `use safe` command; its chip key is retained.

## Play

1. Connect Wedgie. The server validates its certificate; this alone is not proof of key possession.
2. **Authorize expedition** and press green on Wedgie. A valid factory-key signature starts the mission.
3. Fly with WASD/arrows. Space scans a signal; select a system on the chart or destination buttons.
4. **Commit jump** spends one of eight fuel units and requires a signature.
5. **Claim artifact** collects the current system's artifact and requires a signature. Each system has one.
6. Export signed receipts to inspect the certificate, complete signed text, and `(r,s)` signature.

The red button declines. Browser cancellation invalidates the challenge; decline on Wedgie to clear its pending screen. There is no signing bypass for the virtual Wedgie or a software key. An emulator may preview the app UI but cannot pass the production certificate check.

Games currently live in the server's memory, expire after two hours of inactivity, and disappear on server restart. Browser cookies identify the local session; returning to the same cookie resumes it and strategic actions still require the original chip.

## Toolkit layout

| File | Responsibility |
| --- | --- |
| `public/sdk.js` | Web Serial connection, JSON-line requests, `signAction(challenge)` |
| `public/protocol.js` | Versioned action encoding and the demo's star systems |
| `device/starproof_protocol.py` | Strict MicroPython parsing of the exact signed action |
| `device/starproof.py` | Physical confirmation and factory-key signing |
| `lib/verifier.js` | Certificate-chain and P-256 signature verification |
| `lib/game.js` | Single-use challenges and authoritative strategic state |
| `server.js` | Local HTTP API, sessions, limits and static files |
| `test/security.test.js` | Forgery, tampering, replay, expiry, cancellation and protocol checks |

## Trust boundary

The server reconstructs the signed payload, binding the protocol, origin, mission, certificate fingerprint, action, source, destination, fuel cost, sequence, expiry and random nonce. The device hashes those exact bytes; a copied certificate alone is insufficient. The server validates the certificate again at commit and accepts the challenge once.

This proves **participation by a certified chip**, not approved firmware, human presence, one person per chip, or bot resistance. A modified app on a genuine chip can sign automatically. The localhost server is the authority for this demo; changing its code can bypass its rules. There is no smart-contract enforcement or sponsor integration yet. See [THREAT_MODEL.md](THREAT_MODEL.md) and [SPONSORS.md](SPONSORS.md).

## Provenance and Classic disclosure

Created as a new ETHGlobal Mumbai Classic project on November 6, 2026. Code and UI were authored with Codex assistance and tested with Node's built-in test runner, Python and the browser. The user performed physical device installation/interaction. Reused platform components: Wedgie firmware, `lcd`, `ui`, `optiga`, its serial transport, and public Infineon certificate material. The app-loop and factory-signing API usage follow Wedgie's public guides; this is not a fork of Safe Signer or Plain Wallet. Certificate sources and fingerprints are in [certs/README.md](certs/README.md).

Guides: [Wedgie skill](https://wedgie.dev/skill.md), [apps](https://wedgie.dev/code.md), [Trust M](https://wedgie.dev/trustm.md), [USB](https://wedgie.dev/usb.md), [security](https://wedgie.dev/security.md).
