# First crawler

Now, you will build your first crawler. But before you do, let's briefly introduce the Crawlee classes involved in the process.

## How Crawlee works[​](#how-crawlee-works "Direct link to How Crawlee works")

There are 3 main crawler classes available for use in Crawlee.

* [`CheerioCrawler`](https://crawlee.dev/js/api/cheerio-crawler/class/CheerioCrawler.md)
* [`PuppeteerCrawler`](https://crawlee.dev/js/api/puppeteer-crawler/class/PuppeteerCrawler.md)
* [`PlaywrightCrawler`](https://crawlee.dev/js/api/playwright-crawler/class/PlaywrightCrawler.md)

We'll talk about their differences later. Now, let's talk about what they have in common.

The general idea of each crawler is to go to a web page, open it, do some stuff there, save some results, continue to the next page, and repeat this process until the crawler's done its job. So the crawler always needs to find answers to two questions: *Where should I go?* and *What should I do there?* Answering those two questions is the only required setup. The crawlers have reasonable defaults for everything else.

### The Where - `Request` and `RequestQueue`[​](#the-where---request-and-requestqueue "Direct link to the-where---request-and-requestqueue")

All crawlers use instances of the [`Request`](https://crawlee.dev/js/api/core/class/Request.md) class to determine where they need to go. Each request may hold a lot of information, but at the very least, it must hold a URL - a web page to open. But having only one URL would not make sense for crawling. Sometimes you have a pre-existing list of your own URLs that you wish to visit, perhaps a thousand. Other times you need to build this list dynamically as you crawl, adding more and more URLs to the list as you progress. Most of the time, you will use both options.

The requests are stored in a [`RequestQueue`](https://crawlee.dev/js/api/core/class/RequestQueue.md), a dynamic queue of `Request` instances. You can seed it with start URLs and also add more requests while the crawler is running. This allows the crawler to open one page, extract interesting URLs, such as links to other pages on the same domain, add them to the queue (called *enqueuing*) and repeat this process to build a queue of virtually unlimited number of URLs.

### The What - `requestHandler`[​](#the-what---requesthandler "Direct link to the-what---requesthandler")

In the `requestHandler` you tell the crawler what to do at each and every page it visits. You can use it to handle extraction of data from the page, processing the data, saving it, calling APIs, doing calculations and so on.

The `requestHandler` is a user-defined function, invoked automatically by the crawler for each `Request` from the `RequestQueue`. It always receives a single argument - a [`CrawlingContext`](https://crawlee.dev/js/api/core/interface/CrawlingContext.md). Its properties change depending on the crawler class used, but it always includes the `request` property, which represents the currently crawled URL and related metadata.

## Building a crawler[​](#building-a-crawler "Direct link to Building a crawler")

Let's put the theory into practice and start with something easy. Visit a page and get its HTML title. In this tutorial, you'll scrape the Crawlee website <https://crawlee.dev>, but the same code will work for any website.

Top level await configuration

We are using a JavaScript feature called [Top level await](https://blog.saeloun.com/2021/11/25/ecmascript-top-level-await.html) in our examples. To be able to use that, you might need some extra setup. Namely, it requires the use of [ECMAScript Modules](https://nodejs.org/api/esm.html) - this means you either need to add `"type": "module"` to your `package.json` file, or use `*.mjs` extension for your files. Additionally, if you are in a TypeScript project, you need to set the `module` and `target` compiler options to `ES2022` or above.

### Adding requests to the crawling queue[​](#adding-requests-to-the-crawling-queue "Direct link to Adding requests to the crawling queue")

Earlier you learned that the crawler uses a queue of requests as its source of URLs to crawl. Let's create it and add the first request.

src/main.js

```
import { RequestQueue } from 'crawlee';



// First you create the request queue instance.

const requestQueue = await RequestQueue.open();

// And then you add one or more requests to it.

await requestQueue.addRequest({ url: 'https://crawlee.dev' });
```

The [`requestQueue.addRequest()`](https://crawlee.dev/js/api/core/class/RequestQueue.md#addRequest) function automatically converts the object with URL string to a [`Request`](https://crawlee.dev/js/api/core/class/Request.md) instance. So now you have a `requestQueue` that holds one request which points to `https://crawlee.dev`.

Bulk add requests

The code above is for illustration of the request queue concept. Soon you'll learn about the `crawler.addRequests()` method which allows you to skip this initialization code, and it also supports adding a large number of requests without blocking.

### Building a CheerioCrawler[​](#building-a-cheeriocrawler "Direct link to Building a CheerioCrawler")

Crawlee comes with three main crawler classes: [`CheerioCrawler`](https://crawlee.dev/js/api/cheerio-crawler/class/CheerioCrawler.md), [`PuppeteerCrawler`](https://crawlee.dev/js/api/puppeteer-crawler/class/PuppeteerCrawler.md) and [`PlaywrightCrawler`](https://crawlee.dev/js/api/playwright-crawler/class/PlaywrightCrawler.md). You can read their short descriptions in the [Quick start](https://crawlee.dev/js/docs/quick-start.md) lesson.

Unless you have a good reason to start with a different one, you should try building a `CheerioCrawler` first. It is an HTTP crawler with HTTP2 support, anti-blocking features and integrated HTML parser - [Cheerio](https://www.npmjs.com/package/cheerio). It's fast, simple, cheap to run and does not require complicated dependencies. The only downside is that it won't work out of the box for websites which require JavaScript rendering. But you might not need JavaScript rendering at all, because many modern websites use server-side rendering.

Let's continue with the earlier `RequestQueue` example.

src/main.js

```
// Add import of CheerioCrawler

import { RequestQueue, CheerioCrawler } from 'crawlee';



const requestQueue = await RequestQueue.open();

await requestQueue.addRequest({ url: 'https://crawlee.dev' });



// Create the crawler and add the queue with our URL

// and a request handler to process the page.

const crawler = new CheerioCrawler({

    requestQueue,

    // The `$` argument is the Cheerio object

    // which contains parsed HTML of the website.

    async requestHandler({ $, request }) {

        // Extract <title> text with Cheerio.

        // See Cheerio documentation for API docs.

        const title = $('title').text();

        console.log(`The title of "${request.url}" is: ${title}.`);

    }

})



// Start the crawler and wait for it to finish

await crawler.run();
```

When you run the example, you will see the title of <https://crawlee.dev> printed to the log. What really happens is that CheerioCrawler first makes an HTTP request to `https://crawlee.dev`, then parses the received HTML with Cheerio and makes it available as the `$` argument of the `requestHandler`.

```
The title of "https://crawlee.dev" is: Crawlee · The scalable web crawling, scraping and automation library for JavaScript/Node.js | Crawlee.
```

### Add requests faster[​](#add-requests-faster "Direct link to Add requests faster")

Earlier we mentioned that you'll learn how to use the `crawler.addRequests()` method to skip the request queue initialization. It's simple. Every crawler has an implicit `RequestQueue` instance, and you can add requests to it with the `crawler.addRequests()` method. In fact, you can go even further and just use the first parameter of `crawler.run()`!

src/main.js

```
// You don't need to import RequestQueue anymore

import { CheerioCrawler } from 'crawlee';



const crawler = new CheerioCrawler({

    async requestHandler({ $, request }) {

        const title = $('title').text();

        console.log(`The title of "${request.url}" is: ${title}.`);

    }

})



// Start the crawler with the provided URLs

await crawler.run(['https://crawlee.dev']);
```

When you run this code, you'll see exactly the same output as with the earlier, longer example. The `RequestQueue` is still there, it's just managed by the crawler automatically.

info

This method not only makes the code shorter, it will help with performance too! It will wait only for the initial batch of 1000 requests to be added to the queue before resolving, which means the processing will start almost instantly. After that, it will continue adding the rest of the requests in the background (again, in batches of 1000 items, once every second).

## Next steps[​](#next-steps "Direct link to Next steps")

Next, you'll learn about crawling links. That means finding new URLs on the pages you crawl and adding them to the `RequestQueue` for the crawler to visit.
