import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VOCAB_DIR = path.join(__dirname, '../assets/Sensitive-lexicon-1.2/Vocabulary');
const OUT_JSON = path.join(__dirname, '../assets/resource/sensitiveWords.json');

function normalizeWord(raw: string): string | null {
  if (!raw) return null;
  let w = raw.trim();
  if (!w) return null;
  // skip comments
  if (w.startsWith('#') || w.startsWith('//')) return null;
  // collapse whitespace and lowercase ASCII
  w = w.replace(/\s+/g, ' ').toLowerCase();
  return w;
}

async function collectWords(): Promise<string[]> {
  const files = await fs.readdir(VOCAB_DIR);
  const set = new Set<string>();
  for (const file of files) {
    if (!file.endsWith('.txt')) continue;
    const p = path.join(VOCAB_DIR, file);
    const content = await fs.readFile(p, 'utf8');
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const parts = line.split(/[,\uFF0C;；]+/);
      for (const part of parts) {
        const n = normalizeWord(part);
        if (n) set.add(n);
      }
    }
  }
  return Array.from(set);
}

async function main() {
  try {
    const words = await collectWords();
    // sort for stable output
    words.sort((a, b) => a.localeCompare(b, 'en'));
    await fs.writeFile(OUT_JSON, JSON.stringify(words, null, 2), 'utf8');
    console.log(`Wrote ${words.length} words to ${OUT_JSON}`);
  } catch (err) {
    console.error('Failed to generate sensitiveWords.json', err);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('convertSensitiveToJson.ts')) {
  main();
}
