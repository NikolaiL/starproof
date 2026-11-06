// EIP-6963 avoids the injection-order race between installed wallet extensions.
export function mountWalletPicker(select, changed = () => {}, host = window) {
  const providers = new Map();
  let current, discovered = false;
  const choose = () => {
    const next = providers.get(select.value);
    if (current !== next) { current = next; changed(next); }
  };
  const add = (id, name, provider) => {
    if (providers.has(id) || typeof provider?.request !== 'function') return;
    providers.set(id, provider);
    const option = host.document.createElement('option'); option.value = id; option.textContent = name;
    select.append(option); choose();
  };
  host.addEventListener('eip6963:announceProvider', event => {
    const { info, provider } = event.detail || {};
    if (typeof info?.uuid !== 'string' || !info.uuid || typeof info.name !== 'string' || typeof provider?.request !== 'function') return;
    if (!discovered) { discovered = true; providers.clear(); select.replaceChildren(); }
    add(info.uuid, info.name, provider);
  });
  select.addEventListener('change', choose);
  if (host.ethereum) add('browser', 'Browser wallet', host.ethereum);
  host.dispatchEvent(new Event('eip6963:requestProvider'));
  return () => {
    if (!current) throw new Error('No Ethereum wallet found. Open Starproof in a browser with your wallet extension.');
    return current;
  };
}
