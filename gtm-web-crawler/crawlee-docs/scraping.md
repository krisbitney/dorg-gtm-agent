# Scraping the Store

In the [Real-world project chapter](https://crawlee.dev/js/docs/introduction/real-world-project.md#choosing-the-data-you-need), you've created a list of the information you wanted to collect about the products in the example Warehouse store. Let's review that and figure out ways to access the data.

* URL
* Manufacturer
* SKU
* Title
* Current price
* Stock available

![data to scrape](/assets/images/scraping-practice-ed4e3a233c852ffa694b80371fed9d37.jpg "Overview of data to be scraped.")

### Scraping the URL, Manufacturer and SKU[​](#scraping-the-url-manufacturer-and-sku "Direct link to Scraping the URL, Manufacturer and SKU")

Some information is lying right there in front of us without even having to touch the product detail pages. The `URL` we already have - the `request.url`. And by looking at it carefully, we realize that we can also extract the manufacturer from the URL (as all product urls start with `/products/<manufacturer>`). We can just split the `string` and be on our way then!

`request.loaderUrl` vs `request.url`

You can use `request.loadedUrl` as well. Remember the difference: `request.url` is what you enqueue, `request.loadedUrl` is what gets processed (after possible redirects).

```
// request.url = https://warehouse-theme-metal.myshopify.com/products/sennheiser-mke-440-professional-stereo-shotgun-microphone-mke-440



const urlPart = request.url.split('/').slice(-1); // ['sennheiser-mke-440-professional-stereo-shotgun-microphone-mke-440']

const manufacturer = urlPart[0].split('-')[0]; // 'sennheiser'
```

Storing information

It's a matter of preference, whether to store this information separately in the resulting dataset, or not. Whoever uses the dataset can easily parse the `manufacturer` from the `URL`, so should you duplicate the data unnecessarily? Our opinion is that unless the increased data consumption would be too large to bear, it's better to make the dataset as rich as possible. For example, someone might want to filter by `manufacturer`.

Adapt and extract

One thing you may notice is that the `manufacturer` might have a `-` in its name. If that's the case, your best bet is extracting it from the details page instead, but it's not mandatory. At the end of the day, you should always adjust and pick the best solution for your use case, and website you are crawling.

Now it's time to add more data to the results. Let's open one of the product detail pages, for example the [`Sony XBR-950G`](https://warehouse-theme-metal.myshopify.com/products/sony-xbr-65x950g-65-class-64-5-diag-bravia-4k-hdr-ultra-hd-tv) page and use our DevTools-Fu 🥋 to figure out how to get the title of the product.

### Title[​](#title "Direct link to Title")

![product title](/assets/images/title-8f63a08e5ecf82b5547f1fac8ffc77a7.jpg "Finding product title in DevTools.")

By using the element selector tool, you can see that the title is there under an `<h1>` tag, as titles should be. The `<h1>` tag is enclosed in a `<div>` with class `product-meta`. We can leverage this to create a combined selector `.product-meta h1`. It selects any `<h1>` element that is a child of a different element with the class `product-meta`.

Verifying selectors with DevTools

Remember that you can press CTRL+F (or CMD+F on Mac) in the **Elements** tab of DevTools to open the search bar where you can quickly search for elements using their selectors. Always verify your scraping process and assumptions using the DevTools. It's faster than changing the crawler code all the time.

To get the title, you need to find it using `Playwright` and a `.product-meta h1` locator, which selects the `<h1>` element you're looking for, or throws, if it finds more than one. That's good. It's usually better to crash the crawler than silently return bad data.

```
const title = await page.locator('.product-meta h1').textContent();
```

### SKU[​](#sku "Direct link to SKU")

Using the DevTools, you can find that the product SKU is inside a `<span>` tag with a class `product-meta__sku-number`. And since there's no other `<span>` with that class on the page, you can safely use it.

![product sku selector](/assets/images/sku-4427a5a820183e7c74fb4beeabcf9116.jpg "Finding product SKU in DevTools.")

```
const sku = await page.locator('span.product-meta__sku-number').textContent();
```

### Current price[​](#current-price "Direct link to Current price")

DevTools can tell you that the `currentPrice` can be found in a `<span>` element tagged with the `price` class. But it also shows that it is nested as raw text alongside another `<span>` element with the `visually-hidden` class. You don't want that, so you need to filter it out, and the `hasText` helper can be used for that for that.

![product current price selector](/assets/images/current-price-16b0f4b92332837111d04f632234d2c3.jpg "Finding product current price in DevTools.")

```
const priceElement = page

    .locator('span.price')

    .filter({

        hasText: '$',

    })

    .first();



const currentPriceString = await priceElement.textContent();

const rawPrice = currentPriceString.split('$')[1];

const price = Number(rawPrice.replaceAll(',', ''));
```

It might look a little too complex at first glance, but let's walk through what you did. First off, you find the right part of the `price` span (specifically the actual price) by filtering the element that has the `$` sign in it. When you do that, you will get a string similar to `Sale price$1,398.00`. This, by itself, is not that useful, so you extract the actual numeric part by splitting by the `$` sign.

Once you do that, you receive a string that represents our price, but you will be converting it to a number. You do that by replacing all the commas with nothingness (so we can parse it into a number), then it is parsed into a number using `Number()`.

### Stock available[​](#stock-available "Direct link to Stock available")

You're finishing up with the `availableInStock`. There is a span with the `product-form__inventory` class, and it contains the text `In stock`. You can use the `hasText` helper again to filter out the right element.

```
const inStockElement = await page

    .locator('span.product-form__inventory')

    .filter({

        hasText: 'In stock',

    })

    .first();



const inStock = (await inStockElement.count()) > 0;
```

For this, all that matter is whether the element exists or not, so you can use the `count()` method to check if there are any elements that match our selector. If there are, that means the product is in stock.

And there you have it! All the needed data. For the sake of completeness, let's add all the properties together, and you're good to go.

```
const urlPart = request.url.split('/').slice(-1); // ['sennheiser-mke-440-professional-stereo-shotgun-microphone-mke-440']

const manufacturer = urlPart.split('-')[0]; // 'sennheiser'



const title = await page.locator('.product-meta h1').textContent();

const sku = await page.locator('span.product-meta__sku-number').textContent();



const priceElement = page

    .locator('span.price')

    .filter({

        hasText: '$',

    })

    .first();



const currentPriceString = await priceElement.textContent();

const rawPrice = currentPriceString.split('$')[1];

const price = Number(rawPrice.replaceAll(',', ''));



const inStockElement = await page

    .locator('span.product-form__inventory')

    .filter({

        hasText: 'In stock',

    })

    .first();



const inStock = (await inStockElement.count()) > 0;
```

## Trying it out[​](#trying-it-out "Direct link to Trying it out")

You have everything that is needed, so grab your newly created scraping logic, dump it into your original `requestHandler()` and see the magic happen!

[Run on](https://console.apify.com/actors/6i5QsHBMtm3hKph70?runConfig=eyJ1IjoiRWdQdHczb2VqNlRhRHQ1cW4iLCJ2IjoxfQ.eyJpbnB1dCI6IntcImNvZGVcIjpcImltcG9ydCB7IFBsYXl3cmlnaHRDcmF3bGVyIH0gZnJvbSAnY3Jhd2xlZSc7XFxuXFxuY29uc3QgY3Jhd2xlciA9IG5ldyBQbGF5d3JpZ2h0Q3Jhd2xlcih7XFxuICAgIHJlcXVlc3RIYW5kbGVyOiBhc3luYyAoeyBwYWdlLCByZXF1ZXN0LCBlbnF1ZXVlTGlua3MgfSkgPT4ge1xcbiAgICAgICAgY29uc29sZS5sb2coYFByb2Nlc3Npbmc6ICR7cmVxdWVzdC51cmx9YCk7XFxuICAgICAgICBpZiAocmVxdWVzdC5sYWJlbCA9PT0gJ0RFVEFJTCcpIHtcXG4gICAgICAgICAgICBjb25zdCB1cmxQYXJ0ID0gcmVxdWVzdC51cmwuc3BsaXQoJy8nKS5zbGljZSgtMSk7IC8vIFsnc2VubmhlaXNlci1ta2UtNDQwLXByb2Zlc3Npb25hbC1zdGVyZW8tc2hvdGd1bi1taWNyb3Bob25lLW1rZS00NDAnXVxcbiAgICAgICAgICAgIGNvbnN0IG1hbnVmYWN0dXJlciA9IHVybFBhcnRbMF0uc3BsaXQoJy0nKVswXTsgLy8gJ3Nlbm5oZWlzZXInXFxuXFxuICAgICAgICAgICAgY29uc3QgdGl0bGUgPSBhd2FpdCBwYWdlLmxvY2F0b3IoJy5wcm9kdWN0LW1ldGEgaDEnKS50ZXh0Q29udGVudCgpO1xcbiAgICAgICAgICAgIGNvbnN0IHNrdSA9IGF3YWl0IHBhZ2UubG9jYXRvcignc3Bhbi5wcm9kdWN0LW1ldGFfX3NrdS1udW1iZXInKS50ZXh0Q29udGVudCgpO1xcblxcbiAgICAgICAgICAgIGNvbnN0IHByaWNlRWxlbWVudCA9IHBhZ2VcXG4gICAgICAgICAgICAgICAgLmxvY2F0b3IoJ3NwYW4ucHJpY2UnKVxcbiAgICAgICAgICAgICAgICAuZmlsdGVyKHtcXG4gICAgICAgICAgICAgICAgICAgIGhhc1RleHQ6ICckJyxcXG4gICAgICAgICAgICAgICAgfSlcXG4gICAgICAgICAgICAgICAgLmZpcnN0KCk7XFxuXFxuICAgICAgICAgICAgY29uc3QgY3VycmVudFByaWNlU3RyaW5nID0gYXdhaXQgcHJpY2VFbGVtZW50LnRleHRDb250ZW50KCk7XFxuICAgICAgICAgICAgY29uc3QgcmF3UHJpY2UgPSBjdXJyZW50UHJpY2VTdHJpbmc_LnNwbGl0KCckJylbMV07XFxuICAgICAgICAgICAgY29uc3QgcHJpY2UgPSBOdW1iZXIocmF3UHJpY2U_LnJlcGxhY2VBbGwoJywnLCAnJykpO1xcblxcbiAgICAgICAgICAgIGNvbnN0IGluU3RvY2tFbGVtZW50ID0gcGFnZVxcbiAgICAgICAgICAgICAgICAubG9jYXRvcignc3Bhbi5wcm9kdWN0LWZvcm1fX2ludmVudG9yeScpXFxuICAgICAgICAgICAgICAgIC5maWx0ZXIoe1xcbiAgICAgICAgICAgICAgICAgICAgaGFzVGV4dDogJ0luIHN0b2NrJyxcXG4gICAgICAgICAgICAgICAgfSlcXG4gICAgICAgICAgICAgICAgLmZpcnN0KCk7XFxuXFxuICAgICAgICAgICAgY29uc3QgaW5TdG9jayA9IChhd2FpdCBpblN0b2NrRWxlbWVudC5jb3VudCgpKSA-IDA7XFxuXFxuICAgICAgICAgICAgY29uc3QgcmVzdWx0cyA9IHtcXG4gICAgICAgICAgICAgICAgdXJsOiByZXF1ZXN0LnVybCxcXG4gICAgICAgICAgICAgICAgbWFudWZhY3R1cmVyLFxcbiAgICAgICAgICAgICAgICB0aXRsZSxcXG4gICAgICAgICAgICAgICAgc2t1LFxcbiAgICAgICAgICAgICAgICBjdXJyZW50UHJpY2U6IHByaWNlLFxcbiAgICAgICAgICAgICAgICBhdmFpbGFibGVJblN0b2NrOiBpblN0b2NrLFxcbiAgICAgICAgICAgIH07XFxuXFxuICAgICAgICAgICAgY29uc29sZS5sb2cocmVzdWx0cyk7XFxuICAgICAgICB9IGVsc2UgaWYgKHJlcXVlc3QubGFiZWwgPT09ICdDQVRFR09SWScpIHtcXG4gICAgICAgICAgICAvLyBXZSBhcmUgbm93IG9uIGEgY2F0ZWdvcnkgcGFnZS4gV2UgY2FuIHVzZSB0aGlzIHRvIHBhZ2luYXRlIHRocm91Z2ggYW5kIGVucXVldWUgYWxsIHByb2R1Y3RzLFxcbiAgICAgICAgICAgIC8vIGFzIHdlbGwgYXMgYW55IHN1YnNlcXVlbnQgcGFnZXMgd2UgZmluZFxcblxcbiAgICAgICAgICAgIGF3YWl0IHBhZ2Uud2FpdEZvclNlbGVjdG9yKCcucHJvZHVjdC1pdGVtID4gYScpO1xcbiAgICAgICAgICAgIGF3YWl0IGVucXVldWVMaW5rcyh7XFxuICAgICAgICAgICAgICAgIHNlbGVjdG9yOiAnLnByb2R1Y3QtaXRlbSA-IGEnLFxcbiAgICAgICAgICAgICAgICBsYWJlbDogJ0RFVEFJTCcsIC8vIDw9IG5vdGUgdGhlIGRpZmZlcmVudCBsYWJlbFxcbiAgICAgICAgICAgIH0pO1xcblxcbiAgICAgICAgICAgIC8vIE5vdyB3ZSBuZWVkIHRvIGZpbmQgdGhlIFxcXCJOZXh0XFxcIiBidXR0b24gYW5kIGVucXVldWUgdGhlIG5leHQgcGFnZSBvZiByZXN1bHRzIChpZiBpdCBleGlzdHMpXFxuICAgICAgICAgICAgY29uc3QgbmV4dEJ1dHRvbiA9IGF3YWl0IHBhZ2UuJCgnYS5wYWdpbmF0aW9uX19uZXh0Jyk7XFxuICAgICAgICAgICAgaWYgKG5leHRCdXR0b24pIHtcXG4gICAgICAgICAgICAgICAgYXdhaXQgZW5xdWV1ZUxpbmtzKHtcXG4gICAgICAgICAgICAgICAgICAgIHNlbGVjdG9yOiAnYS5wYWdpbmF0aW9uX19uZXh0JyxcXG4gICAgICAgICAgICAgICAgICAgIGxhYmVsOiAnQ0FURUdPUlknLCAvLyA8PSBub3RlIHRoZSBzYW1lIGxhYmVsXFxuICAgICAgICAgICAgICAgIH0pO1xcbiAgICAgICAgICAgIH1cXG4gICAgICAgIH0gZWxzZSB7XFxuICAgICAgICAgICAgLy8gVGhpcyBtZWFucyB3ZSdyZSBvbiB0aGUgc3RhcnQgcGFnZSwgd2l0aCBubyBsYWJlbC5cXG4gICAgICAgICAgICAvLyBPbiB0aGlzIHBhZ2UsIHdlIGp1c3Qgd2FudCB0byBlbnF1ZXVlIGFsbCB0aGUgY2F0ZWdvcnkgcGFnZXMuXFxuXFxuICAgICAgICAgICAgYXdhaXQgcGFnZS53YWl0Rm9yU2VsZWN0b3IoJy5jb2xsZWN0aW9uLWJsb2NrLWl0ZW0nKTtcXG4gICAgICAgICAgICBhd2FpdCBlbnF1ZXVlTGlua3Moe1xcbiAgICAgICAgICAgICAgICBzZWxlY3RvcjogJy5jb2xsZWN0aW9uLWJsb2NrLWl0ZW0nLFxcbiAgICAgICAgICAgICAgICBsYWJlbDogJ0NBVEVHT1JZJyxcXG4gICAgICAgICAgICB9KTtcXG4gICAgICAgIH1cXG4gICAgfSxcXG5cXG4gICAgLy8gTGV0J3MgbGltaXQgb3VyIGNyYXdscyB0byBtYWtlIG91ciB0ZXN0cyBzaG9ydGVyIGFuZCBzYWZlci5cXG4gICAgbWF4UmVxdWVzdHNQZXJDcmF3bDogNTAsXFxufSk7XFxuXFxuYXdhaXQgY3Jhd2xlci5ydW4oWydodHRwczovL3dhcmVob3VzZS10aGVtZS1tZXRhbC5teXNob3BpZnkuY29tL2NvbGxlY3Rpb25zJ10pO1xcblwifSIsIm9wdGlvbnMiOnsiYnVpbGQiOiJsYXRlc3QiLCJjb250ZW50VHlwZSI6ImFwcGxpY2F0aW9uL2pzb247IGNoYXJzZXQ9dXRmLTgiLCJtZW1vcnkiOjQwOTYsInRpbWVvdXQiOjE4MH19.B_vQyUloFhJsL0ZP-ZEKbaIGsNN9zJRTdTsK4PBl-Gs\&asrc=run_on_apify)

```
import { PlaywrightCrawler } from 'crawlee';



const crawler = new PlaywrightCrawler({

    requestHandler: async ({ page, request, enqueueLinks }) => {

        console.log(`Processing: ${request.url}`);

        if (request.label === 'DETAIL') {

            const urlPart = request.url.split('/').slice(-1); // ['sennheiser-mke-440-professional-stereo-shotgun-microphone-mke-440']

            const manufacturer = urlPart[0].split('-')[0]; // 'sennheiser'



            const title = await page.locator('.product-meta h1').textContent();

            const sku = await page.locator('span.product-meta__sku-number').textContent();



            const priceElement = page

                .locator('span.price')

                .filter({

                    hasText: '$',

                })

                .first();



            const currentPriceString = await priceElement.textContent();

            const rawPrice = currentPriceString?.split('$')[1];

            const price = Number(rawPrice?.replaceAll(',', ''));



            const inStockElement = page

                .locator('span.product-form__inventory')

                .filter({

                    hasText: 'In stock',

                })

                .first();



            const inStock = (await inStockElement.count()) > 0;



            const results = {

                url: request.url,

                manufacturer,

                title,

                sku,

                currentPrice: price,

                availableInStock: inStock,

            };



            console.log(results);

        } else if (request.label === 'CATEGORY') {

            // We are now on a category page. We can use this to paginate through and enqueue all products,

            // as well as any subsequent pages we find



            await page.waitForSelector('.product-item > a');

            await enqueueLinks({

                selector: '.product-item > a',

                label: 'DETAIL', // <= note the different label

            });



            // Now we need to find the "Next" button and enqueue the next page of results (if it exists)

            const nextButton = await page.$('a.pagination__next');

            if (nextButton) {

                await enqueueLinks({

                    selector: 'a.pagination__next',

                    label: 'CATEGORY', // <= note the same label

                });

            }

        } else {

            // This means we're on the start page, with no label.

            // On this page, we just want to enqueue all the category pages.



            await page.waitForSelector('.collection-block-item');

            await enqueueLinks({

                selector: '.collection-block-item',

                label: 'CATEGORY',

            });

        }

    },



    // Let's limit our crawls to make our tests shorter and safer.

    maxRequestsPerCrawl: 50,

});



await crawler.run(['https://warehouse-theme-metal.myshopify.com/collections']);
```

When you run the crawler, you will see the crawled URLs and their scraped data printed to the console. The output will look something like this:

```
{

    "url": "https://warehouse-theme-metal.myshopify.com/products/sony-str-za810es-7-2-channel-hi-res-wi-fi-network-av-receiver",

    "manufacturer": "sony",

    "title": "Sony STR-ZA810ES 7.2-Ch Hi-Res Wi-Fi Network A/V Receiver",

    "sku": "SON-692802-STR-DE",

    "currentPrice": 698,

    "availableInStock": true

}
```

## Next steps[​](#next-steps "Direct link to Next steps")

Next, you'll see how to save the data you scraped to the disk for further processing.
