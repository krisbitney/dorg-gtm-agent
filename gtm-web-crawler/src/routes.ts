import { createPlaywrightRouter } from 'crawlee';

export const router = createPlaywrightRouter();

// TODO: revise
router.addDefaultHandler(async ({ enqueueLinks, log }) => {
    log.info(`enqueueing new URLs`);
    await enqueueLinks({
        globs: ['https://crawlee.dev/**'],
        label: 'detail',
    });
});
