import {getPostDateLimit} from "./util.ts";

/**
 * Apify Actor ID for the Reddit crawler.
 */
export const redditActorId = "trudax/reddit-scraper-lite";

export function getRedditActorInputs(): Record<string, any> {
  const postDateLimit = getPostDateLimit(1);
  return {
    "maxItems": 2500,
    "maxPostCount": 50,
    "scrollTimeout": 1800, // 30 minutes
    "sort": "new",
    "postDateLimit": postDateLimit,
    "searchComments": false,
    "searchCommunities": false,
    "searchPosts": true,
    "searchUsers": false,
    "skipComments": true,
    "skipCommunity": true,
    "skipUserPosts": false,
    "maxUserCount": 0,
    "maxComments": 0,
    "maxCommunitiesCount": 0,
    "debugMode": false,
    "ignoreStartUrls": false,
    "includeNSFW": false,
    "searches": [
      "looking for web3 developer",
      "hiring web3 developer",
      "need web3 developer",
      "web3 developer wanted",
      "hire solidity developer",
      "solidity smart contract developer needed",
      "looking for blockchain developer",
      "hiring blockchain developer",
      "need smart contract developer",
      "web3 dapp developer hire",
      "ethereum developer needed",
      "solana developer hiring",
      "rust solana developer wanted",
      "looking for web3 consultancy",
      "web3 development agency recommendation",
      "need smart contract audit",
      "blockchain security audit required",
      "defi developer needed",
      "nft marketplace developer hire",
      "dao smart contract developer",
      "full stack web3 developer wanted",
      "react web3 developer needed",
      "ethers.js hardhat developer",
      "foundry developer hiring",
      "polygon developer needed",
      "layer2 scaling developer wanted",
      "zk rollup developer",
      "cross chain bridge developer hire",
      "web3 gaming developer needed",
      "metaverse dapp development",
      "decentralized app help wanted",
      "web3 wallet integration developer",
      "chainlink oracle integration needed",
      "nft minting dapp developer",
      "erc721 smart contract help",
      "looking to hire web3 team OR agency",
      "blockchain development company needed",
      "web3 consulting services",
      "rfp web3 OR blockchain development",
      "who can build dapp OR smart contract",
      "smart contract optimization needed",
      "gas optimization solidity developer",
      "web3 project needs dev team",
      "startup looking for web3 developer",
      "crypto project developer hire",
      "decentralized finance development help",
      "migrate to web3 developer needed",
      "web2 to web3 migration help",
      "recommend web3 development company",
      "best web3 consultancy OR agency"
    ],
    "proxy": {
      "useApifyProxy": true,
      "apifyProxyGroups": [
        "RESIDENTIAL"
      ]
    },
  };
}