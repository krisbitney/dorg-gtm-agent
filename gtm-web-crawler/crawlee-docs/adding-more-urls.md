# Adding more URLs

Previously you've built a very simple crawler that downloads HTML of a single page, reads its title and prints it to the console. This is the original source code:

```
import { CheerioCrawler } from 'crawlee';



const crawler = new CheerioCrawler({

    async requestHandler({ $, request }) {

        const title = $('title').text();

        console.log(`The title of "${request.url}" is: ${title}.`);

    }

})



await crawler.run(['https://crawlee.dev']);
```

Now you'll use the example from the previous section and improve on it. You'll add more URLs to the queue and thanks to that the crawler will keep going, finding new links, enqueuing them into the `RequestQueue` and then scraping them.

## How crawling works[​](#how-crawling-works "Direct link to How crawling works")

The process is simple:

1. Find new links on the page.
2. Filter only those pointing to the same domain, in this case `crawlee.dev`.
3. Enqueue (add) them to the `RequestQueue`.
4. Visit the newly enqueued links.
5. Repeat the process.

In the following paragraphs you will learn about the [`enqueueLinks`](https://crawlee.dev/js/api/core/function/enqueueLinks.md) function which simplifies crawling to a single function call. For comparison and learning purposes we will show an equivalent solution written without `enqueueLinks` in the second code tab.

`enqueueLinks` context awareness

The `enqueueLinks` function is context aware. It means that it will read the information about the currently crawled page from the context, and you don't need to explicitly provide any arguments. It will find the links using the Cheerio function `$` and automatically add the links to the running crawler's `RequestQueue`.

## Limit your crawls with `maxRequestsPerCrawl`[​](#limit-your-crawls-with-maxrequestspercrawl "Direct link to limit-your-crawls-with-maxrequestspercrawl")

When you're just testing your code or when your crawler could potentially find millions of links, it's very useful to set a maximum limit of crawled pages. The option is called `maxRequestsPerCrawl`, is available in all crawlers, and you can set it like this:

```
const crawler = new CheerioCrawler({

    maxRequestsPerCrawl: 20,

    // ...

});
```

This means that no new requests will be started after the 20th request is finished. The actual number of processed requests might be a little higher thanks to parallelization, because the running requests won't be forcefully aborted. It's not even possible in most cases.

## Finding new links[​](#finding-new-links "Direct link to Finding new links")

There are numerous approaches to finding links to follow when crawling the web. For our purposes, we will be looking for `<a>` elements that contain the `href` attribute because that's what you need in most cases. For example:

```
<a href="https://crawlee.dev/js/docs/introduction">This is a link to Crawlee introduction</a>
```

Since this is the most common case, it is also the `enqueueLinks` default.

* with enqueueLinks
* without enqueueLinks

src/main.mjs

```
import { CheerioCrawler } from 'crawlee';



const crawler = new CheerioCrawler({

    // Let's limit our crawls to make our

    // tests shorter and safer.

    maxRequestsPerCrawl: 20,

    // enqueueLinks is an argument of the requestHandler

    async requestHandler({ $, request, enqueueLinks }) {

        const title = $('title').text();

        console.log(`The title of "${request.url}" is: ${title}.`);

        // The enqueueLinks function is context aware,

        // so it does not require any parameters.

        await enqueueLinks();

    },

});



await crawler.run(['https://crawlee.dev']);
```

src/main.mjs

```
import { CheerioCrawler } from 'crawlee';

import { URL } from 'node:url';



const crawler = new CheerioCrawler({

    // Let's limit our crawls to make our

    // tests shorter and safer.

    maxRequestsPerCrawl: 20,

    async requestHandler({ request, $ }) {

        const title = $('title').text();

        console.log(`The title of "${request.url}" is: ${title}.`);



        // Without enqueueLinks, we first have to extract all

        // the URLs from the page with Cheerio.

        const links = $('a[href]')

            .map((_, el) => $(el).attr('href'))

            .get();



        // Then we need to resolve relative URLs,

        // otherwise they would be unusable for crawling.

        const absoluteUrls = links.map((link) => new URL(link, request.loadedUrl).href);



        // Finally, we have to add the URLs to the queue

        await crawler.addRequests(absoluteUrls);

    },

});



await crawler.run(['https://crawlee.dev']);
```

If you need to override the default selection of elements in `enqueueLinks`, you can use the `selector` argument.

```
await enqueueLinks({

    selector: 'div.has-link'

});
```

## Filtering links to same domain[​](#filtering-links-to-same-domain "Direct link to Filtering links to same domain")

Websites typically contain a lot of links that lead away from the original page. This is normal, but when crawling a website, we usually want to crawl that one site and not let our crawler wander away to Google, Facebook and Twitter. Therefore, we need to filter out the off-domain links and only keep the ones that lead to the same domain.

* with enqueueLinks
* without enqueueLinks

src/main.mjs

```
import { CheerioCrawler } from 'crawlee';



const crawler = new CheerioCrawler({

    maxRequestsPerCrawl: 20,

    async requestHandler({ $, request, enqueueLinks }) {

        const title = $('title').text();

        console.log(`The title of "${request.url}" is: ${title}.`);

        // The default behavior of enqueueLinks is to stay on the same hostname,

        // so it does not require any parameters.

        // This will ensure the subdomain stays the same.

        await enqueueLinks();

    },

});



await crawler.run(['https://crawlee.dev']);
```

src/main.mjs

```
import { CheerioCrawler } from 'crawlee';

import { URL } from 'node:url';



const crawler = new CheerioCrawler({

    maxRequestsPerCrawl: 20,

    async requestHandler({ request, $ }) {

        const title = $('title').text();

        console.log(`The title of "${request.url}" is: ${title}.`);



        const links = $('a[href]')

            .map((_, el) => $(el).attr('href'))

            .get();



        // Besides resolving the URLs, we now also need to

        // grab their hostname for filtering.

        const { hostname } = new URL(request.loadedUrl);

        const absoluteUrls = links.map((link) => new URL(link, request.loadedUrl));



        // We use the hostname to filter links that point

        // to a different domain, even subdomain.

        const sameHostnameLinks = absoluteUrls

            .filter((url) => url.hostname === hostname)

            .map((url) => ({ url: url.href }));



        // Finally, we have to add the URLs to the queue

        await crawler.addRequests(sameHostnameLinks);

    },

});



await crawler.run(['https://crawlee.dev']);
```

The default behavior of `enqueueLinks` is to stay on the same hostname. This **does not include subdomains**. To include subdomains in your crawl, use the `strategy` argument.

```
await enqueueLinks({

    strategy: 'same-domain'

});
```

When you run the code, you will see the crawler log the **title** of the first page, then the **enqueueing** message showing number of URLs, followed by the **title** of the first enqueued page and so on and so on.

## Skipping duplicate URLs[​](#skipping-duplicate-urls "Direct link to Skipping duplicate URLs")

Skipping of duplicate URLs is critical, because visiting the same page multiple times would lead to duplicate results. This is automatically handled by the `RequestQueue` which deduplicates requests using their `uniqueKey`. This `uniqueKey` is automatically generated from the request's URL by lowercasing the URL, lexically ordering query parameters, removing fragments and a few other tweaks that ensure the queue only includes unique URLs.

## Advanced filtering arguments[​](#advanced-filtering-arguments "Direct link to Advanced filtering arguments")

While the defaults for `enqueueLinks` can be often exactly what you need, it also gives you fine-grained control over which URLs should be enqueued. One way we already mentioned above. It is using the [`EnqueueStrategy`](https://crawlee.dev/js/api/core/enum/EnqueueStrategy.md). You can use the [`All`](https://crawlee.dev/js/api/core/enum/EnqueueStrategy.md#All) strategy if you want to follow every single link, regardless of its domain, or you can enqueue links that target the same domain name with the [`SameDomain`](https://crawlee.dev/js/api/core/enum/EnqueueStrategy.md#SameDomain) strategy.

```
await enqueueLinks({

    strategy: 'all', // wander the internet

});
```

### Filter URLs with patterns[​](#filter-urls-with-patterns "Direct link to Filter URLs with patterns")

For even more control, you can use `globs`, `regexps` and `pseudoUrls` to filter the URLs. Each of those arguments is always an `Array`, but the contents can take on many forms. [See the reference](https://crawlee.dev/js/api/core/interface/EnqueueLinksOptions.md) for more information about them as well as other options.

Defaults override

If you provide one of those options, the default `same-hostname` strategy will **not** be applied unless explicitly set in the options.

```
await enqueueLinks({

    globs: ['http?(s)://apify.com/*/*'],

});
```

### Transform requests[​](#transform-requests "Direct link to Transform requests")

To have absolute control, we have the [`transformRequestFunction`](https://crawlee.dev/js/api/core/interface/EnqueueLinksOptions.md#transformRequestFunction). Just before a new [`Request`](https://crawlee.dev/js/api/core/class/Request.md) is constructed and enqueued to the [`RequestQueue`](https://crawlee.dev/js/api/core/class/RequestQueue.md), this function can be used to skip it or modify its contents such as `userData`, `payload` or, most importantly, `uniqueKey`. This is useful when you need to enqueue multiple requests to the queue, and these requests share the same URL, but differ in methods or payloads. Another use case is to dynamically update or create the `userData`.

```
await enqueueLinks({

    globs: ['http?(s)://apify.com/*/*'],

    transformRequestFunction(req) {

        // ignore all links ending with `.pdf`

        if (req.url.endsWith('.pdf')) return false;

        return req;

    },

});
```

And that's it! `enqueueLinks()` is just one example of Crawlee's powerful helper functions. They're all designed to make your life easier, so you can focus on getting your data, while leaving the mundane crawling management to the tools.

## Next steps[​](#next-steps "Direct link to Next steps")

Next, you will start your project of scraping a production website and learn some more Crawlee tricks in the process.
