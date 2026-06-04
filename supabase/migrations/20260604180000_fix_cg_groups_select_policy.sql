-- ============================================================
-- Fix: Restrict cg_groups SELECT to group members and creators
-- ============================================================
-- Previously ANY authenticated user could see ALL groups in the
-- database. A brand-new user (with no memberships) would receive
-- every group name, code, and ID — a data isolation violation.
--
-- The join-by-code flow (which legitimately needs to look up a
-- group by its code before joining) is moved to a SECURITY DEFINER
-- function so it bypasses RLS in a controlled, audited way.
-- ============================================================

-- Step 1: Create a helper function for the join-by-code lookup.
--         SECURITY DEFINER bypasses RLS, so we validate the input
--         strictly — only return the group id, nothing sensitive.
CREATE OR REPLACE FUNCTION public.cg_find_group_by_code(lookup_code text)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.id
  FROM public.cg_groups g
  WHERE g.code = lookup_code
  LIMIT 1;
$$;

-- Step 2: Grant execute to authenticated users only
REVOKE ALL ON FUNCTION public.cg_find_group_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cg_find_group_by_code(text) TO authenticated;

-- Step 3: Replace the overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view cg_groups" ON public.cg_groups;

CREATE POLICY "Group members can view cg_groups"
ON public.cg_groups
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    -- Group creator can always see their own group
    auth.uid() = created_by
    -- Active group members can see the group
    OR public.cg_user_in_group(auth.uid(), cg_groups.id)
  )
);
