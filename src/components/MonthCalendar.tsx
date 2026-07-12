import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { wmoToDisplay } from "@/lib/weather";

export interface CalendarWeather {
  code: number;
}

export function MonthCalendar({
  month,
  setMonth,
  sessionCountByDate,
  weatherByDate,
  selected,
  onSelect,
}: {
  month: Date;
  setMonth: (d: Date) => void;
  sessionCountByDate: Record<string, number>;
  weatherByDate: Record<string, CalendarWeather>;
  selected: Date | null;
  onSelect: (d: Date) => void;
}) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start, end });

  return (
    <div className="bg-card rounded-3xl p-5 sm:p-6 border border-border shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-semibold text-base">{format(month, "MMMM yyyy")}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setMonth(subMonths(month, 1))}
            className="size-8 rounded-lg bg-cream grid place-items-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={() => setMonth(addMonths(month, 1))}
            className="size-8 rounded-lg bg-cream grid place-items-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground uppercase mb-2">
        <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const count = sessionCountByDate[key] ?? 0;
          const weather = weatherByDate[key];
          const display = weather ? wmoToDisplay(weather.code) : null;
          const inMonth = isSameMonth(d, month);
          const isSelected = selected && isSameDay(d, selected);
          return (
            <button
              key={key}
              onClick={() => onSelect(d)}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 text-xs relative transition-all p-1
                ${!inMonth ? "text-muted-foreground/40" : "text-foreground"}
                ${isSelected ? "bg-brand text-white shadow-md shadow-brand/20" : "hover:bg-cream"}`}
            >
              <span className="text-sm leading-none font-medium">{format(d, "d")}</span>
              {display && inMonth && (
                <span className="text-[11px] leading-none" title={display.label}>{display.icon}</span>
              )}
              {count > 0 && (
                <span className={`text-[9px] leading-none font-bold ${isSelected ? "text-white" : "text-brand"}`}>
                  🎾 {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
