# Proxy Management

[IP address blocking](https://en.wikipedia.org/wiki/IP_address_blocking) is one of the oldest and most effective ways of preventing access to a website. It is therefore paramount for a good web scraping library to provide easy to use but powerful tools which can work around IP blocking. The most powerful weapon in our anti IP blocking arsenal is a [proxy server](https://en.wikipedia.org/wiki/Proxy_server).

With Crawlee we can use our own proxy servers or proxy servers acquired from third-party providers.

Check out the [avoid blocking guide](https://crawlee.dev/js/docs/guides/avoid-blocking.md) for more information about blocking.

## Quick start[​](#quick-start "Direct link to Quick start")

If we already have proxy URLs of our own, we can start using them immediately in only a few lines of code.

```
import { ProxyConfiguration } from 'crawlee';



const proxyConfiguration = new ProxyConfiguration({

    proxyUrls: [

        'http://proxy-1.com',

        'http://proxy-2.com',

    ]

});

const proxyUrl = await proxyConfiguration.newUrl();
```

Examples of how to use our proxy URLs with crawlers are shown below in [Crawler integration](#crawler-integration) section.

## Proxy Configuration[​](#proxy-configuration "Direct link to Proxy Configuration")

All our proxy needs are managed by the [`ProxyConfiguration`](https://crawlee.dev/js/api/core/class/ProxyConfiguration.md) class. We create an instance using the `ProxyConfiguration` [`constructor`](https://crawlee.dev/js/api/core/class/ProxyConfiguration.md#constructor) function based on the provided options. See the [`ProxyConfigurationOptions`](https://crawlee.dev/js/api/core/interface/ProxyConfigurationOptions.md) for all the possible constructor options.

### Static proxy list[​](#static-proxy-list "Direct link to Static proxy list")

You can provide a static list of proxy URLs to the `proxyUrls` option. The `ProxyConfiguration` will then rotate through the provided proxies.

```
const proxyConfiguration = new ProxyConfiguration({

    proxyUrls: [

        'http://proxy-1.com',

        'http://proxy-2.com',

        null // null means no proxy is used

    ]

});
```

This is the simplest way to use a list of proxies. Crawlee will rotate through the list of proxies in a round-robin fashion.

### Custom proxy function[​](#custom-proxy-function "Direct link to Custom proxy function")

The `ProxyConfiguration` class allows you to provide a custom function to pick a proxy URL. This is useful when you want to implement your own logic for selecting a proxy.

```
const proxyConfiguration = new ProxyConfiguration({

    newUrlFunction: (sessionId, { request }) => {

        if (request?.url.includes('crawlee.dev')) {

            return null; // for crawlee.dev, we don't use a proxy

        }



        return 'http://proxy-1.com'; // for all other URLs, we use this proxy

    }

});
```

The `newUrlFunction` receives two parameters - `sessionId` and `options` - and returns a string containing the proxy URL.

The `sessionId` parameter is always provided and allows us to differentiate between different sessions - e.g. when Crawlee recognizes your crawlers are being blocked, it will automatically create a new session with a different id.

The `options` parameter is an object containing a [`Request`](https://crawlee.dev/js/api/core/class/Request.md), which is the request that will be made. Note that this object is not always available, for example when we are using the `newUrl` function directly. Your custom function should therefore not rely on the `request` object being present and provide a default behavior when it is not.

### Tiered proxies[​](#tiered-proxies "Direct link to Tiered proxies")

You can also provide a list of proxy tiers to the `ProxyConfiguration` class. This is useful when you want to switch between different proxies automatically based on the blocking behavior of the website.

warning

Note that the `tieredProxyUrls` option requires `ProxyConfiguration` to be used from a crawler instance ([see below](#crawler-integration)).

Using this configuration through the `newUrl` calls will not yield the expected results.

```
const proxyConfiguration = new ProxyConfiguration({

    tieredProxyUrls: [

        [null], // At first, we try to connect without a proxy

        ['http://okay-proxy.com'],

        ['http://slightly-better-proxy.com', 'http://slightly-better-proxy-2.com'],

        ['http://very-good-and-expensive-proxy.com'],

    ]

});
```

This configuration will start with no proxy, then switch to `http://okay-proxy.com` if Crawlee recognizes we're getting blocked by the target website. If that proxy is also blocked, we will switch to one of the `slightly-better-proxy` URLs. If those are blocked, we will switch to the `very-good-and-expensive-proxy.com` URL.

Crawlee also periodically probes lower tier proxies to see if they are unblocked, and if they are, it will switch back to them.

## Crawler integration[​](#crawler-integration "Direct link to Crawler integration")

`ProxyConfiguration` integrates seamlessly into [`HttpCrawler`](https://crawlee.dev/js/api/http-crawler/class/HttpCrawler.md), [`CheerioCrawler`](https://crawlee.dev/js/api/cheerio-crawler/class/CheerioCrawler.md), [`JSDOMCrawler`](https://crawlee.dev/js/api/jsdom-crawler/class/JSDOMCrawler.md), [`PlaywrightCrawler`](https://crawlee.dev/js/api/playwright-crawler/class/PlaywrightCrawler.md) and [`PuppeteerCrawler`](https://crawlee.dev/js/api/puppeteer-crawler/class/PuppeteerCrawler.md).

* HttpCrawler
* CheerioCrawler
* JSDOMCrawler
* PlaywrightCrawler
* PuppeteerCrawler

```
import { HttpCrawler, ProxyConfiguration } from 'crawlee';



const proxyConfiguration = new ProxyConfiguration({

    proxyUrls: ['http://proxy-1.com', 'http://proxy-2.com'],

});



const crawler = new HttpCrawler({

    proxyConfiguration,

    // ...

});
```

```
import { CheerioCrawler, ProxyConfiguration } from 'crawlee';



const proxyConfiguration = new ProxyConfiguration({

    proxyUrls: ['http://proxy-1.com', 'http://proxy-2.com'],

});



const crawler = new CheerioCrawler({

    proxyConfiguration,

    // ...

});
```

```
import { JSDOMCrawler, ProxyConfiguration } from 'crawlee';



const proxyConfiguration = new ProxyConfiguration({

    proxyUrls: ['http://proxy-1.com', 'http://proxy-2.com'],

});



const crawler = new JSDOMCrawler({

    proxyConfiguration,

    // ...

});
```

```
import { PlaywrightCrawler, ProxyConfiguration } from 'crawlee';



const proxyConfiguration = new ProxyConfiguration({

    proxyUrls: ['http://proxy-1.com', 'http://proxy-2.com'],

});



const crawler = new PlaywrightCrawler({

    proxyConfiguration,

    // ...

});
```

```
import { PuppeteerCrawler, ProxyConfiguration } from 'crawlee';



const proxyConfiguration = new ProxyConfiguration({

    proxyUrls: ['http://proxy-1.com', 'http://proxy-2.com'],

});



const crawler = new PuppeteerCrawler({

    proxyConfiguration,

    // ...

});
```

Our crawlers will now use the selected proxies for all connections.

## IP Rotation and session management[​](#ip-rotation-and-session-management "Direct link to IP Rotation and session management")

​[`proxyConfiguration.newUrl()`](https://crawlee.dev/js/api/core/class/ProxyConfiguration.md#newUrl) allows us to pass a `sessionId` parameter. It will then be used to create a `sessionId`-`proxyUrl` pair, and subsequent `newUrl()` calls with the same `sessionId` will always return the same `proxyUrl`. This is extremely useful in scraping, because we want to create the impression of a real user. See the [session management guide](https://crawlee.dev/js/docs/guides/session-management.md) and [`SessionPool`](https://crawlee.dev/js/api/core/class/SessionPool.md) class for more information on how keeping a real session helps us avoid blocking.

When no `sessionId` is provided, our proxy URLs are rotated round-robin.

* HttpCrawler
* CheerioCrawler
* JSDOMCrawler
* PlaywrightCrawler
* PuppeteerCrawler
* Standalone

```
import { HttpCrawler, ProxyConfiguration } from 'crawlee';



const proxyConfiguration = new ProxyConfiguration({

    /* opts */

});



const crawler = new HttpCrawler({

    useSessionPool: true,

    persistCookiesPerSession: true,

    proxyConfiguration,

    // ...

});
```

```
import { CheerioCrawler, ProxyConfiguration } from 'crawlee';



const proxyConfiguration = new ProxyConfiguration({

    /* opts */

});



const crawler = new CheerioCrawler({

    useSessionPool: true,

    persistCookiesPerSession: true,

    proxyConfiguration,

    // ...

});
```

```
import { JSDOMCrawler, ProxyConfiguration } from 'crawlee';



const proxyConfiguration = new ProxyConfiguration({

    /* opts */

});



const crawler = new JSDOMCrawler({

    useSessionPool: true,

    persistCookiesPerSession: true,

    proxyConfiguration,

    // ...

});
```

```
import { PlaywrightCrawler, ProxyConfiguration } from 'crawlee';



const proxyConfiguration = new ProxyConfiguration({

    /* opts */

});



const crawler = new PlaywrightCrawler({

    useSessionPool: true,

    persistCookiesPerSession: true,

    proxyConfiguration,

    // ...

});
```

```
import { PuppeteerCrawler, ProxyConfiguration } from 'crawlee';



const proxyConfiguration = new ProxyConfiguration({

    /* opts */

});



const crawler = new PuppeteerCrawler({

    useSessionPool: true,

    persistCookiesPerSession: true,

    proxyConfiguration,

    // ...

});
```

```
import { ProxyConfiguration, SessionPool } from 'crawlee';



const proxyConfiguration = new ProxyConfiguration({

    /* opts */

});



const sessionPool = await SessionPool.open({

    /* opts */

});



const session = await sessionPool.getSession();



const proxyUrl = await proxyConfiguration.newUrl(session.id);
```

## Inspecting current proxy in Crawlers[​](#inspecting-current-proxy-in-crawlers "Direct link to Inspecting current proxy in Crawlers")

`HttpCrawler`, `CheerioCrawler`, `JSDOMCrawler`, `PlaywrightCrawler` and `PuppeteerCrawler` grant access to information about the currently used proxy in their `requestHandler` using a [`proxyInfo`](https://crawlee.dev/js/api/core/interface/ProxyInfo.md) object. With the `proxyInfo` object, we can easily access the proxy URL.

* HttpCrawler
* CheerioCrawler
* JSDOMCrawler
* PlaywrightCrawler
* PuppeteerCrawler

```
import { HttpCrawler, ProxyConfiguration } from 'crawlee';



const proxyConfiguration = new ProxyConfiguration({

    /* opts */

});



const crawler = new HttpCrawler({

    proxyConfiguration,

    async requestHandler({ proxyInfo }) {

        console.log(proxyInfo);

    },

    // ...

});
```

```
import { CheerioCrawler, ProxyConfiguration } from 'crawlee';



const proxyConfiguration = new ProxyConfiguration({

    /* opts */

});



const crawler = new CheerioCrawler({

    proxyConfiguration,

    async requestHandler({ proxyInfo }) {

        console.log(proxyInfo);

    },

    // ...

});
```

```
import { JSDOMCrawler, ProxyConfiguration } from 'crawlee';



const proxyConfiguration = new ProxyConfiguration({

    /* opts */

});



const crawler = new JSDOMCrawler({

    proxyConfiguration,

    async requestHandler({ proxyInfo }) {

        console.log(proxyInfo);

    },

    // ...

});
```

```
import { PlaywrightCrawler, ProxyConfiguration } from 'crawlee';



const proxyConfiguration = new ProxyConfiguration({

    /* opts */

});



const crawler = new PlaywrightCrawler({

    proxyConfiguration,

    async requestHandler({ proxyInfo }) {

        console.log(proxyInfo);

    },

    // ...

});
```

```
import { PuppeteerCrawler, ProxyConfiguration } from 'crawlee';



const proxyConfiguration = new ProxyConfiguration({

    /* opts */

});



const crawler = new PuppeteerCrawler({

    proxyConfiguration,

    async requestHandler({ proxyInfo }) {

        console.log(proxyInfo);

    },

    // ...

});
```
