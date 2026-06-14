import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { CourtMap, type Court } from "@/components/CourtMap";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const NTRP_OPTIONS = ["Any", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0"];

function generateSlots(): string[] {
  const slots: string[] = [];
  for (let h = 7; h <= 20; h++) {
    for (const m of [0, 30]) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
}

function fmtSlot(s: string) {
  const [h, m] = s.split(":").map(Number);
  const d = new Date(); d.setHours(h, m, 0, 0);
  return format(d, "h:mma").toLowerCase();
}

export function CreateSessionSheet({
  open,
  onOpenChange,
  defaultDate,
  trigger,
}: {
  open?: boolean;
  onOpenChange?: (b: boolean) => void;
  defaultDate?: Date;
  trigger?: React.ReactNode;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [date, setDate] = useState<Date | undefined>(defaultDate ?? new Date());
  const [slots, setSlots] = useState<string[]>([]);
  const [courtId, setCourtId] = useState<string | null>(null);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [ntrp, setNtrp] = useState("Any");
  const [courtSearch, setCourtSearch] = useState("");

  useEffect(() => { if (defaultDate) setDate(defaultDate); }, [defaultDate]);

  const allSlots = useMemo(generateSlots, []);

  const { data: courts = [] } = useQuery({
    queryKey: ["courts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courts")
        .select("id, name, latitude, longitude, address")
        .order("name");
      if (error) throw error;
      return data as Court[];
    },
  });

  const selectedCourt = courts.find((c) => c.id === courtId) ?? null;

  const filteredCourts = useMemo(() => {
    const q = courtSearch.trim().toLowerCase();
    const sorted = [...courts].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return sorted;
    return sorted.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.address ?? "").toLowerCase().includes(q),
    );
  }, [courts, courtSearch]);

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in required");
      if (!date) throw new Error("Pick a date");
      if (slots.length === 0) throw new Error("Pick at least one time slot");
      if (!courtId) throw new Error("Pick a court");

      const sorted = [...slots].sort();
      const start = sorted[0];
      const lastSlot = sorted[sorted.length - 1];
      const [lh, lm] = lastSlot.split(":").map(Number);
      const endDate = new Date(2000, 0, 1, lh, lm + 30);
      const end = `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`;

      const ntrpVal = ntrp === "Any" ? null : Number(ntrp);

      const { data: session, error } = await supabase
        .from("sessions")
        .insert({
          creator_id: user.id,
          court_id: courtId,
          session_date: format(date, "yyyy-MM-dd"),
          start_time: start,
          end_time: end,
          max_players: maxPlayers,
          ntrp_min: ntrpVal,
          ntrp_max: ntrpVal,
        })
        .select()
        .single();
      if (error) throw error;

      // Auto-join creator
      await supabase
        .from("session_participants")
        .insert({ session_id: session.id, user_id: user.id });
    },
    onSuccess: () => {
      toast.success("Session published!");
      qc.invalidateQueries({ queryKey: ["sessions"] });
      onOpenChange?.(false);
      setSlots([]);
      setCourtId(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create"),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent side="right" className="w-full sm:max-w-md bg-card border-border overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-2xl font-bold tracking-tight">Host a Game</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-8">
          {/* Step 1: Date */}
          <div className="space-y-2">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">1. Pick a date</Label>
            <div className="rounded-2xl bg-background/60 p-2 border border-border">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                className="pointer-events-auto"
              />
            </div>
          </div>

          {/* Step 2: Time slots */}
          <div className="space-y-2">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              2. Time slots <span className="text-muted-foreground/60 normal-case">(30-min)</span>
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {allSlots.map((s) => {
                const active = slots.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      setSlots((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))
                    }
                    className={cn(
                      "p-2 rounded-lg text-center text-xs font-medium border transition-colors",
                      active
                        ? "bg-brand/15 border-brand/40 text-brand font-bold"
                        : "bg-background/60 border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {fmtSlot(s)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 3: Court */}
          <div className="space-y-2">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">3. Pick a court</Label>
            <CourtMap courts={filteredCourts} selectedId={courtId} onSelect={(c) => setCourtId(c.id)} height={220} />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={courtSearch}
                onChange={(e) => setCourtSearch(e.target.value)}
                placeholder="Search courts by name"
                className="pl-9 bg-background/60 border-border"
              />
            </div>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-border bg-background/60 divide-y divide-border">
              {filteredCourts.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">No courts match "{courtSearch}"</p>
              ) : (
                filteredCourts.map((c) => {
                  const active = c.id === courtId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCourtId(c.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm transition-colors",
                        active ? "bg-brand/15 text-brand font-semibold" : "hover:bg-background/80",
                      )}
                    >
                      <div className="font-medium">{c.name}</div>
                      {c.address && (
                        <div className="text-[11px] text-muted-foreground">{c.address}</div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
            {selectedCourt && (
              <div className="p-3 bg-background/60 rounded-xl border border-border text-sm">
                <div className="font-semibold">{selectedCourt.name}</div>
                {selectedCourt.address && <div className="text-[11px] text-muted-foreground">{selectedCourt.address}</div>}
              </div>
            )}
          </div>

          {/* Players + NTRP */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Max players</Label>
              <Select value={String(maxPlayers)} onValueChange={(v) => setMaxPlayers(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 6, 8].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">NTRP level</Label>
              <Select value={ntrp} onValueChange={setNtrp}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NTRP_OPTIONS.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="w-full h-14 bg-brand text-black hover:bg-brand-dark rounded-2xl font-extrabold uppercase tracking-tighter italic text-base shadow-xl shadow-brand/20"
          >
            {create.isPending ? "Publishing..." : "Publish Session"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
