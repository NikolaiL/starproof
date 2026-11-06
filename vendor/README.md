# Wedgie 3D preview

`wedgie3d.ts`, `dir8` in `device.ts`, and `public/3d/wedgie.{json,bin}` come from [wedgie-dev](https://github.com/clawdbotatg/wedgie-dev/tree/926972f8efec0859f6cab5d61ce51e1752ec549d), commit `926972f8efec0859f6cab5d61ce51e1752ec549d`. The geometry is the real clawd-pico-case v1.7, exported by that project's `tools/case3d.py`.

Copyright (c) 2026 Austin Griffith; MIT, see `WEDGIE-LICENSE.txt`. The only renderer adaptation disables decorative movement under reduced motion. Starproof mounts it with `interactive: false`; the browser cannot approve a physical request. `npm run build` bundles it and Three.js locally; no CDN scripts are loaded. Three.js is MIT-licensed under its package's LICENSE.

`repl.ts`, `files.ts`, and `FREE_PY` in `free-app.ts` are reused from the same pinned Wedgie commit under the same license. `starproof-installer.ts` is Starproof's restricted integration: it writes only the four pinned app modules and selects Starproof after a physical full-control approval. The compiled files include the upstream license.

The integration waits for the installed app using read-only firmware `hello` requests. A replacement USB port is returned only after its board ID matches the originally selected device and it reports Starproof running; the signer then checks its normal app handshake.

`lib/safe.js` also reuses the MIT signer-address derivation constants from [wedgie-safe/safe_addr.py](https://github.com/clawdbotatg/wedgie-safe/blob/0b1c19cb095ea433db29202c4a090b6dddc332b6/safe_addr.py). Its Safe 1.4.1 bytecode hashes were independently extracted from `@safe-global/safe-contracts` 1.4.1-2 artifacts; no Safe contract source is copied into the web runtime.
