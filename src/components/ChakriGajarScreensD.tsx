import { useState, useRef, useEffect, useCallback } from "react";
import { Edit3, Minus, Plus, RotateCcw, Users, MoreVertical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CgGroup, CgEvent, CgBooking, SLOT_LABELS, getISTNow, toDateStr } from "./ChakriGajarTypes";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "./PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useJapa } from "@/contexts/JapaContext";
import deityImage from "@/assets/deity.jpg";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


// ─── CG Counter Screen ────────────────────────────────────────────────────────
export const CgCounterScreen = ({ onBack, onCountChange, bookingId, eventId, initialCount }: {
  onBack: () => void | Promise<void>;
  onCountChange?: (count: number) => void;
  bookingId: string;
  eventId: string;
  initialCount: number;
}) => {
  const [count, setCount] = useState(initialCount);
  const [groupTotal, setGroupTotal] = useState(0);
  const [saving, setSaving] = useState(false);
  const [isBacking, setIsBacking] = useState(false);
  const [setCountValue, setSetCountValue] = useState("");
  const [isSetDialogOpen, setIsSetDialogOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pct = (count % 108) / 108 * 100;

  const { todayJaaps, incrementJaaps, setJaaps, getText } = useJapa();

  // ── Group total (real-time via Supabase Realtime — zero polling cost) ────────
  const refreshGroupTotal = useCallback(async () => {
    if (!eventId) return;
    const { data } = await supabase.from("cg_bookings").select("jaaps").eq("event_id", eventId);
    setGroupTotal((data || []).reduce((s, b) => s + (b.jaaps || 0), 0));
  }, [eventId]);

  useEffect(() => {
    // Fetch once on mount
    refreshGroupTotal();

    // Subscribe to real-time changes on cg_bookings for this event
    // This replaces the 30s poll (saves ~120 API calls/hour per user)
    const channel = supabase
      .channel(`cg_bookings_event_${eventId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "cg_bookings", filter: `event_id=eq.${eventId}` },
        () => { refreshGroupTotal(); }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "cg_bookings", filter: `event_id=eq.${eventId}` },
        () => { refreshGroupTotal(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId, refreshGroupTotal]);


  // ── Debounced persist to cg_bookings ────────────────────────────────────
  const persistCountNow = useCallback(async (n: number) => {
    setSaving(true);
    await supabase.from("cg_bookings").update({ jaaps: n }).eq("id", bookingId);
    setSaving(false);
    refreshGroupTotal();
  }, [bookingId, refreshGroupTotal]);

  const persistCount = useCallback((n: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void persistCountNow(n);
    }, 600);
  }, [persistCountNow]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleBack = async () => {
    if (isBacking) return;
    setIsBacking(true);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    try {
      await persistCountNow(count);
    } catch (error) {
      console.error("Failed to persist count before back:", error);
    }
    await Promise.resolve(onBack());
  };

  // ── Counter operations — always sync BOTH cg_bookings AND global todayJaaps ──
  const inc = () => {
    const n = count + 1;
    setCount(n);
    persistCount(n);
    onCountChange?.(n);
    incrementJaaps(); // +1 to global Japa counter
  };

  const dec = () => {
    if (count <= 0) return;
    const n = count - 1;
    setCount(n);
    persistCount(n);
    onCountChange?.(n);
    setJaaps(Math.max(0, todayJaaps - 1)); // -1 from global Japa counter
  };

  const reset = () => {
    const deduction = count; // how many to subtract from global
    setCount(0);
    persistCount(0);
    onCountChange?.(0);
    setJaaps(Math.max(0, todayJaaps - deduction));
  };

  // ── Dropdown menu handlers ───────────────────────────────────────────────
  const handleReduce = () => {
    if (!window.confirm(getText("क्या आप गिनती 1 कम करना चाहते हैं?", "Reduce count by 1?"))) return;
    dec();
  };

  const handleReset = () => {
    if (!window.confirm(getText("क्या आप गिनती रीसेट करना चाहते हैं?", "Reset count?"))) return;
    reset();
  };

  const handleOpenSetDialog = () => {
    setSetCountValue(count.toString()); // prefill with CG count, not global
    setIsSetDialogOpen(true);
  };

  const handleSaveSet = () => {
    const parsed = parseInt(setCountValue, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      window.alert(getText("कृपया मान्य संख्या दर्ज करें", "Please enter a valid number"));
      return;
    }
    if (!window.confirm(getText(`क्या आप गिनती ${parsed} पर सेट करना चाहते हैं?`, `Set count to ${parsed}?`))) return;

    const delta = parsed - count; // positive = added jaaps, negative = removed
    setCount(parsed);
    persistCount(parsed);
    onCountChange?.(parsed);
    setJaaps(Math.max(0, todayJaaps + delta)); // adjust global by delta
    setIsSetDialogOpen(false);
  };

  return (
    <div
      className="relative flex flex-col items-center justify-center min-h-screen p-4 cursor-pointer select-none pb-10"
      onClick={inc}
    >
      {/* Menu button */}
      <div className="absolute top-4 right-4 z-20" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={getText("काउंटर मेनू", "Counter menu")}>
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleReduce(); }}>
              <Minus className="mr-2 h-4 w-4" />
              {getText("गिनती घटाएं", "Reduce Count")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleOpenSetDialog(); }}>
              <Edit3 className="mr-2 h-4 w-4" />
              {getText("गिनती सेट करें", "Set Count")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleReset(); }}>
              <RotateCcw className="mr-2 h-4 w-4" />
              {getText("गिनती रीसेट करें", "Reset Count")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Set Count dialog */}
      {isSetDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={(e) => { e.stopPropagation(); setIsSetDialogOpen(false); }}
        >
          <div
            className="bg-card rounded-xl p-6 w-80 space-y-4 shadow-2xl border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-base font-semibold text-foreground">
              {getText("गिनती सेट करें", "Set Count")}
            </div>
            <input
              type="number"
              min={0}
              value={setCountValue}
              onChange={(e) => setSetCountValue(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-foreground bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setIsSetDialogOpen(false)}>
                {getText("रद्द करें", "Cancel")}
              </Button>
              <Button className="flex-1" onClick={handleSaveSet}>
                {getText("सेट करें", "Set")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Content — no stopPropagation here so taps bubble up to the outer inc() handler */}
      <div className="w-full max-w-md space-y-6">
        {/* Back + saving — stop propagation so Back doesn't also count */}
        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={handleBack} className="px-2" disabled={saving || isBacking}>
            {getText("← वापस", "← Back")}
          </Button>
          {(saving || isBacking) && (
            <span className="text-xs text-muted-foreground animate-pulse">
              {getText("सेव हो रहा है...", "Saving...")}
            </span>
          )}
        </div>
        {/* Header */}
      <PageHeader 
        title={""} 
        subtitle={""} 
      />

        {/* Deity Image — taps here increment */}
        <div className="relative w-full">
          <img
            src={deityImage}
            alt={getText("देवता", "Deity")}
            className="w-full h-auto max-h-[45vh] object-contain rounded-lg shadow-2xl"
          />
          {/* Ripple hint */}
          <div className="absolute inset-0 rounded-lg flex items-center justify-center pointer-events-none">
            <span className="text-white/20 text-6xl font-bold select-none">+</span>
          </div>
        </div>

        {/* Stats — taps here also increment (same as normal counter) */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="spiritual-card">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-primary mb-1">{count}</div>
              <div className="text-sm text-muted-foreground">{getText("आपकी गिनती", "Your Count")}</div>
            </CardContent>
          </Card>
          <Card className="spiritual-card">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-secondary mb-1">{groupTotal.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">{getText("समूह कुल", "Group Total")}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="spiritual-card">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground text-center">
              {getText(
                "गिनती बढ़ाने के लिए कहीं भी टैप करें। यह आपकी सामान्य गिनती के साथ अपने आप सिंक हो जाएगी।",
                "Tap anywhere to count. Changes sync to your normal counter automatically."
              )}
            </p>
          </CardContent>
        </Card>
      </div>

    </div>
  );
};

// ─── CG Date Picker Modal ─────────────────────────────────────────────────────
// Used by admin when creating an event — replaces the old prompt("Enter date")
export const CgDatePickerModal = ({ scheduledDates, onSelect, onClose }: {
  scheduledDates: string[];  // already-scheduled dates shown as dots (blocked)
  onSelect: (date: string) => void;
  onClose: () => void;
}) => {
  const { getText, settings } = useJapa();
  const dateLocale = settings.language === "hi" ? "hi-IN" : "en-IN";
  const istToday = getISTNow();
  const todayStr = toDateStr(istToday);
  const [viewYear, setViewYear] = useState(istToday.getFullYear());
  const [viewMonth, setViewMonth] = useState(istToday.getMonth());
  const [hovered, setHovered] = useState<string | null>(null);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const monthName = new Date(viewYear, viewMonth).toLocaleString(dateLocale, { month: "long", year: "numeric" });
  const fmt = (d: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const prev = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); } else setViewMonth(m => m - 1); };
  const next = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); } else setViewMonth(m => m + 1); };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-card w-full max-w-sm rounded-2xl shadow-2xl border border-border/60 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/40">
          <span className="text-base font-semibold text-foreground">{getText("तारीख चुनें", "Select Date")}</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none">&times;</button>
        </div>

        <div className="p-4 space-y-4">
          {/* Month navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={prev}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
            >
              ‹
            </button>
            <span className="font-semibold text-foreground text-sm">{monthName}</span>
            <button
              onClick={next}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
            >
              ›
            </button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 gap-1">
            {[
              getText("र", "Su"),
              getText("सो", "Mo"),
              getText("मं", "Tu"),
              getText("बु", "We"),
              getText("गु", "Th"),
              getText("शु", "Fr"),
              getText("श", "Sa"),
            ].map(d => (
              <div key={d} className="text-center text-xs text-muted-foreground font-semibold py-1">{d}</div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const d = i + 1;
              const ds = fmt(d);
              const isPast = ds < todayStr;
              const isToday = ds === todayStr;
              const isScheduled = scheduledDates.includes(ds);
              const isHov = hovered === ds;
              const disabled = isPast || isScheduled;

              return (
                <button
                  key={d}
                  disabled={disabled}
                  onClick={() => !disabled && onSelect(ds)}
                  onMouseEnter={() => !disabled && setHovered(ds)}
                  onMouseLeave={() => setHovered(null)}
                  className={`
                    relative flex flex-col items-center py-2 rounded-lg text-sm font-medium transition-all
                    ${disabled
                      ? "opacity-30 cursor-not-allowed text-muted-foreground"
                      : isToday
                        ? "bg-primary/10 text-primary hover:bg-primary/20"
                        : isHov
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted/40 text-foreground"}
                  `}
                >
                  {d}
                  {isScheduled && (
                    <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary/50" />
                  )}
                  {isToday && !isScheduled && (
                    <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 pt-1 border-t border-border/30">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-xs text-muted-foreground">{getText("आज", "Today")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary/40" />
              <span className="text-xs text-muted-foreground">{getText("निर्धारित", "Scheduled")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
              <span className="text-xs text-muted-foreground">{getText("पिछला / अनुपलब्ध", "Past / Unavailable")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── CG Calendar Screen ───────────────────────────────────────────────────────

export const CgCalendarScreen = ({ scheduledDates, completedDates, onDateSelect, onBack }: {
  scheduledDates: string[]; completedDates: string[];
  onDateSelect: (d: string) => void; onBack: () => void;
}) => {
  const { getText, settings } = useJapa();
  const dateLocale = settings.language === "hi" ? "hi-IN" : "en-IN";
  const istToday = getISTNow();
  const [viewYear, setViewYear] = useState(istToday.getFullYear());
  const [viewMonth, setViewMonth] = useState(istToday.getMonth());
  const [selected, setSelected] = useState<string | null>(null);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const monthName = new Date(viewYear, viewMonth).toLocaleString(dateLocale, { month: "long", year: "numeric" });

  const fmt = (d: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  // Use IST for today's date comparison
  const todayStr = toDateStr(getISTNow());

  const prev = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); } else setViewMonth(m => m - 1); };
  const next = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); } else setViewMonth(m => m + 1); };

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto pb-24">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="px-2">
          {getText("← वापस", "← Back")}
        </Button>
      </div>

      <PageHeader
        title={getText("चक्री गजर कैलेंडर", "Chakri Gajar Calendar")}
        subtitle={getText("निर्धारित और पूर्ण सत्र", "Scheduled and completed sessions")}
      />

      <Card className="spiritual-card">
        <CardContent className="p-4 space-y-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={prev}><span className="text-lg">‹</span></Button>
            <span className="font-bold text-foreground">{monthName}</span>
            <Button variant="ghost" size="icon" onClick={next}><span className="text-lg">›</span></Button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 gap-1">
            {[
              getText("र", "Su"),
              getText("सो", "Mo"),
              getText("मं", "Tu"),
              getText("बु", "We"),
              getText("गु", "Th"),
              getText("शु", "Fr"),
              getText("श", "Sa"),
            ].map(d => (
              <div key={d} className="text-center text-xs text-muted-foreground font-semibold py-1">{d}</div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const d = i + 1;
              const ds = fmt(d);
              const isToday = ds === todayStr;
              const isSel = ds === selected;
              const isSched = scheduledDates.includes(ds);
              const isComp = completedDates.includes(ds);

              return (
                <button
                  key={d}
                  onClick={() => { setSelected(ds); onDateSelect(ds); }}
                  className={`
                    relative flex flex-col items-center py-2 rounded-lg text-sm font-medium transition-colors
                    ${isSel ? "bg-primary text-primary-foreground" : isToday ? "bg-primary/10 text-primary" : "hover:bg-muted/40 text-foreground"}
                  `}
                >
                  {d}
                  {(isSched || isComp) && (
                    <span className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${isSel ? "bg-primary-foreground" : isComp ? "bg-green-500" : "bg-primary"}`} />
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="spiritual-card">
        <CardContent className="p-3 flex flex-wrap gap-4">
          {[
            [getText("निर्धारित", "Scheduled"), "bg-primary"],
            [getText("पूर्ण", "Completed"), "bg-green-500"],
            [getText("आज", "Today"), "bg-primary/30"],
          ].map(([label, cls]) => (
            <div key={label} className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${cls}`} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

// ─── Schedule Summary Screen ──────────────────────────────────────────────────
export const ScheduleSummaryScreen = ({ group, event, bookings, onBack, onViewFull }: {
  group: CgGroup | null; event: CgEvent | null; bookings: CgBooking[];
  onBack: () => void; onViewFull: () => void;
}) => {
  const { getText, settings } = useJapa();
  const dateLocale = settings.language === "hi" ? "hi-IN" : "en-IN";
  const date = event?.date ?? "";
  const dateLabel = date
    ? new Date(date).toLocaleDateString(dateLocale, { day: "numeric", month: "long", year: "numeric" })
    : "—";

  // Compute per-slot data from real bookings
  const slotData = SLOT_LABELS.map((label, i) => {
    const startHour = i * 3;
    const slotBookings = bookings.filter(b => b.hour >= startHour && b.hour < startHour + 3);
    const uniqueMembers = new Set(slotBookings.map(b => b.user_id)).size;
    const totalJaapsSlot = slotBookings.reduce((a, b) => a + (b.jaaps || 0), 0);
    return { label, members: uniqueMembers, jaaps: totalJaapsSlot };
  });

  const totalJaaps = slotData.reduce((a, s) => a + s.jaaps, 0);
  const totalMembers = new Set(bookings.map(b => b.user_id)).size;

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto pb-24">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="px-2">
          {getText("← वापस", "← Back")}
        </Button>
      </div>

      <PageHeader title={getText("शेड्यूल सारांश", "Schedule Summary")} subtitle={dateLabel} />

      {/* Group card */}
      <Card className="spiritual-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-foreground text-base">{group?.name ?? "—"}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {getText("कोड:", "Code:")} <span className="font-bold text-primary tracking-widest">{group?.code ?? "—"}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">{getText("कुल बुकिंग", "Total booked")}</div>
              <div className="text-2xl font-bold text-primary">{totalMembers}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Slot rows */}
      <Card className="spiritual-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{getText("स्लॉट सारांश", "Slot Summary")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {slotData.map(sl => (
            <div key={sl.label} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-muted">
              <div>
                <div className="text-sm font-medium text-foreground">{sl.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {getText(`${sl.members} प्रतिभागी`, `${sl.members} participants`)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-primary">{sl.jaaps.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">{getText("जाप", "jaaps")}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Total */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="spiritual-card">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-primary mb-1">{totalJaaps.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">{getText("कुल जाप", "Total Jaaps")}</div>
          </CardContent>
        </Card>
        <Card className="spiritual-card">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-secondary mb-1">{totalMembers}</div>
            <div className="text-sm text-muted-foreground">{getText("कुल सदस्य", "Total Members")}</div>
          </CardContent>
        </Card>
      </div>

      <Button variant="outline" className="w-full" size="lg" onClick={onViewFull}>
        {getText("पूरा शेड्यूल देखें", "View Full Schedule")}
      </Button>
    </div>
  );
};
