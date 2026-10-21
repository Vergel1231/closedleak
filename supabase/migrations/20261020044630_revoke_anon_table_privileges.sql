/*
  # Revoke unused anon table privileges (deny by default)

  1. Security
    - The anon (unauthenticated) role held SELECT, INSERT, UPDATE and DELETE on
      every column of all eight application tables. No policy admits the anon
      role, so row level security denies these requests today, but the grants
      remove the safety margin: a single future permissive policy, or RLS being
      disabled on a table, would immediately expose every tenant's data to the
      public anon key.
    - Revoking them makes the data layer deny by default for unauthenticated
      callers regardless of what policies exist.

  2. Notes
    - Only the anon role is changed. Every authenticated grant and every
      existing policy is left exactly as it was.
    - The application is unaffected: all reads and writes in the client run
      after sign-in with an authenticated JWT (business_id always comes from
      the authenticated session), and the landing, login and signup screens
      perform no table access.
    - No data is touched; this is a privilege change only.
*/

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.appointments FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.availability_slots FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.businesses FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.calls FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.customers FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.events FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.leads FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.messages FROM anon;
