import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useJapa } from "@/contexts/JapaContext";

import { CgGroup, CgEvent, CgBooking, CgMember, CgScreen, CgEventStats, generateCode, getISTNow, toDateStr, isPastSlot } from "./ChakriGajarTypes";
import { HomeScreen, CreateGroupScreen } from "./ChakriGajarScreensA";
import { GroupDetailsScreen, ScheduleListScreen } from "./ChakriGajarScreensB";
import { CgCounterScreen, CgCalendarScreen, CgDatePickerModal, ScheduleSummaryScreen } from "./ChakriGajarScreensD";

export const ChakriGajar = ({ onActiveSlotChange }: { onActiveSlotChange?: (active: boolean) => void }) => {
  const { user } = useAuth();
  const { incrementJaaps, getText } = useJapa();

  const [screen, setScreen] = useState<CgScreen>("home");
  const [selectedCalDate, setSelectedCalDate] = useState<string>("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [groups, setGroups] = useState<CgGroup[]>([]);
  const [events, setEvents] = useState<CgEvent[]>([]);
  const [eventStats, setEventStats] = useState<Record<string, CgEventStats>>({});
  const [bookings, setBookings] = useState<CgBooking[]>([]);
  const [members, setMembers] = useState<CgMember[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<CgGroup | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CgEvent | null>(null);
  const [selectedHours, setSelectedHours] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  // Whether the current user has any active slot RIGHT NOW (current hour booked today)
  const [activeSlotNow, setActiveSlotNow] = useState(false);
  // Hours this user has booked in OTHER groups on the same date (cross-group overlap prevention)
  const [globalBlockedHours, setGlobalBlockedHours] = useState<Set<number>>(new Set());
  // Track which screen invoked the counter so back works correctly
  const [counterOrigin, setCounterOrigin] = useState<CgScreen>("scheduleList");

  // Always use IST for all time comparisons (UTC+5:30 = Asia/Kolkata)
  const now = getISTNow();
  const todayStr = toDateStr(now);
  const currentHour = now.getHours();

  const activeBooking = useMemo(() =>
    bookings.find(b => b.date === todayStr && b.hour === currentHour && b.user_id === user?.id),
    [bookings, todayStr, currentHour, user]
  );

  const isAdmin = selectedGroup?.role === "admin";

  // ── Data Loaders ───────────────────────────────────────────────────────────
  const buildEventStats = (eventBookings: CgBooking[]): CgEventStats => {
    const stats: CgEventStats = { myJaaps: 0, groupJaaps: 0, hasBooking: false };
    for (const booking of eventBookings) {
      const jaaps = booking.jaaps || 0;
      stats.groupJaaps += jaaps;
      if (booking.user_id === user?.id) {
        stats.myJaaps += jaaps;
        stats.hasBooking = true;
      }
    }
    return stats;
  };

  const loadEventStats = async (eventList: CgEvent[]) => {
    if (!user) return;
    if (eventList.length === 0) {
      setEventStats({});
      return;
    }
    const eventIds = eventList.map(e => e.id);
    const { data, error } = await supabase
      .from("cg_bookings")
      .select("event_id, user_id, jaaps")
      .in("event_id", eventIds);
    if (error) {
      console.error("Failed to load event stats:", error.message);
      return;
    }

    const statsMap: Record<string, CgEventStats> = {};
    eventList.forEach(ev => {
      statsMap[ev.id] = { myJaaps: 0, groupJaaps: 0, hasBooking: false };
    });
    (data || []).forEach((row: any) => {
      const stats = statsMap[row.event_id];
      if (!stats) return;
      const jaaps = row.jaaps || 0;
      stats.groupJaaps += jaaps;
      if (row.user_id === user.id) {
        stats.myJaaps += jaaps;
        stats.hasBooking = true;
      }
    });
    setEventStats(statsMap);
  };

  const handleBookingCountChange = (bookingId: string, eventId: string, nextCount: number) => {
    setBookings(prev => {
      const updated = prev.map(b => b.id === bookingId ? { ...b, jaaps: nextCount } : b);
      setEventStats(prevStats => ({ ...prevStats, [eventId]: buildEventStats(updated) }));
      return updated;
    });
  };
  const loadGroups = async (preferredId?: string) => {
    if (!user) return;
    const { data: membershipRows, error: membershipError } = await supabase
      .from("cg_members")
      .select("group_id, role")
      .eq("user_id", user.id);
    if (membershipError) {
      console.error("Failed to load group memberships:", membershipError.message);
      setGroups([]);
      setActiveSlotNow(false);
      onActiveSlotChange?.(false);
      return;
    }

    const memberGroups = (membershipRows || []) as Array<{ group_id: string; role: string }>;
    const groupIds = Array.from(new Set(memberGroups.map(m => m.group_id)));

    if (groupIds.length === 0) {
      setGroups([]);
      setActiveSlotNow(false);
      onActiveSlotChange?.(false);
      return;
    }

    const { data: groupRows, error: groupError } = await supabase
      .from("cg_groups")
      .select("id, name, code, created_by")
      .in("id", groupIds);
    if (groupError) {
      console.error("Failed to load groups:", groupError.message);
      setGroups([]);
      setActiveSlotNow(false);
      onActiveSlotChange?.(false);
      return;
    }

    const groupMap = new Map((groupRows || []).map((g: any) => [g.id, g]));
    const mapped: CgGroup[] = memberGroups
      .map((row) => {
        const group = groupMap.get(row.group_id);
        if (!group) return null;
        return {
          id: group.id,
          name: group.name,
          code: group.code,
          created_by: group.created_by,
          role: row.role,
          totalJaap: 0,
        };
      })
      .filter(Boolean) as CgGroup[];

    const freshNow = getISTNow();
    const freshTodayStr = toDateStr(freshNow);
    const freshHour = freshNow.getHours();
    const mappedGroupIds = mapped.map(g => g.id);

    if (mappedGroupIds.length > 0) {
      // Run all 3 secondary queries in PARALLEL — saves 2 round-trips vs sequential awaits
      const [todayEventsResult, jaapTotalsResult, activeNowResult] = await Promise.all([
        supabase.from("cg_events")
          .select("id, group_id, date")
          .in("group_id", mappedGroupIds)
          .eq("date", freshTodayStr),

        supabase.from("cg_bookings")
          .select("group_id, jaaps")
          .in("group_id", mappedGroupIds),

        supabase.from("cg_bookings")
          .select("id")
          .eq("user_id", user.id)
          .eq("date", freshTodayStr)
          .eq("hour", freshHour)
          .limit(1),
      ]);

      // Apply today's event IDs
      const todayMap = new Map((todayEventsResult.data || []).map(e => [e.group_id, e]));
      mapped.forEach(g => {
        const ev = todayMap.get(g.id);
        if (ev) { g.todayEventId = ev.id; g.todayEventDate = ev.date; }
      });

      // Aggregate totalJaap per group client-side
      const jaapMap = new Map<string, number>();
      (jaapTotalsResult.data || []).forEach(b => {
        jaapMap.set(b.group_id, (jaapMap.get(b.group_id) ?? 0) + (b.jaaps || 0));
      });
      mapped.forEach(g => { g.totalJaap = jaapMap.get(g.id) ?? 0; });

      // Active slot check
      const isActive = (activeNowResult.data?.length ?? 0) > 0;
      setActiveSlotNow(isActive);
      onActiveSlotChange?.(isActive);
    } else {
      setActiveSlotNow(false);
      onActiveSlotChange?.(false);
    }

    setGroups(mapped);
    if (preferredId) {
      const g = mapped.find(g => g.id === preferredId);
      if (g) { setSelectedGroup(g); loadMembers(g.id); }
    } else if (mapped.length > 0 && !selectedGroup) {
      setSelectedGroup(mapped[0]);
      loadMembers(mapped[0].id);
    }
  };

  const loadEvents = async (groupId: string) => {
    if (!groupId) { setEvents([]); return; }
    // Run event fetch and stats fetch in parallel
    const [eventsResult] = await Promise.all([
      supabase.from("cg_events")
        .select("id, group_id, date").eq("group_id", groupId).order("date", { ascending: true }),
    ]);
    const eventList = eventsResult.data || [];
    setEvents(eventList);
    await loadEventStats(eventList);
  };

  const loadBookings = async (eventId: string, date?: string) => {
    if (!eventId) { setBookings([]); return; }
    const { data } = await supabase.from("cg_bookings")
      .select("id, event_id, group_id, user_id, date, hour, jaaps")
      .eq("event_id", eventId).order("hour", { ascending: true });
    const fetched = data || [];
    setBookings(fetched);
    setEventStats(prev => ({ ...prev, [eventId]: buildEventStats(fetched) }));
    // Check if user has an active slot RIGHT NOW in these bookings
    const isActive = fetched.some(b => b.user_id === user?.id && b.date === todayStr && b.hour === currentHour);
    setActiveSlotNow(isActive);
    onActiveSlotChange?.(isActive);
    // Also refresh cross-group blocked hours for the event date
    if (date) loadGlobalBlockedHours(date, eventId);
  };

  /** Fetch hours the current user has booked on `date` in groups OTHER than the current event's group. */
  const loadGlobalBlockedHours = async (date: string, currentEventId: string) => {
    if (!user) return;
    const { data } = await supabase
      .from("cg_bookings")
      .select("hour, event_id")
      .eq("user_id", user.id)
      .eq("date", date)
      .neq("event_id", currentEventId);
    setGlobalBlockedHours(new Set((data || []).map(b => b.hour)));
  };

  const loadMembers = async (groupId: string) => {
    if (!groupId) { setMembers([]); return; }
    const { data } = await supabase.from("cg_members").select("user_id, role").eq("group_id", groupId);
    if (!data || data.length === 0) { setMembers([]); return; }
    const userIds = data.map(m => m.user_id);
    // Fetch profiles in parallel with no extra delay
    const { data: profiles } = await supabase.from("profiles").select("user_id, display_name").in("user_id", userIds);
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p.display_name]));
    setMembers(data.map(m => ({ user_id: m.user_id, role: m.role, display_name: profileMap.get(m.user_id) ?? null })));
  };

  useEffect(() => { loadGroups(); }, [user]);
  useEffect(() => { if (selectedGroup) { loadEvents(selectedGroup.id); loadMembers(selectedGroup.id); } }, [selectedGroup]);
  useEffect(() => { if (selectedEvent) loadBookings(selectedEvent.id, selectedEvent.date); }, [selectedEvent]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleCreateGroup = async (name: string, code: string, _desc: string) => {
    if (!user || !name.trim()) return;
    setLoading(true);
    const { data, error } = await supabase.from("cg_groups")
      .insert({ name: name.trim(), code, created_by: user.id })
      .select("id, name, code, created_by").maybeSingle();
    if (!error && data) {
      await supabase.from("cg_members")
        .upsert({ group_id: data.id, user_id: user.id, role: "admin" }, { onConflict: "group_id,user_id", ignoreDuplicates: true });
      await loadGroups(data.id);
      setScreen("home");
    }
    setLoading(false);
  };

  const handleJoinGroup = async (code: string) => {
    if (!user || !code.trim()) return;
    setLoading(true);
    // Use the SECURITY DEFINER RPC so non-members can look up a group
    // by its invite code without needing broad cg_groups SELECT access.
    const { data } = await supabase.rpc("cg_find_group_by_code", { lookup_code: code.trim() });
    const groupId = Array.isArray(data) && data.length > 0 ? (data[0] as { id: string }).id : null;
    if (groupId) {
      await supabase.from("cg_members")
        .upsert({ group_id: groupId, user_id: user.id, role: "member" }, { onConflict: "group_id,user_id", ignoreDuplicates: true });
      await loadGroups(groupId);
      setScreen("home");
    }
    setLoading(false);
  };

  const handleUpdateGroupName = async (name: string) => {
    if (!user || !selectedGroup || selectedGroup.role !== "admin") return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    const groupId = selectedGroup.id;
    const { error } = await supabase
      .from("cg_groups")
      .update({ name: trimmed })
      .eq("id", groupId);
    if (error) {
      console.error("Failed to update group:", error.message);
      setLoading(false);
      return;
    }
    await loadGroups(groupId);
    setLoading(false);
  };

  const handleDeleteGroup = async () => {
    if (!user || !selectedGroup || selectedGroup.role !== "admin") return;
    setLoading(true);
    const groupId = selectedGroup.id;
    const { error } = await supabase
      .from("cg_groups")
      .delete()
      .eq("id", groupId);
    if (error) {
      console.error("Failed to delete group:", error.message);
      setLoading(false);
      return;
    }
    setSelectedGroup(null);
    setSelectedEvent(null);
    setEvents([]);
    setBookings([]);
    setMembers([]);
    setScreen("home");
    await loadGroups();
    setLoading(false);
  };

  // Opens the date picker modal — actual creation happens in handleCreateEventWithDate
  const handleCreateEvent = () => {
    if (!user || !selectedGroup) return;
    setShowDatePicker(true);
  };

  const handleCreateEventWithDate = async (date: string) => {
    setShowDatePicker(false);
    if (!user || !selectedGroup) return;

    // Block past dates (IST) — calendar already prevents it, but double-check
    const freshToday = toDateStr(getISTNow());
    if (date < freshToday) return;

    setLoading(true);
    const { data } = await supabase.from("cg_events")
      .insert({ group_id: selectedGroup.id, date, created_by: user.id })
      .select("id, group_id, date").maybeSingle();
    if (data) { setSelectedEvent(data); await loadEvents(selectedGroup.id); }
    setLoading(false);
  };

  const handleBookHours = async (hours: number[]) => {
    if (!user || !selectedEvent || !selectedGroup) return;
    setLoading(true);

    // Guard 1: skip hours already booked in THIS event by this user
    const sameEventBooked = new Set(
      bookings.filter(b => b.user_id === user.id).map(b => b.hour)
    );

    // Guard 2: refresh cross-group blocks for this date, then filter
    const { data: crossData } = await supabase
      .from("cg_bookings")
      .select("hour")
      .eq("user_id", user.id)
      .eq("date", selectedEvent.date)
      .neq("event_id", selectedEvent.id);
    const crossGroupBlocked = new Set((crossData || []).map(b => b.hour));
    setGlobalBlockedHours(crossGroupBlocked);

    // Guard 3: skip past hours (IST)
    const istNow = getISTNow();

    // Only insert hours not blocked anywhere and not in the past
    const newHours = hours.filter(h =>
      !sameEventBooked.has(h) &&
      !crossGroupBlocked.has(h) &&
      !isPastSlot(selectedEvent.date, h, istNow)
    );

    if (newHours.length > 0) {
      // BULK INSERT — single API call instead of N sequential inserts
      const rows = newHours.map(hour => ({
        event_id: selectedEvent.id,
        group_id: selectedGroup.id,
        user_id: user.id,
        date: selectedEvent.date,
        hour,
      }));
      const { error } = await supabase.from("cg_bookings").insert(rows);
      if (error && error.code !== "23505") {
        console.error("Booking insert error:", error.message);
      }
    }

    await loadBookings(selectedEvent.id, selectedEvent.date);
    setSelectedHours(hours);
    setLoading(false);
  };



  // Navigate directly to today's schedule for a group (triggered from Home green dot)
  const handleGoToToday = (group: CgGroup) => {
    if (!group.todayEventId || !group.todayEventDate) return;

    // Guard: validate event date is STILL today in IST (may have changed since last loadGroups)
    const freshToday = toDateStr(getISTNow());
    if (group.todayEventDate !== freshToday) {
      // Date has rolled over — refresh groups silently and abort (dot will disappear)
      loadGroups();
      return;
    }

    const ev: CgEvent = { id: group.todayEventId, group_id: group.id, date: group.todayEventDate };
    setSelectedGroup(group);
    setSelectedEvent(ev);
    loadBookings(ev.id, ev.date);
    loadMembers(group.id);
    setScreen("scheduleList");
  };


  // ── Navigation ─────────────────────────────────────────────────────────────
  const navigate = (s: CgScreen, data?: any) => {
    if (s === "groupDetails" && data) {
      setSelectedGroup(data);
      loadEvents(data.id);
      loadMembers(data.id);
    }
    if (s === "scheduleList" && data) {
      setSelectedEvent(data);
      loadBookings(data.id, data.date);
    }
    setScreen(s);
  };

  // goHome always refreshes group list so todayEventId is up-to-date
  const goHome = () => { loadGroups(); setScreen("home"); };

  // ── Render ─────────────────────────────────────────────────────────────────
  switch (screen) {
    case "home":
      return <HomeScreen groups={groups} onNavigate={navigate} onNewGroup={() => setScreen("createGroup")} onGoToToday={handleGoToToday} />;

    case "createGroup":
      return <CreateGroupScreen onBack={goHome} onCreate={handleCreateGroup} onJoin={handleJoinGroup} loading={loading} />;

    case "groupDetails":
      return selectedGroup ? (
        <>
          <GroupDetailsScreen
            group={selectedGroup} events={events} members={members} isAdmin={isAdmin}
            todayStr={todayStr}
            onBack={goHome} onNavigate={navigate} onSchedule={handleCreateEvent}
            onEditGroup={handleUpdateGroupName}
            onDeleteGroup={handleDeleteGroup}
            loading={loading}
             eventStats={eventStats}
          />
          {showDatePicker && (
            <CgDatePickerModal
              scheduledDates={events.map(e => e.date)}
              onSelect={handleCreateEventWithDate}
              onClose={() => setShowDatePicker(false)}
            />
          )}
        </>
      ) : null;

    case "scheduleList":
      return selectedEvent ? (
        <ScheduleListScreen
          event={selectedEvent}
          bookings={bookings}
          members={members}
          userId={user?.id ?? ""}
          currentHour={currentHour}
          todayStr={todayStr}
          loading={loading}
          blockedHours={globalBlockedHours}
          onBookingCountChange={handleBookingCountChange}
          onBack={() => navigate("groupDetails", selectedGroup)}
          onBook={handleBookHours}
          onStartCounter={() => {
            // Ensure selectedHours is set so counter knows which hour is active
            setSelectedHours([currentHour]);
            setCounterOrigin("scheduleList");
            setScreen("cgCounter");
          }}
        />
      ) : null;

    case "cgCounter":
      return activeBooking ? (
        <CgCounterScreen
          onBack={() => setScreen(counterOrigin)}
          onCountChange={(nextCount) => handleBookingCountChange(activeBooking.id, activeBooking.event_id, nextCount)}
          bookingId={activeBooking.id}
          eventId={activeBooking.event_id}
          initialCount={activeBooking.jaaps ?? 0}
        />
      ) : (
        // No active booking — go back
        <div className="p-6 text-center text-muted-foreground">
          <p>{getText("इस घंटे के लिए कोई बुकिंग नहीं है।", "No active booking for this hour.")}</p>
          <button onClick={() => setScreen(counterOrigin)} className="mt-4 underline text-sm">
            {getText("वापस जाएं", "Go back")}
          </button>
        </div>
      );

    case "cgCalendar":
      return (
        <CgCalendarScreen
          scheduledDates={events.map(e => e.date)}
          completedDates={[]}
          onDateSelect={(d) => {
            const calEvent = events.find(e => e.date === d) ?? null;
            setSelectedCalDate(d);
            if (calEvent) {
              setSelectedEvent(calEvent);
              loadBookings(calEvent.id, calEvent.date);
            } else {
              setSelectedEvent(null);
              setBookings([]);
            }
            setScreen("scheduleSummary");
          }}
          onBack={goHome}
        />
      );

    case "scheduleSummary": {
      const calEvent = events.find(e => e.date === selectedCalDate) ?? selectedEvent ?? null;
      return (
        <ScheduleSummaryScreen
          group={selectedGroup}
          event={calEvent}
          bookings={bookings}
          onBack={() => setScreen("cgCalendar")}
          onViewFull={() => { if (calEvent) navigate("scheduleList", calEvent); }}
        />
      );
    }

    default:
      return <HomeScreen groups={groups} onNavigate={navigate} onNewGroup={() => setScreen("createGroup")} onGoToToday={handleGoToToday} />;
  }
};
