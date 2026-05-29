import { cn } from "@/lib/utils";

interface RelativeTimeProps {
  className?: string;
  date: string;
}

const UNKNOWN_LABEL = "at an unknown time";

const SECOND = 1;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

const UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", YEAR],
  ["month", MONTH],
  ["week", WEEK],
  ["day", DAY],
  ["hour", HOUR],
  ["minute", MINUTE],
];

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

const absoluteFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const formatRelative = (timestamp: number, now: number): string => {
  const diffSeconds = (timestamp - now) / 1000;
  const absSeconds = Math.abs(diffSeconds);

  if (absSeconds < MINUTE) {
    return "just now";
  }

  for (const [unit, unitSeconds] of UNITS) {
    if (absSeconds >= unitSeconds) {
      const magnitude = Math.round(absSeconds / unitSeconds);
      const value = diffSeconds < 0 ? -magnitude : magnitude;

      return relativeFormatter.format(value, unit);
    }
  }

  return "just now";
};

export const RelativeTime = ({ className, date }: RelativeTimeProps): React.JSX.Element => {
  const timestamp = Date.parse(date);

  if (Number.isNaN(timestamp)) {
    return (
      <time className={cn(className)} dateTime={date}>
        {UNKNOWN_LABEL}
      </time>
    );
  }

  const absolute = absoluteFormatter.format(new Date(timestamp));
  const relative = formatRelative(timestamp, Date.now());

  return (
    <time className={cn(className)} dateTime={date} title={absolute}>
      {relative}
    </time>
  );
};
