-- 0002: restrict API database access and enforce tenant isolation on development.
-- Apply to the development branch only. The table set is deliberately fail-closed:
-- future tables receive RLS but no API grants or policies until reviewed.
DO $migration$
DECLARE
  table_name text;
BEGIN

  CREATE OR REPLACE FUNCTION public.studio_current_user_id()
  RETURNS text
  LANGUAGE sql
  VOLATILE
  AS $function$
    SELECT nullif(current_setting('app.user_id', true), '')
  $function$;

  CREATE OR REPLACE FUNCTION public.studio_is_workspace_member(target_workspace_id uuid)
  RETURNS boolean
  LANGUAGE sql
  VOLATILE
  SECURITY DEFINER
  SET search_path = pg_catalog, public
  AS $function$
    SELECT EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = target_workspace_id
        AND user_id = public.studio_current_user_id()
    )
  $function$;

  CREATE OR REPLACE FUNCTION public.studio_is_workspace_owner(target_workspace_id uuid)
  RETURNS boolean
  LANGUAGE sql
  VOLATILE
  SECURITY DEFINER
  SET search_path = pg_catalog, public
  AS $function$
    SELECT EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE id = target_workspace_id
        AND owner_user_id = public.studio_current_user_id()
    )
  $function$;

  CREATE OR REPLACE FUNCTION public.studio_can_edit_workspace(target_workspace_id uuid)
  RETURNS boolean
  LANGUAGE sql
  VOLATILE
  SECURITY DEFINER
  SET search_path = pg_catalog, public
  AS $function$
    SELECT EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = target_workspace_id
        AND user_id = public.studio_current_user_id()
        AND role IN ('owner', 'admin', 'editor')
    )
  $function$;

  GRANT USAGE ON SCHEMA public TO authenticated;
  GRANT EXECUTE ON FUNCTION public.studio_current_user_id() TO authenticated;
  GRANT EXECUTE ON FUNCTION public.studio_is_workspace_member(uuid) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.studio_is_workspace_owner(uuid) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.studio_can_edit_workspace(uuid) TO authenticated;

  GRANT SELECT, INSERT ON public.workspaces TO authenticated;
  GRANT SELECT, INSERT ON public.workspace_members TO authenticated;
  GRANT SELECT, INSERT ON public.projects TO authenticated;
  GRANT INSERT ON public.audit_logs TO authenticated;
  GRANT USAGE ON SEQUENCE public.audit_logs_id_seq TO authenticated;

  FOREACH table_name IN ARRAY ARRAY[
    'user_profiles', 'workspaces', 'workspace_members', 'projects',
    'research_sources', 'research_reports', 'scripts', 'media_assets',
    'generation_jobs', 'clip_candidates', 'caption_tracks', 'seo_metadata',
    'social_accounts', 'oauth_tokens', 'social_posts', 'usage_ledger',
    'audit_logs', 'schema_migrations'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
  END LOOP;

  DROP POLICY IF EXISTS studio_profiles_self ON public.user_profiles;
  CREATE POLICY studio_profiles_self ON public.user_profiles
    FOR ALL TO authenticated
    USING (user_id = public.studio_current_user_id())
    WITH CHECK (user_id = public.studio_current_user_id());

  DROP POLICY IF EXISTS studio_workspaces_member_read ON public.workspaces;
  CREATE POLICY studio_workspaces_member_read ON public.workspaces
    FOR SELECT TO authenticated
    USING (owner_user_id = public.studio_current_user_id() OR public.studio_is_workspace_member(id));

  DROP POLICY IF EXISTS studio_workspaces_owner_create ON public.workspaces;
  CREATE POLICY studio_workspaces_owner_create ON public.workspaces
    FOR INSERT TO authenticated
    WITH CHECK (owner_user_id = public.studio_current_user_id());

  DROP POLICY IF EXISTS studio_members_workspace_read ON public.workspace_members;
  CREATE POLICY studio_members_workspace_read ON public.workspace_members
    FOR SELECT TO authenticated
    USING (user_id = public.studio_current_user_id() OR public.studio_is_workspace_member(workspace_id));

  DROP POLICY IF EXISTS studio_members_owner_add ON public.workspace_members;
  CREATE POLICY studio_members_owner_add ON public.workspace_members
    FOR INSERT TO authenticated
    WITH CHECK (user_id = public.studio_current_user_id() AND public.studio_is_workspace_owner(workspace_id));

  DROP POLICY IF EXISTS studio_projects_member_read ON public.projects;
  CREATE POLICY studio_projects_member_read ON public.projects
    FOR SELECT TO authenticated
    USING (public.studio_is_workspace_member(workspace_id));

  DROP POLICY IF EXISTS studio_projects_editor_create ON public.projects;
  CREATE POLICY studio_projects_editor_create ON public.projects
    FOR INSERT TO authenticated
    WITH CHECK (owner_user_id = public.studio_current_user_id() AND public.studio_can_edit_workspace(workspace_id));

  DROP POLICY IF EXISTS studio_audit_member_insert ON public.audit_logs;
  CREATE POLICY studio_audit_member_insert ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (
      actor_user_id = public.studio_current_user_id()
      AND (workspace_id IS NULL OR public.studio_is_workspace_member(workspace_id))
    );

  INSERT INTO public.schema_migrations (version)
  VALUES ('0002_api_runtime_rls')
  ON CONFLICT (version) DO NOTHING;
END
$migration$;
