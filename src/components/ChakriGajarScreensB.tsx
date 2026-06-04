import { useEffect, useRef, useState } from "react";
import { Clock, Play, Users, CheckSquare, Square, ChevronDown, ChevronUp, CalendarCheck, Share2, MoreVertical, Edit3, Trash2, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "./PageHeader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useJapa } from "@/contexts/JapaContext";
import { supabase } from "@/integrations/supabase/client";
import deityImage from "@/assets/deity.jpg";
import html2canvas from "html2canvas";
import { useToast } from "@/hooks/use-toast";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";
import {
  CgGroup, CgEvent, CgBooking, CgMember, CgScreen, CgEventStats,
  SLOT_LABELS, HOUR_LABELS, HOUR_NEXT_LABELS, memberLabel, isPastSlot, getISTNow, toDateStr,
} from "./ChakriGajarTypes";

const isShareCanceled = (error: unknown) =>
  Boolean(error && typeof error === "object" && "name" in error && (error as { name?: string }).name === "AbortError");

// ─── Group Details ─────────────────────────────────────────────────────────────
export const GroupDetailsScreen = ({ group, events, eventStats = {}, members, isAdmin, todayStr, onBack, onNavigate, onSchedule, onEditGroup, onDeleteGroup, loading }: {
  group: CgGroup; events: CgEvent[]; eventStats?: Record<string, CgEventStats>; members: CgMember[]; isAdmin: boolean; todayStr: string;
  onBack: () => void; onNavigate: (s: CgScreen, d?: any) => void; onSchedule: () => void;
  onEditGroup: (name: string) => Promise<void>; onDeleteGroup: () => Promise<void>; loading?: boolean;
}) => {
  const [tab, setTab] = useState<"schedule" | "members" | "stats">("schedule");
  const { getText, settings } = useJapa();
  const { toast } = useToast();
  const shareRef = useRef<HTMLDivElement>(null);
  const [sharingEventId, setSharingEventId] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const dateLocale = settings.language === "hi" ? "hi-IN" : "en-IN";
  const tabLabels: Record<typeof tab, string> = {
    schedule: getText("शेड्यूल", "Schedule"),
    members: getText("सदस्य", "Members"),
    stats: getText("आंकड़े", "Stats"),
  };
  const sortedEvents = [...events].sort(
  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
);

  useEffect(() => {
    setEditName(group.name);
  }, [group.name]);

  const handleOpenEdit = () => {
    setEditName(group.name);
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    const trimmed = editName.trim();
    if (!trimmed) {
      window.alert(getText("समूह का नाम आवश्यक है।", "Group name is required."));
      return;
    }
    await onEditGroup(trimmed);
    setIsEditOpen(false);
  };

  const handleConfirmDelete = async () => {
    await onDeleteGroup();
    setIsDeleteOpen(false);
  };

  const handleShareGroup = async () => {
    const shareTitle = getText("चक्री गजर समूह", "Chakri Gajar Group");
    const shareText = getText(
      `मेरे चक्री गजर समूह में जुड़ें: ${group.name}. कोड: ${group.code}`,
      `Join my Chakri Gajar group: ${group.name}. Code: ${group.code}`
    );

    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, text: shareText });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        window.alert(getText("शेयर टेक्स्ट कॉपी हो गया।", "Share text copied."));
        return;
      }
      window.prompt(getText("शेयर टेक्स्ट", "Share text"), shareText);
    } catch (error) {
      if (isShareCanceled(error)) return;
      console.error("Share failed", error);
      window.alert(getText("शेयर नहीं हो पाया।", "Unable to share."));
    }
  };

  const handleShareEvent = async (event: CgEvent, stats: CgEventStats) => {
    if (!shareRef.current) return;
    setSharingEventId(event.id);

    const formattedDate = new Date(event.date).toLocaleDateString(dateLocale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const setShareText = (id: string, value: string) => {
      const el = document.getElementById(id);
      if (el) el.innerText = value;
    };

    setShareText("cg-share-group-name", group.name);
    setShareText("cg-share-group-code", `${getText("कोड:", "Code:")} ${group.code}`);
    setShareText("cg-share-date", `${getText("तारीख:", "Date:")} ${formattedDate}`);
    const formatMala = (jaaps: number) =>
      Math.floor(jaaps / 108).toLocaleString(dateLocale);
    const myMala = formatMala(stats.myJaaps);
    const groupMala = formatMala(stats.groupJaaps);

    setShareText("cg-share-my-count", `${myMala} ${getText("माला", "Mala")}`);
    setShareText("cg-share-group-total", `${groupMala} ${getText("माला", "Mala")}`);

    const shareTitle = getText("चक्री गजर", "Chakri Gajar");
    const shareText = getText(
      `चक्री गजर | ${group.name} | ${formattedDate} | मेरी माला: ${myMala} | समूह माला: ${groupMala}`,
      `Chakri Gajar | ${group.name} | ${formattedDate} | My Malas: ${myMala} | Group Malas: ${groupMala}`
    );

    try {
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(shareRef.current, {
        backgroundColor: "#1a1a1a",
        scale: 2,
        useCORS: true,
        allowTaint: true,
      });

      if (Capacitor.isNativePlatform()) {
        try {
          const base64Data = canvas.toDataURL("image/png");
          const fileName = `chakari-gajar-${event.date}-${Date.now()}.png`;

          const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: base64Data.split(",")[1],
            directory: Directory.Cache,
          });

          await Share.share({
            title: shareTitle,
            text: shareText,
            files: [savedFile.uri],
          });

          toast({
            title: getText("साझा किया गया", "Shared successfully"),
            description: getText("शेड्यूल साझा किया गया है", "Schedule shared successfully"),
          });
        } catch (err) {
          if (isShareCanceled(err)) return;
          console.error("Error sharing native:", err);
          toast({
            variant: "destructive",
            title: getText("त्रुटि", "Error"),
            description: getText("साझा करने में विफल", "Failed to share"),
          });
        }
      } else {
        canvas.toBlob(async (blob) => {
          if (!blob) return;

          const file = new File([blob], "cg-share.png", { type: "image/png" });
          const shareData = { files: [file], title: shareTitle, text: shareText };

          if (navigator.canShare && navigator.canShare(shareData)) {
            try {
              await navigator.share(shareData);
              toast({
                title: getText("साझा किया गया", "Shared successfully"),
                description: getText("शेड्यूल साझा किया गया है", "Schedule shared successfully"),
              });
            } catch (err) {
              if (isShareCanceled(err)) return;
              console.error("Error sharing:", err);
            }
          } else {
            const link = document.createElement("a");
            link.download = "cg-share.png";
            link.href = canvas.toDataURL();
            link.click();

            toast({
              title: getText("छवि डाउनलोड की गई", "Image Downloaded"),
              description: getText("आप अब इसे मैन्युअल रूप से साझा कर सकते हैं", "You can now share it manually"),
            });
          }
        });
      }
    } catch (err) {
      console.error("Error generating image:", err);
      toast({
        variant: "destructive",
        title: getText("त्रुटि", "Error"),
        description: getText("छवि बनाने में विफल", "Failed to generate image"),
      });
    } finally {
      setSharingEventId(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto pb-24">
      {/* Hidden Share Template */}
      <div className="fixed left-[-9999px] top-0">
        <div
          ref={shareRef}
          className="w-[92vw] max-w-[420px] bg-gradient-to-b from-zinc-900 to-black p-6 sm:p-8 text-white flex flex-col items-center justify-center space-y-5 rounded-xl font-sans"
        >
          <h1 className="text-[clamp(1.75rem,7vw,3rem)] text-primary font-bold leading-tight text-center">
            {getText("चक्री गजर", "Chakri Gajar")}
          </h1>
          <div className="w-[70%] max-w-[260px] relative">
            <img
              src={deityImage}
              alt="Deity"
              className="w-full h-auto max-h-[38vh] object-contain rounded-lg shadow-2xl border-2 border-primary/20"
              crossOrigin="anonymous"
            />
          </div>
          <div className="text-center space-y-1.5 w-full bg-white/5 p-4 rounded-lg backdrop-blur-sm">
            <h2 id="cg-share-group-name" className="text-[clamp(1rem,4vw,1.4rem)] text-gray-200 font-semibold leading-snug break-words">Group</h2>
            <p id="cg-share-date" className="text-[clamp(0.75rem,3vw,0.95rem)] text-gray-400 leading-snug break-words">Date</p>
          </div>
          <div className="grid grid-cols-2 gap-2 w-full">
            <div className="bg-white/5 p-3 rounded-lg text-center">
              <div className="text-[clamp(0.65rem,2.6vw,0.8rem)] text-gray-400">{getText("मेरी माला", "My Malas")}</div>
              <div id="cg-share-my-count" className="text-[clamp(1.25rem,5vw,2rem)] font-bold text-primary">0</div>
            </div>
            <div className="bg-white/5 p-3 rounded-lg text-center">
              <div className="text-[clamp(0.65rem,2.6vw,0.8rem)] text-gray-400">{getText("समूह माला", "Group Malas")}</div>
              <div id="cg-share-group-total" className="text-[clamp(1.25rem,5vw,2rem)] font-bold text-secondary">0</div>
            </div>
          </div>
          <div className="text-[clamp(0.65rem,2.6vw,0.8rem)] text-gray-500 text-center">
            {getText("गणक ऐप से साझा", "Shared from Ganak App")}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="px-2">
          {getText("← वापस", "← Back")}
        </Button>
      </div>

      <Card className="spiritual-card">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Users className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-foreground">{group.name}</h2>
                <Badge variant={isAdmin ? "default" : "secondary"}>
                  {isAdmin ? getText("एडमिन", "Admin") : getText("सदस्य", "Member")}
                </Badge>
              </div>

              {/* CHANGED: Replaced gap-2 with justify-between and added w-full */}
              <div className="flex items-center justify-between w-full text-sm text-muted-foreground mt-0.5">
                <span>
                  {getText("कोड:", "Code:")} <span className="font-bold text-primary tracking-widest">{group.code}</span>
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={handleShareGroup} className="h-7 px-2">
                    <Share2 className="mr-1 h-4 w-4" />
                    {getText("शेयर", "Share")}
                  </Button>
                  {isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={getText("समूह मेनू", "Group menu")}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleOpenEdit(); }}>
                          <Edit3 className="mr-2 h-4 w-4" />
                          {getText("समूह संपादित करें", "Edit group")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={(e) => { e.preventDefault(); setIsDeleteOpen(true); }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {getText("समूह हटाएं", "Delete group")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="spiritual-card">
        <CardContent className="p-1 flex gap-1">
          {(["schedule", "members", "stats"] as const).map(t => (
            <Button key={t} variant={tab === t ? "default" : "ghost"} className="flex-1 capitalize" onClick={() => setTab(t)}>
              {tabLabels[t]}
            </Button>
          ))}
        </CardContent>
      </Card>

      {tab === "schedule" && (
        <div className="space-y-3">
          {events.length === 0 ? (
            <Card className="spiritual-card">
              <CardContent className="p-6 text-center">
                <CalendarCheck className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {isAdmin
                    ? getText("अभी कोई शेड्यूल नहीं है। नया बनाने के लिए + दबाएं।", "No schedules yet. Tap + to create one.")
                    : getText("आगामी शेड्यूल नहीं है।", "No upcoming schedules.")}
                </p>
              </CardContent>
            </Card>
          ) : (
            sortedEvents.map(ev => {
              const isToday = ev.date === todayStr;  // IST-correct
              const isPast = ev.date < todayStr;
              const stats = eventStats[ev.id];
              const canShare = Boolean(stats?.hasBooking);

              return (
                <div
                  key={ev.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onNavigate("scheduleList", ev)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onNavigate("scheduleList", ev);
                    }
                  }}
                  className={`w-full flex items-center justify-between p-4 rounded-lg border border-border/60 bg-card hover:bg-muted/30 transition-colors text-left ${isPast ? "opacity-50" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <CalendarCheck className="h-5 w-5 text-primary" />
                      </div>
                      {isToday && (
                        <>
                          <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-green-400 animate-ping" />
                          <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-green-500" />
                        </>
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">
                        {new Date(ev.date).toLocaleDateString(dateLocale, { day: "numeric", month: "long", year: "numeric" })}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {getText("8 स्लॉट · 24 घंटे", "8 slots · 24 hours")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isToday
                      ? <Badge className="bg-green-600 text-white">{getText("आज", "Today")}</Badge>
                      : isPast
                        ? <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30">{getText("पिछला", "Past")}</Badge>
                        : <Badge variant="outline">{getText("देखें", "View")}</Badge>}
                    {canShare && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate("scheduleList", ev);
                          }}
                          className="h-8 w-8"
                          aria-label={getText("शेड्यूल संपादित करें", "Edit schedule")}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (stats) handleShareEvent(ev, stats);
                          }}
                          disabled={sharingEventId === ev.id}
                          className="h-8 w-8"
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}


      {tab === "members" && (
        <Card className="spiritual-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-base">
              <Users className="mr-2 h-4 w-4 text-primary" />
              {getText(`सदस्य (${members.length})`, `Members (${members.length})`)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{getText("कोई सदस्य नहीं मिला।", "No members found.")}</p>
            ) : (
              members.map(m => {
                const label = memberLabel(m);
                const roleLabel = m.role === "admin" ? getText("एडमिन", "Admin") : getText("सदस्य", "Member");
                return (
                  <div key={m.user_id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-muted">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary">{label[0].toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground text-sm">{label}</div>
                      <div className="text-xs text-muted-foreground">{roleLabel}</div>
                    </div>
                    {m.role === "admin" }
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      {tab === "stats" && (
        <div className="grid grid-cols-2 gap-4">
          {[
            [getText("कुल माला", "Total Malas"), Math.floor((group.totalJaap ?? 0) / 108).toLocaleString(), "text-primary"],
            [getText("सदस्य", "Members"), members.length.toString(), "text-secondary"],
            [getText("सत्र", "Sessions"), events.length.toString(), "text-accent"],
            [getText("एडमिन", "Admins"), members.filter(m => m.role === "admin").length.toString(), "text-orange-500"],
          ].map(([label, val, cls]) => (
            <Card key={label as string} className="spiritual-card">
              <CardContent className="p-4 text-center">
                <div className={`text-2xl font-bold mb-1 ${cls}`}>{val}</div>
                <div className="text-sm text-muted-foreground">{label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isAdmin && (
        <Button className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg z-40 counter-button" size="icon" onClick={onSchedule}>
          <Plus className="h-6 w-6" />
        </Button>
      )}

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getText("समूह संपादित करें", "Edit Group")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cg-group-name">{getText("समूह का नाम", "Group Name")}</Label>
            <Input
              id="cg-group-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder={getText("समूह का नाम", "Group name")}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setIsEditOpen(false)}>
              {getText("रद्द करें", "Cancel")}
            </Button>
            <Button type="button" onClick={handleSaveEdit} disabled={loading || !editName.trim()}>
              {getText("सहेजें", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{getText("समूह हटाएं?", "Delete group?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {getText(
                "यह समूह, उसके सत्र और बुकिंग स्थायी रूप से हट जाएंगे।",
                "This group, its sessions, and bookings will be permanently removed."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{getText("रद्द करें", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={loading}
            >
              {getText("हटाएं", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ─── Schedule List with inline booking ────────────────────────────────────────
export const ScheduleListScreen = ({ event, bookings, members, userId, currentHour, todayStr, loading, blockedHours = new Set(), onBack, onBook, onStartCounter, onBookingCountChange }: {
  event: CgEvent;
  bookings: CgBooking[];
  members: CgMember[];
  userId: string;
  currentHour: number;
  todayStr: string;
  loading: boolean;
  blockedHours?: Set<number>;
  onBack: () => void;
  onBook: (hours: number[]) => Promise<void>;
  onStartCounter: () => void;
  onBookingCountChange: (bookingId: string, eventId: string, nextCount: number) => void;
}) => {
  const { getText, settings, adjustJaapsForDate } = useJapa();
  const { toast } = useToast();
  const dateLocale = settings.language === "hi" ? "hi-IN" : "en-IN";
  const istNow = getISTNow(); // single snapshot for all past-hour checks this render
  const [expanded, setExpanded] = useState<number | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [editBooking, setEditBooking] = useState<CgBooking | null>(null);
  const [editMalas, setEditMalas] = useState("");
  const [editSaving, setEditSaving] = useState(false);


  const toggle = (i: number) => {
    if (expanded === i) {
      setExpanded(null);
      setSelected([]);
    } else {
      setExpanded(i);
      setSelected([]);
    }
  };

  const toggleHour = (hour: number) =>
    setSelected(prev => prev.includes(hour) ? prev.filter(h => h !== hour) : [...prev, hour]);

  const dateLabel = new Date(event.date).toLocaleDateString(dateLocale, {
    day: "numeric", month: "long", year: "numeric",
  });
  const editHourLabel = editBooking
    ? `${HOUR_LABELS[editBooking.hour]}–${HOUR_NEXT_LABELS[editBooking.hour]}`
    : "";
  const myBookings = bookings
    .filter(b => b.user_id === userId)
    .slice()
    .sort((a, b) => a.hour - b.hour);

  const canEditDate = event.date <= todayStr;

  // Max malas a user can realistically enter (sanity cap)
  const MAX_MALAS = 10_000;

  const openEdit = (booking: CgBooking) => {
    const malas = Math.floor((booking.jaaps || 0) / 108);
    setEditMalas(malas.toString());
    setEditBooking(booking);
  };

  const closeEdit = () => {
    if (editSaving) return;
    setEditBooking(null);
    setEditMalas("");
  };

  const handleSaveEdit = async () => {
    if (!editBooking) return;

    // Fix 3: Re-validate date at save time (guards against midnight rollover race condition)
    const freshTodayStr = toDateStr(getISTNow());
    if (event.date > freshTodayStr) {
      toast({
        variant: "destructive",
        title: getText("त्रुटि", "Error"),
        description: getText(
          "भविष्य की बुकिंग संपादित नहीं की जा सकती।",
          "Future bookings cannot be edited."
        ),
      });
      closeEdit();
      return;
    }

    const parsed = parseInt(editMalas, 10);

    // Fix 1: Upper-bound validation
    if (Number.isNaN(parsed) || parsed < 0) {
      toast({
        variant: "destructive",
        title: getText("अमान्य मान", "Invalid value"),
        description: getText("कृपया मान्य माला दर्ज करें", "Please enter a valid mala count"),
      });
      return;
    }
    if (parsed > MAX_MALAS) {
      toast({
        variant: "destructive",
        title: getText("बहुत अधिक", "Too many"),
        description: getText(
          `माला की संख्या ${MAX_MALAS.toLocaleString()} से अधिक नहीं हो सकती।`,
          `Mala count cannot exceed ${MAX_MALAS.toLocaleString()}.`
        ),
      });
      return;
    }

    // Fix 2: Confirm when resetting to 0 (destructive action)
    if (parsed === 0 && (editBooking.jaaps || 0) > 0) {
      const confirmed = window.confirm(
        getText(
          "क्या आप वाकई माला की गिनती 0 पर रीसेट करना चाहते हैं?",
          "Are you sure you want to reset the mala count to 0?"
        )
      );
      if (!confirmed) return;
    }

    const nextJaaps = parsed * 108;
    const prevJaaps = editBooking.jaaps || 0;
    const delta = nextJaaps - prevJaaps;
    if (delta === 0) {
      setEditBooking(null);
      return;
    }

    setEditSaving(true);
    try {
      const { error } = await supabase
        .from("cg_bookings")
        .update({ jaaps: nextJaaps })
        .eq("id", editBooking.id);
      if (error) throw error;

      onBookingCountChange(editBooking.id, editBooking.event_id, nextJaaps);
      await adjustJaapsForDate(event.date, delta);
      setEditBooking(null);
      setEditMalas("");
      toast({
        title: getText("अपडेट हो गया", "Updated"),
        description: getText("माला की गिनती सहेज ली गई।", "Mala count saved successfully."),
      });
    } catch (error) {
      console.error("Failed to update booking count:", error);
      toast({
        variant: "destructive",
        title: getText("त्रुटि", "Error"),
        description: getText("गिनती अपडेट नहीं हो सकी", "Unable to update count"),
      });
    } finally {
      setEditSaving(false);
    }
  };

  // Derive user's active booking — use todayStr (IST) not UTC new Date().toISOString()
  // At 00:25 IST, UTC is still the previous day; toISOString() would give yesterday's date
  const activeBooking = event.date === todayStr
    ? bookings.find(b => b.user_id === userId && b.hour === currentHour)
    : undefined;
  const activeSlotIdx = activeBooking !== undefined
    ? Math.floor(currentHour / 3)
    : -1;

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto pb-24">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="px-2">
          {getText("← वापस", "← Back")}
        </Button>
      </div>

      <PageHeader title={getText("चक्री गजर शेड्यूल", "Chakri Gajar Schedule")} subtitle={dateLabel} />

      {/* Active slot shown only when user has booking now */}
      {activeBooking && (
        <Card className="spiritual-card border-green-400/30 bg-green-50/40 dark:bg-green-950/20">
          <CardContent className="p-5">

            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />

                  <span className="text-sm font-semibold text-green-600">
                    {getText("सक्रिय स्लॉट", "Active Slot")}
                  </span>
                </div>

                <h2 className="text-2xl font-bold">
                  {HOUR_LABELS[currentHour]}
                  {" - "}
                  {HOUR_NEXT_LABELS[currentHour]}
                </h2>

                <p className="text-sm text-muted-foreground mt-1">
                  {getText("आपकी बुकिंग अभी चालू है", "Your booking is currently live")}
                </p>
              </div>

              <Badge className="bg-green-600">
                {getText("चल रहा है", "Running")}
              </Badge>
            </div>


            {/* participants */}
            <div className="flex flex-wrap gap-2 mb-4">

              {members
                .filter(m =>
                  bookings.some(
                    b =>
                      b.hour === currentHour &&
                      b.user_id === m.user_id
                  )
                )
                .map(m => {

                  const label = memberLabel(m);

                  return (
                    <div
                      key={m.user_id}
                      className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted"
                    >
                      <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">

                        <span className="text-xs font-bold">
                          {label[0]}
                        </span>

                      </div>

                      <span className="text-sm">
                        {label}
                      </span>
                    </div>
                  );
                })}
            </div>


            <Button
              size="lg"
              className="w-full counter-button"
              onClick={onStartCounter}
            >
              <Play className="mr-2 h-5 w-5" />
              {getText("काउंटर शुरू करें", "Start Counter")}
            </Button>

          </CardContent>
        </Card>
      )}

      {myBookings.length > 0 && (
        <Card className="spiritual-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-base">
              <CheckSquare className="mr-2 h-4 w-4 text-primary" />
              {getText("मेरी बुकिंग", "My Bookings")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {myBookings.map(b => {
              const malas = Math.floor((b.jaaps || 0) / 108);
              return (
                <div key={b.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/60 bg-muted/20">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">
                      {HOUR_LABELS[b.hour]}–{HOUR_NEXT_LABELS[b.hour]}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {getText(`${malas} माला`, `${malas} malas`)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{getText("बुक किया", "Booked")}</Badge>
                    {canEditDate && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(b)}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {!canEditDate && (
              <p className="text-xs text-muted-foreground text-center">
                {getText("भविष्य की बुकिंग संपादित नहीं की जा सकती।", "Future bookings cannot be edited.")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* slot list */}
      <div className="space-y-3">
        {SLOT_LABELS.map((label, i) => {
          const startHour = i * 3;
          const slotBookings = bookings.filter(b => b.hour >= startHour && b.hour < startHour + 3);
          const uniqueUsers = new Set(slotBookings.map(b => b.user_id)).size;
          const pct = Math.min((uniqueUsers / 6) * 100, 100);
          const isExp = expanded === i;
          const hours = [startHour, startHour + 1, startHour + 2];

          // Is any hour in this slot booked by the current user?
          const bookedByMeInSlot = slotBookings.some(b => b.user_id === userId);
          // Is this the slot that is currently live for this user?
          const isActiveSlot = activeSlotIdx === i;
          // Are ALL hours in this slot in the past?
          const isSlotAllPast = hours.every(h => isPastSlot(event.date, h, istNow));

          return (
            <Card key={label} className={`spiritual-card transition-all ${isSlotAllPast ? "opacity-50"
                : isActiveSlot ? "ring-2 ring-green-400/70"
                  : isExp ? "ring-1 ring-primary/40" : ""
              }`}>
              {/* Slot header — click to expand (disabled if all past) */}
              <button
                className="w-full flex items-center gap-3 p-4 text-left disabled:cursor-not-allowed"
                onClick={() => !isSlotAllPast && toggle(i)}
                disabled={isSlotAllPast}
              >
                {/* Slot number badge with status dot */}
                <div className="relative flex-shrink-0">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">S{i + 1}</span>
                  </div>
                  {/* Green dot: pulsing if active now, static if booked */}
                  {isActiveSlot && (
                    <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 border-2 border-background animate-pulse" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-sm">{label}</span>
                      {isSlotAllPast && (
                        <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 text-xs py-0 h-5">
                          {getText("पिछला", "Past")}
                        </Badge>
                      )}
                      {isActiveSlot && !isSlotAllPast && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                          {getText("लाइव", "Live")}
                        </span>
                      )}
                      {bookedByMeInSlot && !isActiveSlot && !isSlotAllPast && (
                        <Badge variant="outline" className="text-green-600 border-green-300 text-xs py-0 h-5">
                          {getText("बुक किया", "Booked")}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {getText(`${uniqueUsers} बुकिंग`, `${uniqueUsers} booked`)}
                    </span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
                {!isSlotAllPast && (isExp
                  ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />)}
              </button>

              {/* Inline expanded booking UI */}
              {isExp && (
                <CardContent className="border-t border-border/40 pt-3 pb-4 space-y-2">
                  <p className="text-xs text-muted-foreground mb-3">
                    {getText(
                      "बुक करने के लिए एक या अधिक घंटे चुनें। एक से अधिक घंटे चुन सकते हैं।",
                      "Select one or more hours to book. Multiple hours can be selected."
                    )}
                  </p>

                  {hours.map(hour => {
                    const hBookings = bookings.filter(b => b.hour === hour);
                    const bookedByMe = hBookings.some(b => b.user_id === userId);
                    const blockedByOtherGroup = !bookedByMe && blockedHours.has(hour);
                    const isPast = isPastSlot(event.date, hour, istNow);
                    const memberCount = new Set(hBookings.map(b => b.user_id)).size;
                    const isSel = selected.includes(hour);
                    const isUnavailable = bookedByMe || blockedByOtherGroup || isPast;

                    return (
                      <div
                        key={hour}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${isPast ? "border-border/30 bg-muted/10 opacity-50"
                            : isSel ? "border-primary/50 bg-primary/5"
                              : bookedByMe ? "border-border bg-muted/20"
                                : blockedByOtherGroup ? "border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 dark:border-orange-800/40"
                                  : "border-border/60 bg-background"
                          }`}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={() => !isUnavailable && toggleHour(hour)}
                          disabled={isUnavailable}
                          className="flex-shrink-0 disabled:cursor-default"
                        >
                          {isSel || bookedByMe
                            ? <CheckSquare className="h-5 w-5 text-primary" />
                            : blockedByOtherGroup
                              ? <Square className="h-5 w-5 text-orange-400" />
                              : isPast
                                ? <Square className="h-5 w-5 text-muted-foreground/40" />
                                : <Square className="h-5 w-5 text-muted-foreground" />}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium text-foreground">
                              {HOUR_LABELS[hour]}–{HOUR_NEXT_LABELS[hour]}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {getText(
                              `${memberCount} सदस्य ने बुक किया`,
                              `${memberCount} member${memberCount !== 1 ? "s" : ""} booked`
                            )}
                          </p>
                        </div>

                        {/* Status badge */}
                        {bookedByMe
                          ? <Badge variant="default">{getText("बुक किया", "Booked")}</Badge>
                          : isPast
                            ? <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 text-xs">{getText("पिछला", "Past")}</Badge>
                            : blockedByOtherGroup
                              ? <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">{getText("दूसरा समूह", "Other group")}</Badge>
                              : null}

                        {/* Avatars */}
                        {hBookings.length > 0 && (
                          <div className="flex -space-x-1">
                            {hBookings.slice(0, 3).map((b, bi) => (
                              <div key={b.id} className="h-6 w-6 rounded-full bg-primary/20 border border-background flex items-center justify-center">
                                <span className="text-xs font-bold text-primary">
                                  {b.user_id === userId ? "M" : String(bi + 1)}
                                </span>
                              </div>
                            ))}
                            {hBookings.length > 3 && (
                              <div className="h-6 w-6 rounded-full bg-muted border border-background flex items-center justify-center">
                                <span className="text-xs text-muted-foreground">+{hBookings.length - 3}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Confirm + Start Counter — only when hours are selected or slot is live */}
                  {(selected.length > 0 || isActiveSlot) && (
                    <div className="pt-3 space-y-2">
                      {selected.length > 0 && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">{getText("चयनित", "Selected")}</span>
                            <Badge>{getText(`${selected.length} घंटे`, `${selected.length} hour${selected.length > 1 ? "s" : ""}`)}</Badge>
                          </div>
                          <Button
                            className="w-full counter-button"
                            disabled={loading}
                            onClick={async () => {
                              await onBook(selected);
                              setSelected([]);
                              setExpanded(null);
                            }}
                          >
                            {loading ? getText("बुक हो रहा है...", "Booking...") : getText("बुकिंग पुष्टि करें", "Confirm Booking")}
                          </Button>
                        </>
                      )}

                      {/* Start Counter — shown inline when this slot is currently live */}
                      {isActiveSlot && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800">
                          <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-green-700 dark:text-green-400">
                              {getText("आपका स्लॉट अभी चालू है", "Your slot is live now")}
                            </div>
                            <div className="text-xs text-green-600 dark:text-green-500">{HOUR_LABELS[currentHour]}–{HOUR_NEXT_LABELS[currentHour]}</div>
                          </div>
                          <Button size="sm" className="counter-button flex-shrink-0" onClick={onStartCounter}>
                            <Play className="mr-1.5 h-3.5 w-3.5" />
                            {getText("काउंटर शुरू करें", "Start Counter")}
                          </Button>
                        </div>
                      )}

                      {selected.length > 0 && (
                        <p className="text-xs text-muted-foreground text-center">
                          {getText(
                            "एक ही उपयोगकर्ता दूसरे समूह में समान घंटे बुक नहीं कर सकता।",
                            "Same user cannot book overlapping hours in another group."
                          )}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <Dialog open={Boolean(editBooking)} onOpenChange={(open) => { if (!open) closeEdit(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getText("माला संपादित करें", "Edit Malas")}</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            <div>{dateLabel}</div>
            {editHourLabel && <div>{editHourLabel}</div>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cg-edit-malas">{getText("माला", "Malas")}</Label>
            <Input
              id="cg-edit-malas"
              type="number"
              min={0}
              max={10000}
              step={1}
              value={editMalas}
              onChange={(e) => setEditMalas(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={closeEdit} disabled={editSaving}>
              {getText("रद्द करें", "Cancel")}
            </Button>
            <Button type="button" onClick={handleSaveEdit} disabled={editSaving || !editMalas.trim()}>
              {editSaving ? getText("सेव हो रहा है...", "Saving...") : getText("सहेजें", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// // ─── Active Slot Screen ────────────────────────────────────────────────────────
// export const ActiveSlotScreen = ({ date, hour, bookings, members, onBack, onStartCounter }: {
//   date: string; hour: number; bookings: CgBooking[]; members: CgMember[];
//   onBack: () => void; onStartCounter: () => void;
// }) => {
//   const dateLabel = new Date(date).toLocaleDateString("en-IN", {
//     day: "numeric", month: "long", year: "numeric",
//   });
//   const hourBookings = bookings.filter(b => b.hour === hour);
//   const participantIds = new Set(hourBookings.map(b => b.user_id));
//   const participants = members.filter(m => participantIds.has(m.user_id));

//   return (
//     <div className="p-6 space-y-6 max-w-2xl mx-auto pb-24">
//       <div className="flex items-center gap-3">
//         <Button variant="ghost" size="sm" onClick={onBack} className="px-2">&#8592; Back</Button>
//       </div>
//       <PageHeader title="Your Active Slot" subtitle={dateLabel} />

//       <Card className="spiritual-card">
//         <CardContent className="p-6 text-center space-y-4">
//           <div className="text-3xl font-bold text-foreground">
//             {HOUR_LABELS[hour]}–{HOUR_NEXT_LABELS[hour]}
//           </div>
//           <div className="flex items-center justify-center gap-2">
//             <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
//             <span className="text-sm font-semibold text-green-600">Active</span>
//           </div>
//           <Button className="w-full counter-button" size="lg" onClick={onStartCounter}>
//             <Play className="mr-2 h-5 w-5" />
//             Start Counter
//           </Button>
//         </CardContent>
//       </Card>

//       <Card className="spiritual-card">
//         <CardHeader className="pb-3">
//           <CardTitle className="flex items-center text-base">
//             <Users className="mr-2 h-4 w-4 text-primary" />
//             Participants ({participants.length})
//           </CardTitle>
//         </CardHeader>
//         <CardContent>
//           {participants.length === 0 ? (
//             <p className="text-sm text-muted-foreground">No other participants yet.</p>
//           ) : (
//             <div className="flex flex-wrap gap-2">
//               {participants.map(m => {
//                 const label = memberLabel(m);
//                 return (
//                   <div key={m.user_id} className="flex items-center gap-2 bg-muted/40 rounded-full px-3 py-1.5">
//                     <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
//                       <span className="text-xs font-bold text-primary">{label[0].toUpperCase()}</span>
//                     </div>
//                     <span className="text-sm font-medium text-foreground">{label}</span>
//                     {m.role === "admin" && <Badge variant="secondary" className="text-xs px-1.5 py-0">Admin</Badge>}
//                   </div>
//                 );
//               })}
//             </div>
//           )}
//         </CardContent>
//       </Card>
//     </div>
//   );
// };
