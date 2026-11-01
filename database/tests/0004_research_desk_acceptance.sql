-- Run after migration 0004; all temporary fixtures are rolled back.
DO $test$
DECLARE
  workspace_id uuid;
  fixture_project_id uuid;
  source_id uuid;
  report_id uuid;
  visible_count integer;
  test_slug text := 'research-rls-test-' || gen_random_uuid()::text;
BEGIN
  BEGIN
    INSERT INTO public.workspaces(owner_user_id, name, slug)
    VALUES ('research-test-owner', 'Research RLS fixture', test_slug)
    RETURNING id INTO workspace_id;

    INSERT INTO public.workspace_members(workspace_id, user_id, role)
    VALUES
      (workspace_id, 'research-test-owner', 'owner'),
      (workspace_id, 'research-test-editor', 'editor'),
      (workspace_id, 'research-test-viewer', 'viewer');

    INSERT INTO public.projects(workspace_id, owner_user_id, title)
    VALUES (workspace_id, 'research-test-owner', 'Research RLS project')
    RETURNING id INTO fixture_project_id;

    INSERT INTO public.research_sources(project_id, created_by, title, url, source_type, license_status)
    VALUES (fixture_project_id, 'research-test-owner', 'Public source', 'https://example.org/source', 'url', 'unknown')
    RETURNING id INTO source_id;

    INSERT INTO public.research_reports(project_id, created_by, topic, audience, report)
    VALUES (fixture_project_id, 'research-test-owner', 'Research topic', 'General audience', '{"summary":"Initial summary"}')
    RETURNING id INTO report_id;

    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('app.user_id', 'research-test-editor', true);

    INSERT INTO public.research_sources(project_id, created_by, title, source_type, license_status)
    VALUES (fixture_project_id, 'research-test-editor', 'Editor source', 'manual', 'cc0');

    INSERT INTO public.research_reports(project_id, created_by, topic, report)
    VALUES (fixture_project_id, 'research-test-editor', 'Editor report', '{"summary":"Editor summary"}');

    PERFORM set_config('app.user_id', 'research-test-viewer', true);
    SELECT count(*) INTO visible_count FROM public.research_sources WHERE id = source_id;
    IF visible_count <> 1 THEN
      RAISE EXCEPTION 'Viewer could not read research source';
    END IF;
    SELECT count(*) INTO visible_count FROM public.research_reports WHERE id = report_id;
    IF visible_count <> 1 THEN
      RAISE EXCEPTION 'Viewer could not read research report';
    END IF;

    BEGIN
      INSERT INTO public.research_sources(project_id, created_by, title)
      VALUES (fixture_project_id, 'research-test-viewer', 'Forbidden viewer source');
      RAISE EXCEPTION 'Viewer research source insert was not blocked';
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;

    PERFORM set_config('app.user_id', 'research-test-outsider', true);
    SELECT count(*) INTO visible_count FROM public.research_sources WHERE project_id = fixture_project_id;
    IF visible_count <> 0 THEN
      RAISE EXCEPTION 'Outsider could read research sources';
    END IF;
    SELECT count(*) INTO visible_count FROM public.research_reports WHERE id = report_id;
    IF visible_count <> 0 THEN
      RAISE EXCEPTION 'Outsider could read research reports';
    END IF;

    RAISE EXCEPTION 'ROLLBACK_RESEARCH_FIXTURE';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_RESEARCH_FIXTURE' THEN
      RAISE;
    END IF;
  END;
END
$test$;
