import { SecurityService } from './securityService';
import { llmService } from './llmService';

const NotificationProcessor = async (taskData: {
    packageName: string;
    title: string;
    text: string;
    nativeLabel?: string;
}) => {
    const { packageName, text, nativeLabel } = taskData;

    console.log(`[Headless] Processing notification from ${packageName}`);
    console.log(`[Headless] Native pre-classification: ${nativeLabel || 'none'}`);

    try {
        // Initialize security service (hydrates MMKV stores)
        await SecurityService.initialize();

        // If LLM isn't loaded yet, try to initialize it
        if (!llmService.isReady) {
            try {
                const modelPath = await llmService.getModelPath();
                if (modelPath) {
                    await llmService.initialize(modelPath);
                    console.log('[Headless] LLM engine cold-started successfully');
                }
            } catch (initErr) {
                console.warn('[Headless] LLM not available, using native classification');
            }
        }

        // Run deep classification (will use C++ TurboModule or LLM)
        const classification = await SecurityService.classifyNotification(text, packageName);

        if (classification.label === 'SPAM') {
            console.log(`[Headless] ⛔ CONFIRMED SPAM (${classification.confidence.toFixed(2)}) via ${classification.source}`);
        } else if (classification.label === 'PROMOTION') {
            console.log(`[Headless] 📢 PROMOTION (${classification.confidence.toFixed(2)}) via ${classification.source}`);
        } else {
            console.log(`[Headless] ✅ IMPORTANT (${classification.confidence.toFixed(2)}) via ${classification.source}`);
        }

        // Update stats
        SecurityService.getStats();
    } catch (e) {
        console.error('[Headless] Task execution failure:', e);
    }
};

export default NotificationProcessor;
