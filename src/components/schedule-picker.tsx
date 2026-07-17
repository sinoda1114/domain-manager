"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
function pad(value: number) { return String(value).padStart(2, "0"); }
function wallValueFromDate(date: Date) { return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`; }
function toWallValue(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}
function parseWall(value: string | null) {
  if (!value) return new Date();
  const [datePart, timePart = "00:00"] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, hours || 0, minutes || 0));
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}
function sameDay(left: Date, right: Date) { return left.getUTCFullYear() === right.getUTCFullYear() && left.getUTCMonth() === right.getUTCMonth() && left.getUTCDate() === right.getUTCDate(); }
function displayValue(value: string | null) {
  if (!value) return "自動削除なし";
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(parseWall(localDateTimeValue(value)));
}

export function localDateTimeValue(value: string | null) {
  if (!value) return "";
  // 登録フォームではJSTの壁時刻、管理画面ではUTC ISOを受け取る。
  // タイムゾーン表記がない値をDateに渡すと閲覧端末のTZで解釈されるため、変換しない。
  return /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? toWallValue(new Date(value)) : value.slice(0, 16);
}

export function SchedulePicker({ value, onChange, disabled = false, compact = false, id }: { value: string | null; onChange: (value: string | null) => void; disabled?: boolean; compact?: boolean; id?: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => value ? parseWall(localDateTimeValue(value)) : parseWall(toWallValue(new Date(Date.now() + 60 * 60 * 1000))));
  const [month, setMonth] = useState(() => { const date = value ? parseWall(localDateTimeValue(value)) : parseWall(toWallValue(new Date())); return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)); });
  const rootRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const triggerId = id ?? inputId;
  const [now, setNow] = useState(() => parseWall(toWallValue(new Date())));
  const selectedValue = value ? localDateTimeValue(value) : "";

  useEffect(() => {
    if (!open) return;
    const refreshNow = () => setNow(parseWall(toWallValue(new Date())));
    refreshNow();
    const timer = window.setInterval(refreshNow, 30_000);
    const close = (event: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => { window.clearInterval(timer); document.removeEventListener("mousedown", close); };
  }, [open]);

  const calendarDays = useMemo(() => {
    const first = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
    const start = new Date(first); start.setUTCDate(1 - first.getUTCDay());
    return Array.from({ length: 42 }, (_, index) => { const date = new Date(start); date.setUTCDate(start.getUTCDate() + index); return date; });
  }, [month]);
  const selectDate = (date: Date) => { const next = new Date(draft); next.setUTCFullYear(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()); setDraft(next); };
  const apply = () => {
    const currentNow = parseWall(toWallValue(new Date()));
    if (draft.getTime() <= currentNow.getTime()) { setNow(currentNow); return; }
    onChange(wallValueFromDate(draft));
    setOpen(false);
  };
  const clear = () => { onChange(null); setOpen(false); };

  return <div className={`schedule-picker${compact ? " schedule-picker-compact" : ""}`} ref={rootRef}>
    <button id={triggerId} type="button" className={`schedule-trigger${value ? " has-value" : ""}`} onClick={() => { if (!disabled) { setNow(parseWall(toWallValue(new Date()))); setDraft(value ? parseWall(localDateTimeValue(value)) : parseWall(toWallValue(new Date(Date.now() + 60 * 60 * 1000)))); setOpen((current) => !current); } }} disabled={disabled} aria-haspopup="dialog" aria-expanded={open}>
      <span className="calendar-glyph" aria-hidden="true">▣</span><span>{displayValue(value)}</span><span className="schedule-chevron" aria-hidden="true">⌄</span>
    </button>
    {open && <div className="schedule-popover" role="dialog" aria-label="自動削除日時を指定">
      <div className="schedule-popover-head"><button type="button" onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1)))} aria-label="前の月">‹</button><strong>{new Intl.DateTimeFormat("ja-JP", { timeZone: "UTC", year: "numeric", month: "long" }).format(month)}</strong><button type="button" onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)))} aria-label="次の月">›</button></div>
      <div className="schedule-weekdays">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
      <div className="schedule-calendar">{calendarDays.map((date) => { const outside = date.getUTCMonth() !== month.getUTCMonth(); const past = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59)).getTime() < now.getTime(); return <button type="button" key={date.toISOString()} className={`${outside ? "outside " : ""}${sameDay(date, draft) ? "selected " : ""}${sameDay(date, now) ? "today" : ""}`} onClick={() => !past && selectDate(date)} disabled={past}>{date.getUTCDate()}</button>; })}</div>
      <div className="schedule-time"><label htmlFor={inputId}>時刻</label><select id={inputId} value={`${pad(draft.getUTCHours())}:${pad(Math.floor(draft.getUTCMinutes() / 15) * 15)}`} onChange={(event) => { const [hours, minutes] = event.target.value.split(":").map(Number); const next = new Date(draft); next.setUTCHours(hours, minutes, 0, 0); setDraft(next); }}>{Array.from({ length: 96 }, (_, index) => { const hours = Math.floor(index / 4); const minutes = (index % 4) * 15; const label = `${pad(hours)}:${pad(minutes)}`; return <option key={label} value={label}>{label}</option>; })}</select><span>日本時間</span></div>
      <div className="schedule-popover-actions"><button type="button" className="schedule-clear" onClick={clear} disabled={!value}>解除</button><button type="button" className="schedule-apply" onClick={apply} disabled={draft.getTime() <= now.getTime()}>この日時に設定</button></div>
      {selectedValue && <small className="schedule-selected-note">現在の設定：{displayValue(value)}</small>}
    </div>}
  </div>;
}
