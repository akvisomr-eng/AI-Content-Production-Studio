-- Run against a disposable/development database after migration 0002.
-- This test creates fixture rows inside a PL/pgSQL subtransaction and deliberately
-- rolls that subtransaction back after all assertions pass.
DO $test$
DECLARE
  workspace_id uuid;
  project_id uuid;
  visible_count integer;
  test_slug text := 'rls-test-' || gen_random_uuid()::text;
BEGIN
  BEGIN
    INSERT INTO public.workspaces(owner_user_id, name, slug)
    VALUES ('security-test-user-a', 'RLS temporary fixture', test_slug)
    RETURNING id INTO workspace_id;

    INSERT INTO public.workspace_members(workspace_id, user_id, role)
    VALUES
      (workspace_id, 'security-test-user-a', 'owner'),
      (workspace_id, 'security-test-user-b', 'viewer');

    INSERT INTO public.projects(workspace_id, owner_user_id, title)
    VALUES (workspace_id, 'security-test-user-a', 'RLS temporary project')
    RETURNING id INTO project_id;

    EXECUTE 'SET LOCAL ROLE authenticated';

    PERFORM set_config('app.user_id', 'security-test-user-a', true);
    SELECT count(*) INTO visible_count
    FROM public.projects WHERE id = project_id;
    IF visible_count <> 1 THEN
      RAISE EXCEPTION 'Workspace owner cannot read own project';
    END IF;

    PERFORM set_config('app.user_id', 'security-test-user-b', true);
    SELECT count(*) INTO visible_count
    FROM public.projects WHERE id = project_id;
    IF visible_count <> 1 THEN
      RAISE EXCEPTION 'Workspace viewer cannot read shared project';
    END IF;

    BEGIN
      INSERT INTO public.projects(workspace_id, owner_user_id, title)
      VALUES (workspace_id, 'security-test-user-b', 'Forbidden viewer project');
      RAISE EXCEPTION 'Viewer project insert was not blocked';
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;

    PERFORM set_config('app.user_id', 'security-test-outsider', true);
    SELECT count(*) INTO visible_count
    FROM public.projects WHERE id = project_id;
    IF visible_count <> 0 THEN
      RAISE EXCEPTION 'Cross-workspace project read was not blocked';
    END IF;

    SELECT count(*) INTO visible_count
    FROM public.workspaces WHERE id = workspace_id;
    IF visible_count <> 0 THEN
      RAISE EXCEPTION 'Cross-workspace read was not blocked';
    END IF;

    RAISE EXCEPTION 'ROLLBACK_RLS_TEST_FIXTURE';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_RLS_TEST_FIXTURE' THEN
      RAISE;
    END IF;
  END;
END
$test$;
