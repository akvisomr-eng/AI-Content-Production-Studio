-- 0003: enable secure script CRUD for workspace editors.
DO $migration$
BEGIN
  CREATE OR REPLACE FUNCTION public.studio_is_project_member(target_project_id uuid)
  RETURNS boolean
  LANGUAGE sql VOLATILE SECURITY DEFINER
  SET search_path = pg_catalog, public
  AS $function$
    SELECT EXISTS (
      SELECT 1
      FROM public.projects p
      JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
      WHERE p.id = target_project_id
        AND wm.user_id = public.studio_current_user_id()
    )
  $function$;

  CREATE OR REPLACE FUNCTION public.studio_can_edit_project(target_project_id uuid)
  RETURNS boolean
  LANGUAGE sql VOLATILE SECURITY DEFINER
  SET search_path = pg_catalog, public
  AS $function$
    SELECT EXISTS (
      SELECT 1
      FROM public.projects p
      JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
      WHERE p.id = target_project_id
        AND wm.user_id = public.studio_current_user_id()
        AND wm.role IN ('owner', 'admin', 'editor')
    )
  $function$;

  GRANT EXECUTE ON FUNCTION public.studio_is_project_member(uuid) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.studio_can_edit_project(uuid) TO authenticated;
  GRANT SELECT, INSERT, UPDATE ON public.scripts TO authenticated;

  DROP POLICY IF EXISTS studio_scripts_member_read ON public.scripts;
  CREATE POLICY studio_scripts_member_read ON public.scripts
    FOR SELECT TO authenticated
    USING (public.studio_is_project_member(project_id));

  DROP POLICY IF EXISTS studio_scripts_editor_create ON public.scripts;
  CREATE POLICY studio_scripts_editor_create ON public.scripts
    FOR INSERT TO authenticated
    WITH CHECK (created_by = public.studio_current_user_id() AND public.studio_can_edit_project(project_id));

  DROP POLICY IF EXISTS studio_scripts_editor_update ON public.scripts;
  CREATE POLICY studio_scripts_editor_update ON public.scripts
    FOR UPDATE TO authenticated
    USING (public.studio_can_edit_project(project_id))
    WITH CHECK (public.studio_can_edit_project(project_id));

  INSERT INTO public.schema_migrations(version)
  VALUES ('0003_scripts_workspace_rls')
  ON CONFLICT (version) DO NOTHING;
END
$migration$;
