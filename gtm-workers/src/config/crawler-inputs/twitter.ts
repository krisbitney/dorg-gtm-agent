import {getPostDateLimit} from "./util.ts";

export const twitterActorId = "danek/twitter-scraper-ppr";

export function getTwitterActorInputs(): Record<string, any> {
  const postDateLimit = getPostDateLimit(1);
  return {
    "max_posts": 2500,
    "query": `("build" OR develop OR "smart contract" OR dapp OR defi OR nft) ("need help" OR "looking for" OR RFP OR "request for proposal" OR quote OR partner OR consultancy) (web3 OR blockchain) min_faves:2 since:${postDateLimit} lang:en`,
    "search_type": "Top"
  }
}
