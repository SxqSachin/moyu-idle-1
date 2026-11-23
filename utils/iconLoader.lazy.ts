// This module eagerly imports all icons and exposes a synchronous map of URLs.
// It's intended to be dynamically imported (code-split) where needed so the
// large bundle of icon URLs is not part of the main entry chunk.

// IMPORTANT: the relative path is from this file to the assets folder.
const icons = import.meta.globEager('../assets/icons/*.png', { as: 'url' }) as Record<string, string>;

export function getIcon(key: string): string | undefined {
  // key examples: 'resource:abyssalCloak'
  const file = `../assets/icons/${key}.png`;
  return icons[file];
}

export const iconsMap = icons;
