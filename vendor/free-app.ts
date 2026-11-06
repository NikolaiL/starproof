// From wedgie-dev src/serial/install.ts; see WEDGIE-LICENSE.txt.
export const FREE_PY = `def _free():
    import gc, sys
    for n in list(sys.modules):
        if n not in ("lcd", "splash", "micropython") and n[0] != "_":   # _: the host's own (the emulator's _emu)
            del sys.modules[n]
    l = sys.modules.get("lcd")
    if l:
        del l._keys[:]          # every Keys() the app and the slot made
        l._on_show = None       # the loader's hook
    g = globals()
    for n in list(g):
        if not n.startswith("__"):
            del g[n]
    gc.collect()
_free()`;
