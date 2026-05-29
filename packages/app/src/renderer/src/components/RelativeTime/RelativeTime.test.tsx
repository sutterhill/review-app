import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/utils", () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(" ") || undefined,
}));

import { RelativeTime } from "./RelativeTime";

const NOW = new Date("2026-05-28T12:00:00.000Z").getTime();

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

const isoAgo = (ms: number): string => new Date(NOW - ms).toISOString();
const isoAhead = (ms: number): string => new Date(NOW + ms).toISOString();
const render = (date: string): string => renderToStaticMarkup(<RelativeTime date={date} />);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RelativeTime", () => {
  it("renders 'just now' for sub-minute differences", () => {
    expect(render(isoAgo(30 * SECOND))).toContain(">just now</time>");
  });

  it("renders minutes at the minute boundary", () => {
    expect(render(isoAgo(MINUTE))).toContain(">1 minute ago</time>");
    expect(render(isoAgo(23 * MINUTE))).toContain(">23 minutes ago</time>");
  });

  it("renders hours at the hour boundary", () => {
    expect(render(isoAgo(2 * HOUR))).toContain(">2 hours ago</time>");
  });

  it("renders 'yesterday' for one day and plural days beyond", () => {
    expect(render(isoAgo(DAY))).toContain(">yesterday</time>");
    expect(render(isoAgo(3 * DAY))).toContain(">3 days ago</time>");
  });

  it("renders weeks at the week boundary", () => {
    expect(render(isoAgo(2 * WEEK))).toContain(">2 weeks ago</time>");
  });

  it("renders months at the month boundary", () => {
    expect(render(isoAgo(5 * MONTH))).toContain(">5 months ago</time>");
  });

  it("renders years at the year boundary", () => {
    expect(render(isoAgo(2 * YEAR))).toContain(">2 years ago</time>");
  });

  it("renders future timestamps with an 'in' prefix", () => {
    expect(render(isoAhead(2 * HOUR))).toContain(">in 2 hours</time>");
    expect(render(isoAhead(3 * DAY))).toContain(">in 3 days</time>");
  });

  it("falls back to an unknown-time label for invalid input", () => {
    const html = render("not-a-date");

    expect(html).toContain(">at an unknown time</time>");
    expect(html).toContain('dateTime="not-a-date"');
    expect(html).not.toContain("title=");
  });

  it("exposes the raw ISO string as the dateTime attribute", () => {
    const iso = isoAgo(2 * HOUR);

    expect(render(iso)).toContain(`dateTime="${iso}"`);
  });

  it("sets a title attribute with the absolute timestamp", () => {
    const absolute = new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(NOW - 2 * HOUR));

    expect(render(isoAgo(2 * HOUR))).toContain(`title="${absolute}"`);
  });

  it("forwards a caller-supplied className", () => {
    const html = renderToStaticMarkup(<RelativeTime className="text-xs" date={isoAgo(2 * HOUR)} />);

    expect(html).toContain('class="text-xs"');
  });
});
