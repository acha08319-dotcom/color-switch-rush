CREATE TABLE public.selfcheck_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

GRANT SELECT, INSERT ON public.selfcheck_reports TO anon;
GRANT SELECT, INSERT ON public.selfcheck_reports TO authenticated;
GRANT ALL ON public.selfcheck_reports TO service_role;

ALTER TABLE public.selfcheck_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can save a self-check report"
  ON public.selfcheck_reports FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can read a non-expired self-check report"
  ON public.selfcheck_reports FOR SELECT TO anon, authenticated
  USING (expires_at > now());