import { Page } from 'playwright';

/**
 * Detects if the current page is a block page (login wall, rate limit, captcha, etc.).
 * @param page The Playwright page object.
 * @returns A string describing the block type, or null if no block detected.
 */
export async function detectBlock(page: Page): Promise<string | null> {
    const title = await page.title();
    const content = await page.content();
    const url = page.url();

    // 1. Cloudflare / WAF
    if (title.includes('Cloudflare') || title.includes('Attention Required! | Cloudflare')) {
        return 'cloudflare';
    }

    // 2. Login Wall (Reddit specific)
    if (url.includes('reddit.com/login') || content.includes('Log in to Reddit') || content.includes('Sign up to Reddit') || content.includes('Login required')) {
        return 'login-wall';
    }

    // 3. Rate Limited
    if (content.includes('Too Many Requests') || content.includes('rate limited') || content.includes('try again later') || content.includes('429 Too Many Requests')) {
        return 'rate-limited';
    }

    // 4. Captcha / Recaptcha
    if (content.includes('g-recaptcha') || content.includes('captcha-delivery') || content.includes('Robot Check') || content.includes('verify you are a human')) {
        return 'captcha';
    }

    // 5. General Block
    if (content.includes('Access Denied') || content.includes('Your IP has been blocked') || title.includes('Access Denied')) {
        return 'access-denied';
    }

    return null;
}
