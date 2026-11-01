-- 0004: introduce a project-scoped, rights-aware research desk.
DO $migration$
BEGIN
  ALTER TABLE public.research_sources ADD COLUMN IF NOT EXISTS created_by text;
  ALTER TABLE public.research_sources ADD COLUMN IF NOT EXISTS license_status text NOT NULL DEFAULT 'unknown';
  ALTER TABLE public.research_sources ADD COLUMN IF NOT EXISTS rights_notes text;
  ALTER TABLE public.research_sources ADD COLUMN IF NOT EXISTS source_domain text;
  ALTER TABLE public.research_reports ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';
  ALTER TABLE public.research_reports ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'research_sources_license_status_check'
      AND conrelid = 'public.research_sources'::regclass
  ) THEN
    ALTER TABLE public.research_sources
      ADD CONSTRAINT research_sources_license_status_check
      CHECK (license_status IN ('unknown','public_domain','cc0','cc_by','cc_by_sa','licensed','permission_required','restricted'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'research_reports_status_check'
      AND conrelid = 'public.research_reports'::regclass
  ) THEN
    ALTER TABLE public.research_reports
      ADD CONSTRAINT research_reports_status_check
      CHECK (status IN ('draft','review','approved'));
  END IF;

  CREATE INDEX IF NOT EXISTS research_sources_project_created_idx
    ON public.research_sources(project_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS research_reports_project_created_idx
    ON public.research_reports(project_id, created_at DESC);

  GRANT SELECT, INSERT ON public.research_sources TO authenticated;
  GRANT SELECT, INSERT ON public.research_reports TO authenticated;

  DROP POLICY IF EXISTS studio_research_sources_member_read ON public.research_sources;
  CREATE POLICY studio_research_sources_member_read ON public.research_sources
    FOR SELECT TO authenticated
    USING (public.studio_is_project_member(project_id));

  DROP POLICY IF EXISTS studio_research_sources_editor_create ON public.research_sources;
  CREATE POLICY studio_research_sources_editor_create ON public.research_sources
    FOR INSERT TO authenticated
    WITH CHECK (created_by = public.studio_current_user_id() AND public.studio_can_edit_project(project_id));

  DROP POLICY IF EXISTS studio_research_reports_member_read ON public.research_reports;
  CREATE POLICY studio_research_reports_member_read ON public.research_reports
    FOR SELECT TO authenticated
    USING (public.studio_is_project_member(project_id));

  DROP POLICY IF EXISTS studio_research_reports_editor_create ON public.research_reports;
  CREATE POLICY studio_research_reports_editor_create ON public.research_reports
    FOR INSERT TO authenticated
    WITH CHECK (created_by = public.studio_current_user_id() AND public.studio_can_edit_project(project_id));

  INSERT INTO public.schema_migrations(version)
  VALUES ('0004_research_desk_rls')
  ON CONFLICT (version) DO NOTHING;
END
$migration$;
