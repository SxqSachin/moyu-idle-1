// Lightweight wrapper that dynamically imports the eagerly-generated icon map.
// Usage: const { getIcon } = await import('~/utils/iconLoader.lazy');

export async function loadIconModule() {
  return await import('./iconLoader.lazy');
}

export async function getIconAsync(key: string) {
  const mod = await loadIconModule();
  return mod.getIcon(key);
}
