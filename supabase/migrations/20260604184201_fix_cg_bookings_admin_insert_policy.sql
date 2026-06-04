-- Fix: Restore correct booking policy.
-- Migration 20260527121500 accidentally blocked ALL users from booking today.
-- The intended behavior is:
--   - Admins cannot book for today (they set up the schedule)
--   - Regular members CAN book for today IF a slot is available
--   - Nobody (admin or member) can book for PAST dates
--
-- This replaces the overly-restrictive policy with the correct one.

DROP POLICY IF EXISTS "Users can create their own cg_bookings" ON public.cg_bookings;

CREATE POLICY "Users can create their own cg_bookings"
ON public.cg_bookings
FOR INSERT
WITH CHECK (
  -- Must be booking for themselves
  auth.uid() = user_id

  -- Must be a member of the group
  AND EXISTS (
    SELECT 1 FROM public.cg_members m
    WHERE m.group_id = cg_bookings.group_id
      AND m.user_id = auth.uid()
  )

  -- Cannot book for PAST dates (strictly before today in IST)
  AND cg_bookings.date >= (now() AT TIME ZONE 'Asia/Kolkata')::date

);

