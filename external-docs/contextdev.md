> ## Documentation Index
> Fetch the complete documentation index at: https://docs.context.dev/llms.txt
> Use this file to discover all available pages before exploring further.

# Scrape Markdown

> Scrapes the given URL into LLM usable Markdown.

<Badge color="blue">1 Credit</Badge>


## OpenAPI

````yaml https://app.stainless.com/api/spec/documented/context.dev/openapi.documented.yml get /web/scrape/markdown
openapi: 3.0.0
info:
  title: Context API
  description: API for retrieving context data from any website
  version: 1.0.0
servers:
  - url: https://api.context.dev/v1
security: []
paths:
  /web/scrape/markdown:
    get:
      tags:
        - Web Scraping
      summary: Scrape Markdown
      description: Scrapes the given URL into LLM usable Markdown.
      parameters:
        - name: url
          in: query
          required: true
          schema:
            type: string
            format: uri
          description: >-
            Full URL to scrape into LLM usable Markdown (must include http:// or
            https:// protocol)
        - name: includeLinks
          in: query
          required: false
          schema:
            type: boolean
            default: true
          description: Preserve hyperlinks in Markdown output
        - name: includeImages
          in: query
          required: false
          schema:
            type: boolean
            default: false
          description: Include image references in Markdown output
        - name: shortenBase64Images
          in: query
          required: false
          schema:
            type: boolean
            default: true
          description: Shorten base64-encoded image data in the Markdown output
        - name: useMainContentOnly
          in: query
          required: false
          schema:
            type: boolean
            default: false
          description: >-
            Extract only the main content of the page, excluding headers,
            footers, sidebars, and navigation
        - name: parsePDF
          in: query
          required: false
          schema:
            type: boolean
            default: true
          description: >-
            When true (default), PDF URLs are fetched and their text layer is
            extracted and converted to Markdown. When false, PDF URLs are
            skipped and a 400 WEBSITE_ACCESS_ERROR is returned.
        - name: includeFrames
          in: query
          required: false
          schema:
            type: boolean
            default: false
          description: When true, the contents of iframes are rendered to Markdown.
        - name: maxAgeMs
          in: query
          required: false
          schema:
            type: integer
            minimum: 0
            maximum: 2592000000
            default: 86400000
          description: >-
            Return a cached result if a prior scrape for the same parameters
            exists and is younger than this many milliseconds. Defaults to 1 day
            (86400000 ms) when omitted. Max is 30 days (2592000000 ms). Set to 0
            to always scrape fresh.
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    enum:
                      - true
                    description: Indicates success
                  markdown:
                    type: string
                    description: Page content converted to GitHub Flavored Markdown
                  url:
                    type: string
                    description: The URL that was scraped
                required:
                  - success
                  - markdown
                  - url
        '400':
          description: Bad request - Invalid URL or failed to scrape
          content:
            application/json:
              schema:
                type: object
                properties:
                  message:
                    type: string
                    description: Error message describing the issue
                  error_code:
                    type: string
                    enum:
                      - INPUT_VALIDATION_ERROR
                      - WEBSITE_ACCESS_ERROR
                    description: Error code indicating the type of error
                required:
                  - message
                  - error_code
        '401':
          description: Unauthorized - Invalid or missing API key
          content:
            application/json:
              schema:
                type: object
                properties:
                  message:
                    type: string
                    description: Error message
                  error_code:
                    type: string
                    enum:
                      - UNAUTHORIZED
                    description: Error code indicating unauthorized access
        '403':
          description: Forbidden - Insufficient permissions or usage limit exceeded
          content:
            application/json:
              schema:
                type: object
                properties:
                  message:
                    type: string
                    description: Error message
                  error_code:
                    type: string
                    enum:
                      - FORBIDDEN
                      - USAGE_EXCEEDED
                      - DISABLED
                      - INSUFFICIENT_PERMISSIONS
                    description: Error code indicating forbidden access
        '408':
          description: Request timeout
          content:
            application/json:
              schema:
                type: object
                properties:
                  message:
                    type: string
                    description: Timeout error message
                  error_code:
                    type: string
                    enum:
                      - REQUEST_TIMEOUT
                    description: Error code indicating request timeout
        '500':
          description: Internal server error
          content:
            application/json:
              schema:
                type: object
                properties:
                  message:
                    type: string
                    description: Error message
                  error_code:
                    type: string
                    enum:
                      - INTERNAL_ERROR
                    description: Error code indicating internal server error
      security:
        - bearerAuth: []
      x-codeSamples:
        - lang: JavaScript
          source: >-
            import ContextDev from 'context.dev';


            const client = new ContextDev({
              apiKey: process.env['CONTEXT_DEV_API_KEY'], // This is the default and can be omitted
            });


            const response = await client.web.webScrapeMd({ url:
            'https://example.com' });


            console.log(response.markdown);
        - lang: Python
          source: |-
            import os
            from context.dev import ContextDev

            client = ContextDev(
                api_key=os.environ.get("CONTEXT_DEV_API_KEY"),  # This is the default and can be omitted
            )
            response = client.web.web_scrape_md(
                url="https://example.com",
            )
            print(response.markdown)
        - lang: Ruby
          source: |-
            require "context_dev"

            context_dev = ContextDev::Client.new(api_key: "My API Key")

            response = context_dev.web.web_scrape_md(url: "https://example.com")

            puts(response)
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer

````