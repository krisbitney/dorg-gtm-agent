export interface Platform {
  name: string;
  url: string;
}

export const SupportedPlatforms: Record<string, Platform> = {
  reddit: {
    name: "reddit",
    url: "https://reddit.com",
  },
  x: {
    name: "x",
    url: "https://x.com"
  }
}
