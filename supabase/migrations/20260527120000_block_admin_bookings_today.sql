-- Prevent admins from creating bookings for the current IST date
-- Drops the previous INSERT policy and recreates it with an extra check
-- that disallows inserts when the user is an admin of the group and the
-- booking `date` equals today's date in IST.

DROP POLICY IF EXISTS "Users can create their own cg_bookings" ON public.cg_bookings;

CREATE POLICY "Users can create their own cg_bookings"
ON public.cg_bookings
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.cg_members m
    WHERE m.group_id = cg_bookings.group_id
      AND m.user_id = auth.uid()
  )
  -- Disallow when the user is an admin for the group AND the booking date is today's date in IST
  AND NOT (
    EXISTS (
      SELECT 1 FROM public.cg_members m2
      WHERE m2.group_id = cg_bookings.group_id
        AND m2.user_id = auth.uid()
        AND m2.role = 'admin'
    )
    AND cg_bookings.date = (now() AT TIME ZONE 'Asia/Kolkata')::date
  )
);
