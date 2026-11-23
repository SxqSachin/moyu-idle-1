// Ambient declarations to support Vite's import.meta.glob and import.meta.globEager in TS
interface ImportMeta {
  /**
   * import.meta.glob(pattern) -> returns a record of path -> async importer
   * When used with `{ as: 'url' }` the values are strings.
   */
  glob: (pattern: string | string[], options?: any) => Record<string, any>;

  /**
   * import.meta.globEager(pattern) -> returns a record of path -> module (synchronously)
   * When used with `{ as: 'url' }` the values are strings (URLs).
   */
  globEager: (pattern: string | string[], options?: any) => Record<string, any>;
}

declare var importMeta: ImportMeta;
