import { initLlama, LlamaContext } from 'llama.rn';
import RNFS from 'react-native-fs';
import { useAIStore } from '../store/aiStore';
import { StorageKeys, getJSON, setJSON } from '../store/mmkvStore';

// ─── On-Device LLM Service (llama.rn + GGUF) ───────────────────────────────
// Uses llama.cpp via llama.rn bindings for on-device inference.
// Supports both completion (classification) and embedding (vector DB).
// Zero cloud. Zero API. Everything on-device.

const MODEL_FILENAME = 'gemma-2-2b-it-Q4_K_M.gguf';
const MODEL_URL = 'https://huggingface.co/lmstudio-community/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf';

class LLMService {
  private context: LlamaContext | null = null;
  private _isReady = false;

  get isReady(): boolean {
    return this._isReady;
  }

  async getModelPath(): Promise<string | null> {
    const cached = getJSON<string | null>(StorageKeys.LLM_MODEL_PATH, null);
    if (cached && await RNFS.exists(cached)) return cached;

    const defaultPath = `${RNFS.DocumentDirectoryPath}/${MODEL_FILENAME}`;
    if (await RNFS.exists(defaultPath)) {
      setJSON(StorageKeys.LLM_MODEL_PATH, defaultPath);
      return defaultPath;
    }

    const adbPath = '/data/local/tmp/model.gguf';
    if (await RNFS.exists(adbPath)) {
      setJSON(StorageKeys.LLM_MODEL_PATH, adbPath);
      return adbPath;
    }

    return null;
  }

  async downloadModel(onProgress: (progress: number) => void): Promise<string> {
    const destPath = `${RNFS.DocumentDirectoryPath}/${MODEL_FILENAME}`;
    const aiStore = useAIStore.getState();

    if (await RNFS.exists(destPath)) {
      aiStore.setLlmModelPath(destPath);
      return destPath;
    }

    aiStore.setLlmStatus('DOWNLOADING');

    try {
      const download = RNFS.downloadFile({
        fromUrl: MODEL_URL,
        toFile: destPath,
        progress: (res) => {
          const progress = res.bytesWritten / res.contentLength;
          onProgress(progress);
          aiStore.setLlmProgress(progress);
        },
        progressDivider: 5,
      });

      const result = await download.promise;
      if (result.statusCode === 200) {
        aiStore.setLlmModelPath(destPath);
        aiStore.setLlmStatus('IDLE');
        return destPath;
      }
      throw new Error(`Download failed with status: ${result.statusCode}`);
    } catch (e: any) {
      aiStore.setLlmStatus('ERROR', e.message);
      throw e;
    }
  }

  async initialize(modelPath: string): Promise<void> {
    const aiStore = useAIStore.getState();
    aiStore.setLlmStatus('LOADING');

    try {
      this.context = await initLlama({
        model: modelPath,
        n_ctx: 512,
        n_batch: 32,
        n_threads: 4,
        use_mlock: true,
        use_mmap: true,
      });

      this._isReady = true;
      aiStore.setLlmStatus('READY');
      console.log('[LLM] Engine ready — on-device inference active');
    } catch (e: any) {
      aiStore.setLlmStatus('ERROR', e.message);
      console.error('[LLM] Init failed:', e);
      throw e;
    }
  }

  async classify(text: string): Promise<string> {
    if (!this.context) throw new Error('LLM not initialized');

    const result = await this.context.completion({
      messages: [
        {
          role: 'system',
          content: 'You are a mobile security AI. Classify notifications as IMPORTANT, PROMOTION, or SPAM. IMPORTANT: personal messages, OTPs, banking alerts, delivery updates. PROMOTION: offers, discounts, marketing. SPAM: scams, fake rewards, phishing. Return ONLY valid JSON: {"label":"IMPORTANT","confidence":0.95}',
        },
        {
          role: 'user',
          content: `Classify: "${text}"`,
        },
      ],
      n_predict: 60,
      temperature: 0.1,
      top_p: 0.9,
      stop: ['\n\n', '```', '</s>', '<|end|>', '<|im_end|>'],
    });

    return result.text;
  }

  async getEmbedding(text: string): Promise<number[]> {
    if (!this.context) throw new Error('LLM not initialized');
    const result = await this.context.embedding(text);
    return result.embedding;
  }

  async release(): Promise<void> {
    if (this.context) {
      await this.context.release();
      this.context = null;
    }
    this._isReady = false;
    useAIStore.getState().setLlmStatus('IDLE');
  }
}

export const llmService = new LLMService();
