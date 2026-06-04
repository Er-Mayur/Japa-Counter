-- Disallow creating bookings for today or past dates (IST)
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
  -- Only allow booking for future dates (strictly greater than today in IST)
  AND cg_bookings.date > (now() AT TIME ZONE 'Asia/Kolkata')::date
);
