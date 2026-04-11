import { createPlaywrightRouter } from 'crawlee';

export const router = createPlaywrightRouter();

// TODO: Implement real Reddit handlers in Checkpoint 6
router.addDefaultHandler(async ({ log }) => {
    log.info(`Default handler called. No action taken yet.`);
});
