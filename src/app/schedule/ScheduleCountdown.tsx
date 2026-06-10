"use client";

import { useEffect, useState } from "react";
import styles from "./schedule.module.css";

const pacificTimeZone = "America/Los_Angeles";
const thursday = 4;
const episodeHour = 13;

type ZonedParts = {
  day: number;
  hour: number;
  minute: number;
  month: number;
  second: number;
  weekday: number;
  year: number;
};

type RemainingTime = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function getZonedParts(date: Date): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: pacificTimeZone,
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);

  return {
    day,
    hour: Number(values.hour),
    minute: Number(values.minute),
    month,
    second: Number(values.second),
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
    year,
  };
}

function getTimeZoneOffsetMs(date: Date) {
  const parts = getZonedParts(date);
  const zonedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return zonedAsUtc - date.getTime();
}

function getLocalDateAfter(parts: ZonedParts, daysToAdd: number) {
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + daysToAdd));

  return {
    day: next.getUTCDate(),
    month: next.getUTCMonth() + 1,
    year: next.getUTCFullYear(),
  };
}

function getPacificInstant(year: number, month: number, day: number, hour: number) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, 0, 0);
  const firstOffset = getTimeZoneOffsetMs(new Date(utcGuess));
  const firstInstant = utcGuess - firstOffset;
  const secondOffset = getTimeZoneOffsetMs(new Date(firstInstant));

  return new Date(utcGuess - secondOffset);
}

function getNextEpisodeDate(now: Date) {
  const parts = getZonedParts(now);
  let daysUntil = (thursday - parts.weekday + 7) % 7;
  const hasReachedThisWeeksStart =
    daysUntil === 0 &&
    (parts.hour > episodeHour ||
      (parts.hour === episodeHour && (parts.minute > 0 || parts.second >= 0)));

  if (hasReachedThisWeeksStart) {
    daysUntil = 7;
  }

  const targetDate = getLocalDateAfter(parts, daysUntil);

  return getPacificInstant(targetDate.year, targetDate.month, targetDate.day, episodeHour);
}

function getRemainingTime(now: Date): RemainingTime {
  const remainingMs = Math.max(0, getNextEpisodeDate(now).getTime() - now.getTime());
  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds };
}

function formatRemainingTime(remaining: RemainingTime) {
  const hours = String(remaining.hours).padStart(2, "0");
  const minutes = String(remaining.minutes).padStart(2, "0");
  const seconds = String(remaining.seconds).padStart(2, "0");

  return remaining.days > 0
    ? `${remaining.days}d ${hours}h ${minutes}m`
    : `${hours}h ${minutes}m ${seconds}s`;
}

export function ScheduleCountdown() {
  const [remaining, setRemaining] = useState<RemainingTime | null>(null);

  useEffect(() => {
    function updateRemainingTime() {
      setRemaining(getRemainingTime(new Date()));
    }

    updateRemainingTime();
    const intervalId = window.setInterval(updateRemainingTime, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <span className={styles.scheduleCountdown} suppressHydrationWarning>
      <span>Next episode</span>
      <strong>{remaining ? formatRemainingTime(remaining) : "--"}</strong>
    </span>
  );
}
