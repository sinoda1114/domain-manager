import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SchedulePicker } from "@/components/schedule-picker";

function wallParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

function jstWallDate({
  year,
  month,
  day,
  hour,
  minute,
}: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}) {
  // Asia/Tokyo is UTC+9 with no DST; wall time maps directly to UTC-9h.
  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute, 0, 0));
}

function openPicker() {
  fireEvent.click(screen.getByRole("button", { name: /自動削除なし/ }));
  return screen.getByRole("dialog", { name: "自動削除日時を指定" });
}

describe("SchedulePicker apply clock sync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("disables この日時に設定 after the cached now refresh catches a passed draft", () => {
    const onChange = vi.fn();
    const openAt = jstWallDate({
      year: 2026,
      month: 7,
      day: 19,
      hour: 12,
      minute: 0,
    });
    vi.setSystemTime(openAt);

    render(<SchedulePicker value={null} onChange={onChange} />);
    const dialog = openPicker();
    const apply = within(dialog).getByRole("button", { name: "この日時に設定" });
    expect(apply).toBeEnabled();

    vi.setSystemTime(
      jstWallDate({
        year: 2026,
        month: 7,
        day: 19,
        hour: 13,
        minute: 0,
      }),
    );
    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(apply).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows feedback instead of a silent no-op when apply loses the race to a fresh clock", () => {
    const onChange = vi.fn();
    const openAt = jstWallDate({
      year: 2026,
      month: 7,
      day: 19,
      hour: 12,
      minute: 0,
    });
    vi.setSystemTime(openAt);

    render(<SchedulePicker value={null} onChange={onChange} />);
    const dialog = openPicker();
    const apply = within(dialog).getByRole("button", { name: "この日時に設定" });
    expect(apply).toBeEnabled();

    // Jump the real clock past the draft without firing the refresh interval,
    // so the button can still look enabled with a stale cached now.
    vi.setSystemTime(
      jstWallDate({
        year: 2026,
        month: 7,
        day: 19,
        hour: 13,
        minute: 0,
      }),
    );

    expect(apply).toBeEnabled();
    fireEvent.click(apply);

    expect(onChange).not.toHaveBeenCalled();
    expect(apply).toBeDisabled();
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "過去の日時は指定できません",
    );
  });

  it("applies a future draft and closes the popover", () => {
    const onChange = vi.fn();
    const openAt = jstWallDate({
      year: 2026,
      month: 7,
      day: 19,
      hour: 12,
      minute: 0,
    });
    vi.setSystemTime(openAt);

    render(<SchedulePicker value={null} onChange={onChange} />);
    const dialog = openPicker();
    fireEvent.click(within(dialog).getByRole("button", { name: "この日時に設定" }));

    const parts = wallParts(new Date(openAt.getTime() + 60 * 60 * 1000));
    expect(onChange).toHaveBeenCalledWith(
      `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`,
    );
    expect(
      screen.queryByRole("dialog", { name: "自動削除日時を指定" }),
    ).not.toBeInTheDocument();
  });
});
