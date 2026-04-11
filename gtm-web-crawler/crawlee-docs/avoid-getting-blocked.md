# Avoid getting blocked

A scraper might get blocked for numerous reasons. Let's narrow it down to the two main ones. The first is a bad or blocked IP address. You can learn about this topic in the [proxy management guide](https://crawlee.dev/js/docs/guides/proxy-management.md). The second reason is [browser fingerprints](https://pixelprivacy.com/resources/browser-fingerprinting/) (or signatures), which we will explore more in this guide. Check the [Apify Academy anti-scraping course](https://docs.apify.com/academy/anti-scraping) to gain a deeper theoretical understanding of blocking and learn a few tips and tricks.

Browser fingerprint is a collection of browser attributes and significant features that can show if our browser is a bot or a real user. Moreover, most browsers have these unique features that allow the website to track the browser even within different IP addresses. This is the main reason why scrapers should change browser fingerprints while doing browser-based scraping. In return, it should significantly reduce the blocking.

## Using browser fingerprints[​](#using-browser-fingerprints "Direct link to Using browser fingerprints")

Changing browser fingerprints can be a tedious job. Luckily, Crawlee provides this feature with zero configuration necessary - the usage of fingerprints is enabled by default and available in `PlaywrightCrawler` and `PuppeteerCrawler`. So whenever we build a scraper that is using one of these crawlers - the fingerprints are going to be generated for the default browser and the operating system out of the box.

## Customizing browser fingerprints[​](#customizing-browser-fingerprints "Direct link to Customizing browser fingerprints")

In certain cases we want to narrow down the fingerprints used - e.g. specify a certain operating system, locale or browser. This is also possible with Crawlee - the crawler can have the generation algorithm customized to reflect the particular browser version and many more. Let's take a look at the examples bellow:

* PlaywrightCrawler
* PuppeteerCrawler

```
import { PlaywrightCrawler } from 'crawlee';

import { BrowserName, DeviceCategory, OperatingSystemsName } from '@crawlee/browser-pool';



const crawler = new PlaywrightCrawler({

    browserPoolOptions: {

        useFingerprints: true, // this is the default

        fingerprintOptions: {

            fingerprintGeneratorOptions: {

                browsers: [

                    {

                        name: BrowserName.edge,

                        minVersion: 96,

                    },

                ],

                devices: [DeviceCategory.desktop],

                operatingSystems: [OperatingSystemsName.windows],

            },

        },

    },

    // ...

});
```

```
import { PuppeteerCrawler } from 'crawlee';

import { BrowserName, DeviceCategory } from '@crawlee/browser-pool';



const crawler = new PuppeteerCrawler({

    browserPoolOptions: {

        useFingerprints: true, // this is the default

        fingerprintOptions: {

            fingerprintGeneratorOptions: {

                browsers: [BrowserName.chrome, BrowserName.firefox],

                devices: [DeviceCategory.mobile],

                locales: ['en-US'],

            },

        },

    },

    // ...

});
```

## Disabling browser fingerprints[​](#disabling-browser-fingerprints "Direct link to Disabling browser fingerprints")

On the contrary, sometimes we want to entirely disable the usage of browser fingerprints. This is easy to do with Crawlee too. All we have to do is set the `useFingerprints` option of the `browserPoolOptions` to `false`:

* PlaywrightCrawler
* PuppeteerCrawler

```
import { PlaywrightCrawler } from 'crawlee';



const crawler = new PlaywrightCrawler({

    browserPoolOptions: {

        useFingerprints: false,

    },

    // ...

});
```

```
import { PuppeteerCrawler } from 'crawlee';



const crawler = new PuppeteerCrawler({

    browserPoolOptions: {

        useFingerprints: false,

    },

    // ...

});
```

## Camoufox[​](#camoufox "Direct link to Camoufox")

For some protections, using our integrated solutions is not enough, one example could be the Cloudflare challenge. For such pages, you can try [Camoufox](https://camoufox.com/), a custom stealthy build of Firefox for web scraping. It might not get you through the challenge automatically, but with our `handleCloudflareChallenge` helper, it should be able to successfully mimic the required user action and get you through it.

```
import { PlaywrightCrawler } from 'crawlee';

import { launchOptions } from 'camoufox-js';

import { firefox } from 'playwright';



const crawler = new PlaywrightCrawler({

    postNavigationHooks: [

        async ({ handleCloudflareChallenge }) => {

            await handleCloudflareChallenge();

        },

    ],

    browserPoolOptions: {

        // Disable the default fingerprint spoofing to avoid conflicts with Camoufox.

        useFingerprints: false,

    },

    launchContext: {

        launcher: firefox,

        launchOptions: await launchOptions({

            headless: true,

        }),

    },

    // ...

});
```

**Related links**

* [Fingerprint Suite Docs](https://github.com/apify/fingerprint-suite)
* [Apify Academy anti-scraping course](https://docs.apify.com/academy/anti-scraping)
* [Camoufox JS wrapper](https://github.com/apify/camoufox-js)
