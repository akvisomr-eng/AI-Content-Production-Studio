-- Run after migration 0003 against a disposable/development database.
-- All fixture rows are rolled back after the assertions pass.
DO $test$
DECLARE
  workspace_id uuid;
  fixture_project_id uuid;
  owner_script_id uuid;
  editor_script_id uuid;
  visible_count integer;
  updated_count integer;
  test_slug text := 'scripts-rls-test-' || gen_random_uuid()::text;
BEGIN
  BEGIN
    INSERT INTO public.workspaces(owner_user_id, name, slug)
    VALUES ('script-test-owner', 'Scripts RLS fixture', test_slug)
    RETURNING id INTO workspace_id;

    INSERT INTO public.workspace_members(workspace_id, user_id, role)
    VALUES
      (workspace_id, 'script-test-owner', 'owner'),
      (workspace_id, 'script-test-editor', 'editor'),
      (workspace_id, 'script-test-viewer', 'viewer');

    INSERT INTO public.projects(workspace_id, owner_user_id, title)
    VALUES (workspace_id, 'script-test-owner', 'Scripts RLS project')
    RETURNING id INTO fixture_project_id;

    INSERT INTO public.scripts(project_id, created_by, title, body)
    VALUES (fixture_project_id, 'script-test-owner', 'Owner script', 'Draft body')
    RETURNING id INTO owner_script_id;

    EXECUTE 'SET LOCAL ROLE authenticated';

    PERFORM set_config('app.user_id', 'script-test-editor', true);
    INSERT INTO public.scripts(project_id, created_by, title, body)
    VALUES (fixture_project_id, 'script-test-editor', 'Editor script', 'Editor draft')
    RETURNING id INTO editor_script_id;

    UPDATE public.scripts SET body = 'Editor revised draft', version = version + 1
    WHERE id = editor_script_id;
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count <> 1 THEN
      RAISE EXCEPTION 'Editor could not update project script';
    END IF;

    PERFORM set_config('app.user_id', 'script-test-viewer', true);
    SELECT count(*) INTO visible_count FROM public.scripts WHERE id = owner_script_id;
    IF visible_count <> 1 THEN
      RAISE EXCEPTION 'Viewer could not read project script';
    END IF;

    BEGIN
      INSERT INTO public.scripts(project_id, created_by, title, body)
      VALUES (fixture_project_id, 'script-test-viewer', 'Forbidden viewer script', '');
      RAISE EXCEPTION 'Viewer script insert was not blocked';
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;

    PERFORM set_config('app.user_id', 'script-test-outsider', true);
    SELECT count(*) INTO visible_count
    FROM public.scripts s
    WHERE s.project_id = fixture_project_id;
    IF visible_count <> 0 THEN
      RAISE EXCEPTION 'Outsider could read project scripts';
    END IF;

    RAISE EXCEPTION 'ROLLBACK_SCRIPT_FIXTURE';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_SCRIPT_FIXTURE' THEN
      RAISE;
    END IF;
  END;
END
$test$;
