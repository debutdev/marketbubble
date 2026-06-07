#!/usr/bin/env python3
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


def parse_date(value):
    if not value:
        return ""

    if "T" in value:
        return value

    try:
        return (
            datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
            .replace(tzinfo=timezone.utc)
            .isoformat()
            .replace("+00:00", "Z")
        )
    except ValueError:
        return value


def title_from_text(value):
    clean = (value or "").strip()
    first_line = next((line.strip() for line in clean.splitlines() if line.strip()), "")

    return first_line[:180]


def load_existing(path, key):
    if not path.exists():
        return {}

    try:
        payload = json.loads(path.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError:
        return {}

    return {
        str(tweet.get("id")): tweet
        for tweet in payload.get(key, [])
        if tweet.get("id")
    }


def read_gallery_items(path):
    raw_payload = path.read_text(encoding="utf-8-sig").strip()

    if not raw_payload:
        return []

    payload = json.loads(raw_payload)

    if isinstance(payload, list):
        return payload

    return []


def normalize_gallery_tweets(items, existing, handle):
    tweets = dict(existing)
    profile_title = f"@{handle}"
    profile_image_url = None

    for item in items:
        if not isinstance(item, list) or not item:
            continue

        event_type = item[0]

        if event_type == 2 and len(item) >= 2 and isinstance(item[1], dict):
            meta = item[1]
            tweet_id = str(meta.get("tweet_id") or meta.get("conversation_id") or "")

            if not tweet_id:
                continue

            user = meta.get("user") or meta.get("author") or {}
            user_name = user.get("name") or handle
            user_nick = user.get("nick") or f"@{user_name}"
            profile_title = f"{user_nick} / @{user_name}"
            profile_image_url = user.get("profile_image") or profile_image_url
            text = meta.get("content") or ""
            existing_tweet = tweets.get(tweet_id, {})

            tweets[tweet_id] = {
                **existing_tweet,
                "author": f"@{user_name}",
                "id": tweet_id,
                "isRetweet": bool(meta.get("retweet_id")),
                "media": existing_tweet.get("media", []),
                "metrics": {
                    "bookmarks": meta.get("bookmark_count"),
                    "likes": meta.get("favorite_count"),
                    "quotes": meta.get("quote_count"),
                    "replies": meta.get("reply_count"),
                    "reposts": meta.get("retweet_count"),
                    "views": meta.get("view_count"),
                },
                "publishedAt": parse_date(meta.get("date")),
                "text": text,
                "title": title_from_text(text),
                "url": f"https://x.com/{user_name}/status/{tweet_id}",
            }

        if event_type == 3 and len(item) >= 3 and isinstance(item[2], dict):
            media_url = item[1] if isinstance(item[1], str) else ""
            meta = item[2]
            tweet_id = str(meta.get("tweet_id") or "")

            if not tweet_id or not media_url:
                continue

            tweet = tweets.setdefault(
                tweet_id,
                {
                    "author": f"@{handle}",
                    "id": tweet_id,
                    "isRetweet": False,
                    "media": [],
                    "publishedAt": parse_date(meta.get("date")),
                    "text": meta.get("content") or "",
                    "title": title_from_text(meta.get("content") or ""),
                    "url": f"https://x.com/{handle}/status/{tweet_id}",
                },
            )

            if meta.get("type") == "photo":
                tweet.setdefault("media", [])

                if media_url not in tweet["media"]:
                    tweet["media"].append(media_url)

            if meta.get("type") == "video":
                tweet["videoUrl"] = media_url
                tweet["duration"] = meta.get("duration")

    sorted_tweets = sorted(
        tweets.values(),
        key=lambda tweet: tweet.get("publishedAt") or "",
        reverse=True,
    )

    return sorted_tweets, profile_title, profile_image_url


def normalize_gallery_payload(items, existing, handle, tagged_clip_items, existing_tagged_clips):
    tweets, profile_title, profile_image_url = normalize_gallery_tweets(items, existing, handle)
    tagged_clips, _, _ = normalize_gallery_tweets(
        tagged_clip_items,
        existing_tagged_clips,
        handle,
    )
    account_ids = {str(tweet.get("id")) for tweet in tweets if tweet.get("id")}
    account_author = f"@{handle}".lower()
    tagged_clips = [
        {
            **tweet,
            "clipSource": "tagged-mention-video",
        }
        for tweet in tagged_clips
        if tweet.get("videoUrl")
        and str(tweet.get("id")) not in account_ids
        and str(tweet.get("author", "")).lower() != account_author
    ]

    return {
        "fetchedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "handle": handle,
        "profileImageUrl": profile_image_url,
        "profileTitle": profile_title,
        "source": "gallery-dl",
        "taggedClips": tagged_clips,
        "tweets": tweets,
    }


def main():
    parser = argparse.ArgumentParser(description="Build a static X/Twitter archive from gallery-dl JSON.")
    parser.add_argument("--handle", default="MarketBubble")
    parser.add_argument("--clip-input", type=Path, action="append", default=[])
    parser.add_argument("--input", required=True, type=Path, action="append")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    existing = load_existing(args.output, "tweets")
    existing_tagged_clips = load_existing(args.output, "taggedClips")
    items = []
    tagged_clip_items = []

    for input_path in args.input:
        items.extend(read_gallery_items(input_path))

    for input_path in args.clip_input:
        tagged_clip_items.extend(read_gallery_items(input_path))

    archive = normalize_gallery_payload(
        items,
        existing,
        args.handle,
        tagged_clip_items,
        existing_tagged_clips,
    )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(archive, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {len(archive['tweets'])} tweets and "
        f"{len(archive['taggedClips'])} tagged clips to {args.output}"
    )


if __name__ == "__main__":
    main()
