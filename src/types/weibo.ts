export interface WeiboPost {
  id: number;
  bid: string;
  user_id: string;
  screen_name: string;
  text: string;
  pics: string[];
  video_urls: string[];
  live_photo_urls: string[];
  links: string[];
  topics: string[];
  at_users: string[];
  created_at: string;
  source: string;
  likes: number;
  comments: number;
  reposts: number;
  retweet?: WeiboPost;
}

export type FetchResult =
  | { ok: true; post: WeiboPost; rawJson: unknown }
  | { ok: false; kind: 'captcha'; captchaUrl: string }
  | { ok: false; kind: 'error'; message: string };
