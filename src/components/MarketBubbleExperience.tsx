"use client";

import { useMemo, useState } from "react";
import { AggregatedChat } from "@/components/AggregatedChat";
import { StreamStage } from "@/components/StreamStage";
import { channelOptions } from "@/lib/channel-options";

const twitchParents = ["127.0.0.1", "localhost", "marketbubble.vercel.app"];
const fallbackTwitchVideoId = "2788673017";

function getTwitchVideoEmbedSrc(videoId: string) {
  const parentParams = twitchParents.map((parent) => `parent=${parent}`).join("&");

  return `https://player.twitch.tv/?video=${videoId}&${parentParams}&muted=true&autoplay=true`;
}

export function MarketBubbleExperience() {
  const [selectedChannelValue, setSelectedChannelValue] = useState(
    channelOptions[0].value,
  );
  const selectedChannel =
    channelOptions.find((channelOption) => channelOption.value === selectedChannelValue) ??
    channelOptions[0];
  const twitchEmbedSrc = useMemo(
    () => getTwitchVideoEmbedSrc(fallbackTwitchVideoId),
    [],
  );

  return (
    <>
      <StreamStage
        src={twitchEmbedSrc}
        statusSources={selectedChannel}
        title="Banks previous Twitch stream"
      />
      <AggregatedChat
        channelOptions={channelOptions}
        monitoredSources={selectedChannel}
        onChannelChange={setSelectedChannelValue}
        selectedChannelValue={selectedChannel.value}
      />
    </>
  );
}
