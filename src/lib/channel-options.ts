import type { ChannelOption } from "@/components/AggregatedChat";

export const channelOptions: ChannelOption[] = [
  {
    kickChannels: [{ channel: "ansem", chatroomId: 108796898 }],
    label: "Ansem",
    twitchChannels: [],
    value: "ansem",
    xHandles: ["blknoiz06", "Ansem"],
  },
  {
    kickChannels: [],
    label: "Banks",
    twitchChannels: ["fazebanks"],
    value: "banks",
    xHandles: ["Banks", "fazebanks"],
  },
  {
    kickChannels: [{ channel: "ansem", chatroomId: 108796898 }],
    label: "Both",
    twitchChannels: ["fazebanks"],
    value: "both",
    xHandles: ["blknoiz06", "Ansem", "Banks", "fazebanks"],
  },
];

export function getChannelOption(channelValue: string | null | undefined) {
  return (
    channelOptions.find((channelOption) => channelOption.value === channelValue) ??
    channelOptions[0]
  );
}
