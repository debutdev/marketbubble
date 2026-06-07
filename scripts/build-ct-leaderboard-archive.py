#!/usr/bin/env python3
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


CT_MEMBERS = [
    {"handle": "cobie", "rank": 1, "tag": "The GOAT"},
    {"handle": "CL207", "rank": 2},
    {"handle": "mert", "rank": 3},
    {"handle": "notthreadguy", "rank": 4},
    {"handle": "chameleon_jeff", "rank": 5},
    {"handle": "Tradermayne", "rank": 6},
    {"handle": "ThinkingUSD", "rank": 7},
    {"handle": "based16z", "rank": 8},
    {"handle": "jessepollak", "rank": 9},
    {"handle": "sershokunin", "rank": 10},
]


def read_gallery_items(path):
    if not path.exists():
        return []

    raw_payload = path.read_text(encoding="utf-8-sig").strip()

    if not raw_payload:
        return []

    try:
        payload = json.loads(raw_payload)
    except json.JSONDecodeError:
        return []

    return payload if isinstance(payload, list) else []


def normalize_avatar_url(value):
    if not value:
        return None

    return str(value).replace("_normal.", "_400x400.")


def get_meta_items(items):
    return [
        item[1]
        for item in items
        if isinstance(item, list)
        and len(item) >= 2
        and item[0] == 2
        and isinstance(item[1], dict)
    ]


def build_member(member, input_dir):
    handle = member["handle"]
    items = get_meta_items(read_gallery_items(input_dir / f"{handle}.json"))
    first = items[0] if items else {}
    user = first.get("user") or first.get("author") or {}
    user_name = user.get("name") or handle
    user_nick = user.get("nick") or user_name
    tweets = []

    for item in items:
        text = (item.get("content") or "").strip()

        if text and text not in tweets:
            tweets.append(text)

        if len(tweets) >= 8:
            break

    return {
        "avatarUrl": normalize_avatar_url(user.get("profile_image")),
        "description": user.get("description") or "",
        "followers": int(user.get("followers_count") or 0),
        "handle": user_name,
        "name": user_nick,
        "profileUrl": f"https://x.com/{user_name}",
        "rank": member["rank"],
        "recentTweets": tweets,
        "tag": member.get("tag"),
        "verified": bool(user.get("verified")),
    }


def main():
    parser = argparse.ArgumentParser(description="Build CT leaderboard archive from gallery-dl JSON.")
    parser.add_argument("--input-dir", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    archive = {
        "fetchedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "members": [build_member(member, args.input_dir) for member in CT_MEMBERS],
        "source": "gallery-dl",
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(archive, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {sum(len(member['recentTweets']) for member in archive['members'])} "
        f"tweets for {len(archive['members'])} CT members to {args.output}"
    )


if __name__ == "__main__":
    main()
