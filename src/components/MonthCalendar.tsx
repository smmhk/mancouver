import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function MonthCalendar({
  month,
  setMonth,
  sessionDates,
  selected,
  onSelect,
}: {
  month: Date;
  setMonth: (d: Date) => void;
  sessionDates: Set<string>;
  selected: Date | null;
  onSelect: (d: Date) => void;
}) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });

  return (
    <div className="bg-card rounded-3xl p-5 sm:p-6 border border-border">
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-semibold text-base">{format(month, "MMMM yyyy")}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setMonth(subMonths(month, 1))}
            className="size-8 rounded-lg bg-background/60 grid place-items-center text-muted-foreground hover:text-foreground"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={() => setMonth(addMonths(month, 1))}
            className="size-8 rounded-lg bg-background/60 grid place-items-center text-muted-foreground hover:text-foreground"
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground uppercase mb-2">
        <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const hasSession = sessionDates.has(key);
          const inMonth = isSameMonth(d, month);
          const isSelected = selected && isSameDay(d, selected);
          return (
            <button
              key={key}
              onClick={() => onSelect(d)}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm relative transition-colors
                ${!inMonth ? "text-muted-foreground/30" : "text-foreground"}
                ${isSelected ? "bg-brand/15 text-brand ring-1 ring-brand/40" : "hover:bg-background/60"}`}
            >
              {format(d, "d")}
              {hasSession && (
                <div className={`absolute bottom-1.5 size-1 rounded-full ${isSelected ? "bg-brand" : "bg-red-500"}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
