export interface Platform {
  name: string;
  url: string;
}

export const SupportedPlatforms: Array<Platform> = [
  {
    name: "reddit",
    url: "https://reddit.com",
  },
  {
    name: "x",
    url: "https://x.com"
  }
];
