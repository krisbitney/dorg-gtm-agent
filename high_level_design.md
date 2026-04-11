# High Level Design for Go-To-Market Agent

The purpose of the GTM Agent is to find leads for the dOrg web3 tech/dev consultancy.

## GTM Web Crawler
The gtm-web-crawler service will crawl a select set of web3-related subreddits and extract data from posts. 

Flow:
1. check url presence in redis-based bloom filter (and add to bloom filter set)
  - skip if already in bloom filter
2. parse the post to obtain:
   - username of poster
   - post content
   - age of post (best estimate)
   - likes # number of likes
   - nComments # number of comments
3. combine parsed content with:
   - url
   - platform ("reddit")
   - topic (subreddit name)
   - current datetime
4. insert into sql database table with UUIDv7 id primary key and status "pending"
5. append payload { id: UUIDv7; platform: "reddit" } to redis-based queue.

The gtm web crawler should be use reasonable rate limits and production-ready anti-detection measures to ensure it is not flagged as a web crawler by Reddit.

Tech stack: 
- typescript
- crawlee
- bun redis client
- bun sql client

## GTM AI

The gtm-ai service is a mastra service that will be responsible for AI-driven decision-making. It will feature two workflows:
1. A small LLM that takes JSON as input (parsed data from the web cralwer) and returns a number [0,1] that represents the likelihood of the string being a lead for dOrg's tech/dev consultancy.
2. A smarter LLM that takes JSON as input (parsed data from the web crawler) and follows these steps:
  - Determine if the post is a likely lead for dOrg's tech/dev consultancy
    - if not, then end the workflow and return { "is_lead": false }
  - Extract any relevant data from the post:
    - why the poster is a fit for dOrg's tech/dev consultancy
    - what the poster needs
    - timing (if the user states a timeframe)
    - any available contact information
  - Return the extracted data { "is_lead": true, "why_fit": string, "needs": string, "timing": string, "contact_info": string }

Tech stack:
- typescript
- mastra

## GTM Workers

The gtm-workers service will be responsible for:
1. reading from the queue of posts
  - get the next post payload from the redis queue
  - retrieve the post from the sql database
2. sending posts to the small AI workflow
3. update the post's row in the SQL database to save its probability of being a lead and update its status
   - If the probability of it being a lead is below 0.7, end processing and return
4. send the post to the smarter AI workflow
5. after the smarter AI workflow, update the post's row in the SQL database to save new data and update its status
5. Claim the lead in dOrg by calling "claim_lead" on the dOrg API
    - If claim_lead fails: update post status in sql db, end processing, and return
6. notify the system that there is a new lead by calling "surface_lead" on the dOrg API

If an unexpected error occurs, add the post to the dead letter queue, update the db status to "error", and add the error message to the db.

Tech stack:
- typescript
- bun redis client
- bun sql client
- mastra client