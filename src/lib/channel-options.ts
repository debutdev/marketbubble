import type { ChannelOption } from "@/components/AggregatedChat";

export const channelOptions: ChannelOption[] = [
  {
    kickChannels: [{ channel: "ansem", chatroomId: 108796898 }],
    label: "Ansem",
    twitchChannels: [],
    value: "ansem",
    xHandles: ["blknoiz06"],
  },
  {
    kickChannels: [],
    label: "Banks",
    twitchChannels: ["fazebanks"],
    value: "banks",
    xHandles: ["Banks"],
  },
  {
    kickChannels: [{ channel: "ansem", chatroomId: 108796898 }],
    label: "Both",
    twitchChannels: ["fazebanks"],
    value: "both",
    xHandles: ["blknoiz06", "Banks"],
  },
];

export function getChannelOption(channelValue: string | null | undefined) {
  return (
    channelOptions.find((channelOption) => channelOption.value === channelValue) ??
    channelOptions[0]
  );
}
