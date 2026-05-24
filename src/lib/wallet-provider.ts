/**
 * EIP-6963 Multi Injected Provider Discovery
 * https://eips.ethereum.org/EIPS/eip-6963
 *
 * Allows the app to explicitly target MetaMask's provider rather than
 * relying on window.ethereum, which competing extensions (Backpack, Zerion,
 * evmAsk, Coinbase Wallet, etc.) overwrite in a race condition.
 *
 * MetaMask has supported EIP-6963 since v11.4.0 (2023). Its rdns is "io.metamask".
 * Extensions fire "eip6963:announceProvider" synchronously when the page
 * dispatches "eip6963:requestProvider", so no async/await is needed.
 */

export type EthProvider = {
  request:        (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on:             (event: string, cb: (...args: unknown[]) => void) => void;
  removeListener: (event: string, cb: (...args: unknown[]) => void) => void;
};

interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

interface EIP6963ProviderDetail {
  info:     EIP6963ProviderInfo;
  provider: EthProvider;
}

// Cache after first discovery — providers don't change at runtime.
let _providers: EIP6963ProviderDetail[] | null = null;

function discoverProviders(): EIP6963ProviderDetail[] {
  if (typeof window === "undefined") return [];
  if (_providers !== null) return _providers;

  const found: EIP6963ProviderDetail[] = [];

  const onAnnounce = (e: Event) => {
    found.push((e as CustomEvent<EIP6963ProviderDetail>).detail);
  };

  window.addEventListener("eip6963:announceProvider", onAnnounce);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  window.removeEventListener("eip6963:announceProvider", onAnnounce);

  _providers = found;
  return found;
}

/**
 * Returns MetaMask's injected provider, discovered via EIP-6963.
 * Falls back to window.ethereum if EIP-6963 yields nothing (older MetaMask or
 * single-wallet environments).
 */
export function getMetaMaskProvider(): EthProvider | null {
  if (typeof window === "undefined") return null;

  const providers = discoverProviders();

  // Prefer MetaMask explicitly by reverse-domain name string.
  const metamask = providers.find(p => p.info.rdns === "io.metamask");
  if (metamask) return metamask.provider;

  // Accept any EIP-6963-compliant wallet if MetaMask isn't detected.
  if (providers.length > 0) return providers[0].provider;

  // Final fallback: legacy window.ethereum (pre-EIP-6963 MetaMask, Rabby, etc.).
  return (window as unknown as { ethereum?: EthProvider }).ethereum ?? null;
}

/** Resets the provider cache — useful for testing. */
export function resetProviderCache(): void {
  _providers = null;
}
