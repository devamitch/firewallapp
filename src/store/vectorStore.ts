import { StorageKeys, getJSON, setJSON } from './mmkvStore';

// ─── Local Vector Store (ChromaDB Architecture — MMKV Backend) ──────────────
// Offline cosine similarity vector database.
// Stores LLM-generated embeddings for semantic pattern matching.
// Uses MMKV (native C++ mmap) instead of AsyncStorage for 30x faster I/O.

interface VectorEntry {
  text: string;
  label: 'SPAM' | 'IMPORTANT' | 'PROMOTION';
  embedding: number[];
  source: 'predefined' | 'user_feedback' | 'auto_learned';
  timestamp: number;
}

interface VectorSearchResult {
  entry: VectorEntry;
  similarity: number;
}

const MAX_VECTORS = 1000;

class VectorStore {
  private vectors: VectorEntry[] = [];
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    this.vectors = getJSON<VectorEntry[]>(StorageKeys.VECTORS, []);
    this.initialized = true;
  }

  async addVector(entry: Omit<VectorEntry, 'timestamp'>): Promise<void> {
    this.init();
    this.vectors.push({ ...entry, timestamp: Date.now() });

    // Enforce capacity limit — remove oldest
    if (this.vectors.length > MAX_VECTORS) {
      this.vectors = this.vectors.slice(-MAX_VECTORS);
    }

    this.persist();
  }

  async searchSimilar(queryEmbedding: number[], topK: number = 3): Promise<VectorSearchResult[]> {
    this.init();
    if (this.vectors.length === 0) return [];

    const results: VectorSearchResult[] = [];

    for (const entry of this.vectors) {
      if (!entry.embedding || entry.embedding.length !== queryEmbedding.length) continue;
      const sim = this.cosineSimilarity(queryEmbedding, entry.embedding);
      results.push({ entry, similarity: sim });
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  }

  getStats() {
    this.init();
    let spam = 0, important = 0, promo = 0;
    for (const v of this.vectors) {
      if (v.label === 'SPAM') spam++;
      else if (v.label === 'IMPORTANT') important++;
      else promo++;
    }
    return { total: this.vectors.length, spam, important, promo };
  }

  clear(): void {
    this.vectors = [];
    this.persist();
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  private persist(): void {
    setJSON(StorageKeys.VECTORS, this.vectors);
  }
}

export const vectorStore = new VectorStore();
