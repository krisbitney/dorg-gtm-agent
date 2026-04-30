Help me plan out v2 of my lead generation agent, which will locate leads for my software development consultancy.

We will use a combination of the serper.dev SERP API (as the search provider) and context.dev (as the page scraper) to search the web and scrape web pages.

The new search flow should look like this:

    1. AI workflow creates a set of search terms with the format: { searchQuery: string; site: "reddit", startDateTime: "...", endDateTime: "..." }, where the actual site and datetimes are determined by input parameters and not by the LLM. Note that the search provider manager implementation will handle converting the start/end times to a time-based search (tbs) term.
        - the number of search terms to generate should be configurable
        - hashing each search term object and check/insert into a bloom filter (redis set) with an expiration timer based on the datetimes
    2. for each generated search term, use search provider to search using the site and tbs parameters to specify the target site and time range.
    3. filters search results by checking URLs against bloom filter (redis set) to avoid duplication
    4. filters remaining search results based on likelihood that result might be a lead (using the basic description from the search results returned by the SERP API)
        - we should be able to configure this prompt so that it works for other kinds of consultancies as well
    5. worker uses context.dev to scrape web pages from search result URLs that were identified as potential leads; adds to postgres db, redis queue, bloom filter (redis set)

We will keep the original worker and AI workflows, and improve them:
1. checks content from each scraped webpage to verify whether or not it is a lead. Scores the lead on a quality scale of 0-100, where 0 is not a lead and 100 is high-quality lead.
- we should be able to inject terms into the prompt that help configure how the results are filtered, like "if budget is mentioned, must have > $50k budget"
- we should be able to configure this prompt so that it works for other kinds of consultancies as well
- worker updates postgres db
2. For each lead with a quality score above 50 (configurable), extract all useful information with structured output
- worker updates postgresql database, claims and surfaces lead with dOrg API

There should be a new ai workflow to do deep research on a lead:
1. it should generate searches based on base lead information in order to find more detailed lead information.
    - e.g., we want to find and scrape the user's reddit profile, company contact information, etc.
    - the goal is to find as much information about the lead as possible, especially contact information, size of the company, the company's funding/budget, the company's business strategy and products, and so on
    - the number of search terms and search results should be limited to make sure the agent doesn't spend too many tokens
    - the agent will basically generate a set of search terms using anchors: search linkedin, publicly accessible sites that are similar to zoominfo, and other relevant options
        - the agent should always include the user profile if the main content is a social media post
2. scrape relevant search results with verification etc.
    - verification must involve confirming that the result is related to the right entity (e.g., a startup company named "apex" should not be confused with a programming language named "apex")
3. worker will update lead in db

There should be a new ai workflow to construct a high-conversion message to send to a lead for initial outreach:
1. it should use all available information, which may or may not include a deep research report
2. worker will add to lead entry in db

It should be possible to make deep research and message generation automatically triger for leads with quality scores greater than or equal to a specified value, such as 90.

It should be possible to trigger the new search flow, the new deep research flow, and the new message generation flows manually.

It should be possible for the process to essentially run in a loop, with the ability to control runs with stopping parameters (both defined in the request and that can be configured at runtime). The parameters might include how long it should run for, how many search results to process before stopping, and how many leads to generate before stopping. As in v1, the workers must track the run state properly and handle graceful shutdown and startup.

A human should be able to adjust the agent's configuration and monitor it while it is running. (e.g., adjust tbs, turn off automatic deep research, turn off automatic essage generation) The agent will be configurable and monitored through a web/mobile app that we will create after the agent. The app will be used to control the agent like a remote control and view its results. The app will also operate like a CRM, serving as a bridge between the AI agent and human handoff. So we need to make sure the endpoints are available to view leads, filter by their state, request deep research, etc.

Use interfaces to make sure it is easy to replace serp api and context.dev with alternatives later on if we want to (and to swap back as well)
- note that different search providers might handle site and tbs parameters differently, so the interface and implementation needs to be able to handle this
