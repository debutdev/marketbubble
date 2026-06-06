"use client";

import { useState } from "react";
import { AggregatedChat } from "@/components/AggregatedChat";
import { channelOptions, getChannelOption } from "@/lib/channel-options";

type ChatPopoutExperienceProps = {
  initialChannelValue: string;
};

export function ChatPopoutExperience({
  initialChannelValue,
}: ChatPopoutExperienceProps) {
  const [selectedChannelValue, setSelectedChannelValue] =
    useState(initialChannelValue);
  const selectedChannel = getChannelOption(selectedChannelValue);

  return (
    <AggregatedChat
      channelOptions={channelOptions}
      enablePopout={false}
      mode="popout"
      monitoredSources={selectedChannel}
      onChannelChange={setSelectedChannelValue}
      selectedChannelValue={selectedChannel.value}
      showStats={false}
    />
  );
}
