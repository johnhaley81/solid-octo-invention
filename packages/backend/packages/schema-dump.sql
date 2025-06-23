--
-- PostgreSQL database dump
--


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: app_private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA app_private;


--
-- Name: app_public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA app_public;


--
-- Name: graphile_migrate; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphile_migrate;


--
-- Name: graphile_worker; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphile_worker;


--
-- Name: postgraphile_watch; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA postgraphile_watch;


--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA app_public;


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA app_public;


--
-- Name: auth_method; Type: TYPE; Schema: app_public; Owner: -
--

CREATE TYPE app_public.auth_method AS ENUM (
    'password',
    'webauthn'
);


--
-- Name: otp_token_type; Type: TYPE; Schema: app_public; Owner: -
--

CREATE TYPE app_public.otp_token_type AS ENUM (
    'email_verification',
    'login_otp',
    'password_reset'
);


--
-- Name: job_spec; Type: TYPE; Schema: graphile_worker; Owner: -
--

CREATE TYPE graphile_worker.job_spec AS (
	identifier text,
	payload json,
	queue_name text,
	run_at timestamp with time zone,
	max_attempts smallint,
	job_key text,
	priority smallint,
	flags text[]
);


--
-- Name: cleanup_expired_tokens(); Type: FUNCTION; Schema: app_public; Owner: -
--

CREATE FUNCTION app_public.cleanup_expired_tokens() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  deleted_count INTEGER;
  temp_count INTEGER;
BEGIN
  DELETE FROM app_private.otp_tokens 
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  DELETE FROM app_private.sessions 
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  RETURN deleted_count;
END;
$$;


--
-- Name: enforce_auth_method_exclusivity(); Type: FUNCTION; Schema: app_public; Owner: -
--

CREATE FUNCTION app_public.enforce_auth_method_exclusivity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Check if user already has a different auth method
  IF EXISTS (
    SELECT 1 FROM app_private.user_authentication_methods 
    WHERE user_id = NEW.user_id AND method != NEW.method
  ) THEN
    RAISE EXCEPTION 'User can only have one authentication method';
  END IF;
  
  -- Update user's auth_method
  UPDATE app_public.users 
  SET auth_method = NEW.method 
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$;


--
-- Name: prevent_hard_delete(); Type: FUNCTION; Schema: app_public; Owner: -
--

CREATE FUNCTION app_public.prevent_hard_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Instead of deleting, set deleted_at timestamp
  UPDATE app_public.users 
  SET deleted_at = NOW() 
  WHERE id = OLD.id AND deleted_at IS NULL;
  
  -- Prevent the actual DELETE
  RETURN NULL;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: users; Type: TABLE; Schema: app_public; Owner: -
--

CREATE TABLE app_public.users (
    id uuid DEFAULT app_public.uuid_generate_v4() NOT NULL,
    email app_public.citext NOT NULL,
    name text NOT NULL,
    avatar_url text,
    auth_method app_public.auth_method DEFAULT 'password'::app_public.auth_method NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: register_user(app_public.citext, text, app_public.auth_method); Type: FUNCTION; Schema: app_public; Owner: -
--

CREATE FUNCTION app_public.register_user(email app_public.citext, name text, auth_method app_public.auth_method DEFAULT 'password'::app_public.auth_method) RETURNS app_public.users
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  new_user app_public.users;
BEGIN
  -- Insert new user
  INSERT INTO app_public.users (email, name, auth_method)
  VALUES (email, name, auth_method)
  RETURNING * INTO new_user;
  
  -- Create primary email record
  INSERT INTO app_private.user_emails (user_id, email, is_primary, is_verified)
  VALUES (new_user.id, email, TRUE, FALSE);
  
  RETURN new_user;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: app_public; Owner: -
--

CREATE FUNCTION app_public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: _private_jobs; Type: TABLE; Schema: graphile_worker; Owner: -
--

CREATE TABLE graphile_worker._private_jobs (
    id bigint NOT NULL,
    job_queue_id integer,
    task_id integer NOT NULL,
    payload json DEFAULT '{}'::json NOT NULL,
    priority smallint DEFAULT 0 NOT NULL,
    run_at timestamp with time zone DEFAULT now() NOT NULL,
    attempts smallint DEFAULT 0 NOT NULL,
    max_attempts smallint DEFAULT 25 NOT NULL,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    key text,
    locked_at timestamp with time zone,
    locked_by text,
    revision integer DEFAULT 0 NOT NULL,
    flags jsonb,
    is_available boolean GENERATED ALWAYS AS (((locked_at IS NULL) AND (attempts < max_attempts))) STORED NOT NULL,
    CONSTRAINT jobs_key_check CHECK (((length(key) > 0) AND (length(key) <= 512))),
    CONSTRAINT jobs_max_attempts_check CHECK ((max_attempts >= 1))
);


--
-- Name: add_job(text, json, text, timestamp with time zone, integer, text, integer, text[], text); Type: FUNCTION; Schema: graphile_worker; Owner: -
--

CREATE FUNCTION graphile_worker.add_job(identifier text, payload json DEFAULT NULL::json, queue_name text DEFAULT NULL::text, run_at timestamp with time zone DEFAULT NULL::timestamp with time zone, max_attempts integer DEFAULT NULL::integer, job_key text DEFAULT NULL::text, priority integer DEFAULT NULL::integer, flags text[] DEFAULT NULL::text[], job_key_mode text DEFAULT 'replace'::text) RETURNS graphile_worker._private_jobs
    LANGUAGE plpgsql
    AS $$
declare
  v_job "graphile_worker"._private_jobs;
begin
  if (job_key is null or job_key_mode is null or job_key_mode in ('replace', 'preserve_run_at')) then
    select * into v_job
    from "graphile_worker".add_jobs(
      ARRAY[(
        identifier,
        payload,
        queue_name,
        run_at,
        max_attempts::smallint,
        job_key,
        priority::smallint,
        flags
      )::"graphile_worker".job_spec],
      (job_key_mode = 'preserve_run_at')
    )
    limit 1;
    return v_job;
  elsif job_key_mode = 'unsafe_dedupe' then
    -- Ensure all the tasks exist
    insert into "graphile_worker"._private_tasks as tasks (identifier)
    values (add_job.identifier)
    on conflict do nothing;
    -- Ensure all the queues exist
    if add_job.queue_name is not null then
      insert into "graphile_worker"._private_job_queues as job_queues (queue_name)
      values (add_job.queue_name)
      on conflict do nothing;
    end if;
    -- Insert job, but if one already exists then do nothing, even if the
    -- existing job has already started (and thus represents an out-of-date
    -- world state). This is dangerous because it means that whatever state
    -- change triggered this add_job may not be acted upon (since it happened
    -- after the existing job started executing, but no further job is being
    -- scheduled), but it is useful in very rare circumstances for
    -- de-duplication. If in doubt, DO NOT USE THIS.
    insert into "graphile_worker"._private_jobs as jobs (
      job_queue_id,
      task_id,
      payload,
      run_at,
      max_attempts,
      key,
      priority,
      flags
    )
      select
        job_queues.id,
        tasks.id,
        coalesce(add_job.payload, '{}'::json),
        coalesce(add_job.run_at, now()),
        coalesce(add_job.max_attempts::smallint, 25::smallint),
        add_job.job_key,
        coalesce(add_job.priority::smallint, 0::smallint),
        (
          select jsonb_object_agg(flag, true)
          from unnest(add_job.flags) as item(flag)
        )
      from "graphile_worker"._private_tasks as tasks
      left join "graphile_worker"._private_job_queues as job_queues
      on job_queues.queue_name = add_job.queue_name
      where tasks.identifier = add_job.identifier
    on conflict (key)
      -- Bump the updated_at so that there's something to return
      do update set
        revision = jobs.revision + 1,
        updated_at = now()
      returning *
      into v_job;
    if v_job.revision = 0 then
      perform pg_notify('jobs:insert', '{"r":' || random()::text || ',"count":1}');
    end if;
    return v_job;
  else
    raise exception 'Invalid job_key_mode value, expected ''replace'', ''preserve_run_at'' or ''unsafe_dedupe''.' using errcode = 'GWBKM';
  end if;
end;
$$;


--
-- Name: add_jobs(graphile_worker.job_spec[], boolean); Type: FUNCTION; Schema: graphile_worker; Owner: -
--

CREATE FUNCTION graphile_worker.add_jobs(specs graphile_worker.job_spec[], job_key_preserve_run_at boolean DEFAULT false) RETURNS SETOF graphile_worker._private_jobs
    LANGUAGE plpgsql
    AS $$
begin
  -- Ensure all the tasks exist
  insert into "graphile_worker"._private_tasks as tasks (identifier)
  select distinct spec.identifier
  from unnest(specs) spec
  on conflict do nothing;
  -- Ensure all the queues exist
  insert into "graphile_worker"._private_job_queues as job_queues (queue_name)
  select distinct spec.queue_name
  from unnest(specs) spec
  where spec.queue_name is not null
  on conflict do nothing;
  -- Ensure any locked jobs have their key cleared - in the case of locked
  -- existing job create a new job instead as it must have already started
  -- executing (i.e. it's world state is out of date, and the fact add_job
  -- has been called again implies there's new information that needs to be
  -- acted upon).
  update "graphile_worker"._private_jobs as jobs
  set
    key = null,
    attempts = jobs.max_attempts,
    updated_at = now()
  from unnest(specs) spec
  where spec.job_key is not null
  and jobs.key = spec.job_key
  and is_available is not true;

  -- WARNING: this count is not 100% accurate; 'on conflict' clause will cause it to be an overestimate
  perform pg_notify('jobs:insert', '{"r":' || random()::text || ',"count":' || array_length(specs, 1)::text || '}');

  -- TODO: is there a risk that a conflict could occur depending on the
  -- isolation level?
  return query insert into "graphile_worker"._private_jobs as jobs (
    job_queue_id,
    task_id,
    payload,
    run_at,
    max_attempts,
    key,
    priority,
    flags
  )
    select
      job_queues.id,
      tasks.id,
      coalesce(spec.payload, '{}'::json),
      coalesce(spec.run_at, now()),
      coalesce(spec.max_attempts, 25),
      spec.job_key,
      coalesce(spec.priority, 0),
      (
        select jsonb_object_agg(flag, true)
        from unnest(spec.flags) as item(flag)
      )
    from unnest(specs) spec
    inner join "graphile_worker"._private_tasks as tasks
    on tasks.identifier = spec.identifier
    left join "graphile_worker"._private_job_queues as job_queues
    on job_queues.queue_name = spec.queue_name
  on conflict (key) do update set
    job_queue_id = excluded.job_queue_id,
    task_id = excluded.task_id,
    payload =
      case
      when json_typeof(jobs.payload) = 'array' and json_typeof(excluded.payload) = 'array' then
        (jobs.payload::jsonb || excluded.payload::jsonb)::json
      else
        excluded.payload
      end,
    max_attempts = excluded.max_attempts,
    run_at = (case
      when job_key_preserve_run_at is true and jobs.attempts = 0 then jobs.run_at
      else excluded.run_at
    end),
    priority = excluded.priority,
    revision = jobs.revision + 1,
    flags = excluded.flags,
    -- always reset error/retry state
    attempts = 0,
    last_error = null,
    updated_at = now()
  where jobs.locked_at is null
  returning *;
end;
$$;


--
-- Name: complete_jobs(bigint[]); Type: FUNCTION; Schema: graphile_worker; Owner: -
--

CREATE FUNCTION graphile_worker.complete_jobs(job_ids bigint[]) RETURNS SETOF graphile_worker._private_jobs
    LANGUAGE sql
    AS $$
  delete from "graphile_worker"._private_jobs as jobs
    where id = any(job_ids)
    and (
      locked_at is null
    or
      locked_at < now() - interval '4 hours'
    )
    returning *;
$$;


--
-- Name: force_unlock_workers(text[]); Type: FUNCTION; Schema: graphile_worker; Owner: -
--

CREATE FUNCTION graphile_worker.force_unlock_workers(worker_ids text[]) RETURNS void
    LANGUAGE sql
    AS $$
update "graphile_worker"._private_jobs as jobs
set locked_at = null, locked_by = null
where locked_by = any(worker_ids);
update "graphile_worker"._private_job_queues as job_queues
set locked_at = null, locked_by = null
where locked_by = any(worker_ids);
$$;


--
-- Name: permanently_fail_jobs(bigint[], text); Type: FUNCTION; Schema: graphile_worker; Owner: -
--

CREATE FUNCTION graphile_worker.permanently_fail_jobs(job_ids bigint[], error_message text DEFAULT NULL::text) RETURNS SETOF graphile_worker._private_jobs
    LANGUAGE sql
    AS $$
  update "graphile_worker"._private_jobs as jobs
    set
      last_error = coalesce(error_message, 'Manually marked as failed'),
      attempts = max_attempts,
      updated_at = now()
    where id = any(job_ids)
    and (
      locked_at is null
    or
      locked_at < NOW() - interval '4 hours'
    )
    returning *;
$$;


--
-- Name: remove_job(text); Type: FUNCTION; Schema: graphile_worker; Owner: -
--

CREATE FUNCTION graphile_worker.remove_job(job_key text) RETURNS graphile_worker._private_jobs
    LANGUAGE plpgsql STRICT
    AS $$
declare
  v_job "graphile_worker"._private_jobs;
begin
  -- Delete job if not locked
  delete from "graphile_worker"._private_jobs as jobs
    where key = job_key
    and (
      locked_at is null
    or
      locked_at < NOW() - interval '4 hours'
    )
  returning * into v_job;
  if not (v_job is null) then
    perform pg_notify('jobs:insert', '{"r":' || random()::text || ',"count":-1}');
    return v_job;
  end if;
  -- Otherwise prevent job from retrying, and clear the key
  update "graphile_worker"._private_jobs as jobs
  set
    key = null,
    attempts = jobs.max_attempts,
    updated_at = now()
  where key = job_key
  returning * into v_job;
  return v_job;
end;
$$;


--
-- Name: reschedule_jobs(bigint[], timestamp with time zone, integer, integer, integer); Type: FUNCTION; Schema: graphile_worker; Owner: -
--

CREATE FUNCTION graphile_worker.reschedule_jobs(job_ids bigint[], run_at timestamp with time zone DEFAULT NULL::timestamp with time zone, priority integer DEFAULT NULL::integer, attempts integer DEFAULT NULL::integer, max_attempts integer DEFAULT NULL::integer) RETURNS SETOF graphile_worker._private_jobs
    LANGUAGE sql
    AS $$
  update "graphile_worker"._private_jobs as jobs
    set
      run_at = coalesce(reschedule_jobs.run_at, jobs.run_at),
      priority = coalesce(reschedule_jobs.priority::smallint, jobs.priority),
      attempts = coalesce(reschedule_jobs.attempts::smallint, jobs.attempts),
      max_attempts = coalesce(reschedule_jobs.max_attempts::smallint, jobs.max_attempts),
      updated_at = now()
    where id = any(job_ids)
    and (
      locked_at is null
    or
      locked_at < NOW() - interval '4 hours'
    )
    returning *;
$$;


--
-- Name: notify_watchers_ddl(); Type: FUNCTION; Schema: postgraphile_watch; Owner: -
--

CREATE FUNCTION postgraphile_watch.notify_watchers_ddl() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
begin
  perform pg_notify(
    'postgraphile_watch',
    json_build_object(
      'type',
      'ddl',
      'payload',
      (select json_agg(json_build_object('schema', schema_name, 'command', command_tag)) from pg_event_trigger_ddl_commands() as x)
    )::text
  );
end;
$$;


--
-- Name: notify_watchers_drop(); Type: FUNCTION; Schema: postgraphile_watch; Owner: -
--

CREATE FUNCTION postgraphile_watch.notify_watchers_drop() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
begin
  perform pg_notify(
    'postgraphile_watch',
    json_build_object(
      'type',
      'drop',
      'payload',
      (select json_agg(distinct x.schema_name) from pg_event_trigger_dropped_objects() as x)
    )::text
  );
end;
$$;


--
-- Name: otp_tokens; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE app_private.otp_tokens (
    id uuid DEFAULT app_public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    email app_public.citext NOT NULL,
    token_hash text NOT NULL,
    token_type app_public.otp_token_type NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sessions; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE app_private.sessions (
    id uuid DEFAULT app_public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    session_token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_authentication_methods; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE app_private.user_authentication_methods (
    id uuid DEFAULT app_public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    method app_public.auth_method NOT NULL,
    password_hash text,
    webauthn_credential_id text,
    webauthn_public_key text,
    webauthn_counter bigint DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT password_hash_only_for_password CHECK ((((method = 'password'::app_public.auth_method) AND (password_hash IS NOT NULL)) OR ((method <> 'password'::app_public.auth_method) AND (password_hash IS NULL)))),
    CONSTRAINT webauthn_fields_only_for_webauthn CHECK ((((method = 'webauthn'::app_public.auth_method) AND (webauthn_credential_id IS NOT NULL) AND (webauthn_public_key IS NOT NULL)) OR ((method <> 'webauthn'::app_public.auth_method) AND (webauthn_credential_id IS NULL) AND (webauthn_public_key IS NULL) AND (webauthn_counter = 0))))
);


--
-- Name: user_emails; Type: TABLE; Schema: app_private; Owner: -
--

CREATE TABLE app_private.user_emails (
    id uuid DEFAULT app_public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    email app_public.citext NOT NULL,
    is_verified boolean DEFAULT false NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: current; Type: TABLE; Schema: graphile_migrate; Owner: -
--

CREATE TABLE graphile_migrate.current (
    filename text DEFAULT 'current.sql'::text NOT NULL,
    content text NOT NULL,
    date timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: graphile_migrate; Owner: -
--

CREATE TABLE graphile_migrate.migrations (
    hash text NOT NULL,
    previous_hash text,
    filename text NOT NULL,
    date timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: _private_job_queues; Type: TABLE; Schema: graphile_worker; Owner: -
--

CREATE TABLE graphile_worker._private_job_queues (
    id integer NOT NULL,
    queue_name text NOT NULL,
    locked_at timestamp with time zone,
    locked_by text,
    is_available boolean GENERATED ALWAYS AS ((locked_at IS NULL)) STORED NOT NULL,
    CONSTRAINT job_queues_queue_name_check CHECK ((length(queue_name) <= 128))
);


--
-- Name: _private_known_crontabs; Type: TABLE; Schema: graphile_worker; Owner: -
--

CREATE TABLE graphile_worker._private_known_crontabs (
    identifier text NOT NULL,
    known_since timestamp with time zone NOT NULL,
    last_execution timestamp with time zone
);


--
-- Name: _private_tasks; Type: TABLE; Schema: graphile_worker; Owner: -
--

CREATE TABLE graphile_worker._private_tasks (
    id integer NOT NULL,
    identifier text NOT NULL,
    CONSTRAINT tasks_identifier_check CHECK ((length(identifier) <= 128))
);


--
-- Name: job_queues_id_seq; Type: SEQUENCE; Schema: graphile_worker; Owner: -
--

ALTER TABLE graphile_worker._private_job_queues ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME graphile_worker.job_queues_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: jobs; Type: VIEW; Schema: graphile_worker; Owner: -
--

CREATE VIEW graphile_worker.jobs AS
 SELECT jobs.id,
    job_queues.queue_name,
    tasks.identifier AS task_identifier,
    jobs.priority,
    jobs.run_at,
    jobs.attempts,
    jobs.max_attempts,
    jobs.last_error,
    jobs.created_at,
    jobs.updated_at,
    jobs.key,
    jobs.locked_at,
    jobs.locked_by,
    jobs.revision,
    jobs.flags
   FROM ((graphile_worker._private_jobs jobs
     JOIN graphile_worker._private_tasks tasks ON ((tasks.id = jobs.task_id)))
     LEFT JOIN graphile_worker._private_job_queues job_queues ON ((job_queues.id = jobs.job_queue_id)));


--
-- Name: jobs_id_seq1; Type: SEQUENCE; Schema: graphile_worker; Owner: -
--

ALTER TABLE graphile_worker._private_jobs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME graphile_worker.jobs_id_seq1
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: migrations; Type: TABLE; Schema: graphile_worker; Owner: -
--

CREATE TABLE graphile_worker.migrations (
    id integer NOT NULL,
    ts timestamp with time zone DEFAULT now() NOT NULL,
    breaking boolean DEFAULT false NOT NULL
);


--
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: graphile_worker; Owner: -
--

ALTER TABLE graphile_worker._private_tasks ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME graphile_worker.tasks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: otp_tokens otp_tokens_email_token_type_token_hash_key; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY app_private.otp_tokens
    ADD CONSTRAINT otp_tokens_email_token_type_token_hash_key UNIQUE (email, token_type, token_hash);


--
-- Name: otp_tokens otp_tokens_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY app_private.otp_tokens
    ADD CONSTRAINT otp_tokens_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY app_private.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_session_token_key; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY app_private.sessions
    ADD CONSTRAINT sessions_session_token_key UNIQUE (session_token);


--
-- Name: user_authentication_methods user_authentication_methods_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY app_private.user_authentication_methods
    ADD CONSTRAINT user_authentication_methods_pkey PRIMARY KEY (id);


--
-- Name: user_authentication_methods user_authentication_methods_user_id_method_key; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY app_private.user_authentication_methods
    ADD CONSTRAINT user_authentication_methods_user_id_method_key UNIQUE (user_id, method);


--
-- Name: user_emails user_emails_pkey; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY app_private.user_emails
    ADD CONSTRAINT user_emails_pkey PRIMARY KEY (id);


--
-- Name: user_emails user_emails_user_id_is_primary_key; Type: CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY app_private.user_emails
    ADD CONSTRAINT user_emails_user_id_is_primary_key UNIQUE (user_id, is_primary) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: app_public; Owner: -
--

ALTER TABLE ONLY app_public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: app_public; Owner: -
--

ALTER TABLE ONLY app_public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: current current_pkey; Type: CONSTRAINT; Schema: graphile_migrate; Owner: -
--

ALTER TABLE ONLY graphile_migrate.current
    ADD CONSTRAINT current_pkey PRIMARY KEY (filename);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: graphile_migrate; Owner: -
--

ALTER TABLE ONLY graphile_migrate.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (hash);


--
-- Name: _private_job_queues job_queues_pkey1; Type: CONSTRAINT; Schema: graphile_worker; Owner: -
--

ALTER TABLE ONLY graphile_worker._private_job_queues
    ADD CONSTRAINT job_queues_pkey1 PRIMARY KEY (id);


--
-- Name: _private_job_queues job_queues_queue_name_key; Type: CONSTRAINT; Schema: graphile_worker; Owner: -
--

ALTER TABLE ONLY graphile_worker._private_job_queues
    ADD CONSTRAINT job_queues_queue_name_key UNIQUE (queue_name);


--
-- Name: _private_jobs jobs_key_key1; Type: CONSTRAINT; Schema: graphile_worker; Owner: -
--

ALTER TABLE ONLY graphile_worker._private_jobs
    ADD CONSTRAINT jobs_key_key1 UNIQUE (key);


--
-- Name: _private_jobs jobs_pkey1; Type: CONSTRAINT; Schema: graphile_worker; Owner: -
--

ALTER TABLE ONLY graphile_worker._private_jobs
    ADD CONSTRAINT jobs_pkey1 PRIMARY KEY (id);


--
-- Name: _private_known_crontabs known_crontabs_pkey; Type: CONSTRAINT; Schema: graphile_worker; Owner: -
--

ALTER TABLE ONLY graphile_worker._private_known_crontabs
    ADD CONSTRAINT known_crontabs_pkey PRIMARY KEY (identifier);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: graphile_worker; Owner: -
--

ALTER TABLE ONLY graphile_worker.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: _private_tasks tasks_identifier_key; Type: CONSTRAINT; Schema: graphile_worker; Owner: -
--

ALTER TABLE ONLY graphile_worker._private_tasks
    ADD CONSTRAINT tasks_identifier_key UNIQUE (identifier);


--
-- Name: _private_tasks tasks_pkey; Type: CONSTRAINT; Schema: graphile_worker; Owner: -
--

ALTER TABLE ONLY graphile_worker._private_tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: otp_tokens_email_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX otp_tokens_email_idx ON app_private.otp_tokens USING btree (email);


--
-- Name: otp_tokens_expires_at_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX otp_tokens_expires_at_idx ON app_private.otp_tokens USING btree (expires_at);


--
-- Name: otp_tokens_type_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX otp_tokens_type_idx ON app_private.otp_tokens USING btree (token_type);


--
-- Name: otp_tokens_user_id_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX otp_tokens_user_id_idx ON app_private.otp_tokens USING btree (user_id);


--
-- Name: sessions_expires_at_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX sessions_expires_at_idx ON app_private.sessions USING btree (expires_at);


--
-- Name: sessions_token_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX sessions_token_idx ON app_private.sessions USING btree (session_token);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX sessions_user_id_idx ON app_private.sessions USING btree (user_id);


--
-- Name: user_authentication_methods_method_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX user_authentication_methods_method_idx ON app_private.user_authentication_methods USING btree (method);


--
-- Name: user_authentication_methods_user_id_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX user_authentication_methods_user_id_idx ON app_private.user_authentication_methods USING btree (user_id);


--
-- Name: user_emails_email_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX user_emails_email_idx ON app_private.user_emails USING btree (email);


--
-- Name: user_emails_is_primary_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX user_emails_is_primary_idx ON app_private.user_emails USING btree (is_primary) WHERE (is_primary = true);


--
-- Name: user_emails_user_id_idx; Type: INDEX; Schema: app_private; Owner: -
--

CREATE INDEX user_emails_user_id_idx ON app_private.user_emails USING btree (user_id);


--
-- Name: users_active_idx; Type: INDEX; Schema: app_public; Owner: -
--

CREATE INDEX users_active_idx ON app_public.users USING btree (id) WHERE (deleted_at IS NULL);


--
-- Name: users_auth_method_idx; Type: INDEX; Schema: app_public; Owner: -
--

CREATE INDEX users_auth_method_idx ON app_public.users USING btree (auth_method);


--
-- Name: users_created_at_idx; Type: INDEX; Schema: app_public; Owner: -
--

CREATE INDEX users_created_at_idx ON app_public.users USING btree (created_at);


--
-- Name: users_email_idx; Type: INDEX; Schema: app_public; Owner: -
--

CREATE INDEX users_email_idx ON app_public.users USING btree (email);


--
-- Name: jobs_main_index; Type: INDEX; Schema: graphile_worker; Owner: -
--

CREATE INDEX jobs_main_index ON graphile_worker._private_jobs USING btree (priority, run_at) INCLUDE (id, task_id, job_queue_id) WHERE (is_available = true);


--
-- Name: jobs_no_queue_index; Type: INDEX; Schema: graphile_worker; Owner: -
--

CREATE INDEX jobs_no_queue_index ON graphile_worker._private_jobs USING btree (priority, run_at) INCLUDE (id, task_id) WHERE ((is_available = true) AND (job_queue_id IS NULL));


--
-- Name: user_authentication_methods enforce_auth_method_exclusivity_trigger; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER enforce_auth_method_exclusivity_trigger BEFORE INSERT OR UPDATE ON app_private.user_authentication_methods FOR EACH ROW EXECUTE FUNCTION app_public.enforce_auth_method_exclusivity();


--
-- Name: sessions update_sessions_updated_at; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON app_private.sessions FOR EACH ROW EXECUTE FUNCTION app_public.update_updated_at_column();


--
-- Name: user_authentication_methods update_user_authentication_methods_updated_at; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER update_user_authentication_methods_updated_at BEFORE UPDATE ON app_private.user_authentication_methods FOR EACH ROW EXECUTE FUNCTION app_public.update_updated_at_column();


--
-- Name: user_emails update_user_emails_updated_at; Type: TRIGGER; Schema: app_private; Owner: -
--

CREATE TRIGGER update_user_emails_updated_at BEFORE UPDATE ON app_private.user_emails FOR EACH ROW EXECUTE FUNCTION app_public.update_updated_at_column();


--
-- Name: users prevent_users_hard_delete; Type: TRIGGER; Schema: app_public; Owner: -
--

CREATE TRIGGER prevent_users_hard_delete BEFORE DELETE ON app_public.users FOR EACH ROW EXECUTE FUNCTION app_public.prevent_hard_delete();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: app_public; Owner: -
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON app_public.users FOR EACH ROW EXECUTE FUNCTION app_public.update_updated_at_column();


--
-- Name: otp_tokens otp_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY app_private.otp_tokens
    ADD CONSTRAINT otp_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_public.users(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY app_private.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_public.users(id) ON DELETE CASCADE;


--
-- Name: user_authentication_methods user_authentication_methods_user_id_fkey; Type: FK CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY app_private.user_authentication_methods
    ADD CONSTRAINT user_authentication_methods_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_public.users(id) ON DELETE CASCADE;


--
-- Name: user_emails user_emails_user_id_fkey; Type: FK CONSTRAINT; Schema: app_private; Owner: -
--

ALTER TABLE ONLY app_private.user_emails
    ADD CONSTRAINT user_emails_user_id_fkey FOREIGN KEY (user_id) REFERENCES app_public.users(id) ON DELETE CASCADE;


--
-- Name: migrations migrations_previous_hash_fkey; Type: FK CONSTRAINT; Schema: graphile_migrate; Owner: -
--

ALTER TABLE ONLY graphile_migrate.migrations
    ADD CONSTRAINT migrations_previous_hash_fkey FOREIGN KEY (previous_hash) REFERENCES graphile_migrate.migrations(hash);


--
-- Name: users; Type: ROW SECURITY; Schema: app_public; Owner: -
--

ALTER TABLE app_public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: users users_admin_select_policy; Type: POLICY; Schema: app_public; Owner: -
--

CREATE POLICY users_admin_select_policy ON app_public.users FOR SELECT USING (((deleted_at IS NULL) OR (current_setting('app.user_role'::text, true) = 'admin'::text)));


--
-- Name: users users_select_policy; Type: POLICY; Schema: app_public; Owner: -
--

CREATE POLICY users_select_policy ON app_public.users FOR SELECT USING ((deleted_at IS NULL));


--
-- Name: _private_job_queues; Type: ROW SECURITY; Schema: graphile_worker; Owner: -
--

ALTER TABLE graphile_worker._private_job_queues ENABLE ROW LEVEL SECURITY;

--
-- Name: _private_jobs; Type: ROW SECURITY; Schema: graphile_worker; Owner: -
--

ALTER TABLE graphile_worker._private_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: _private_known_crontabs; Type: ROW SECURITY; Schema: graphile_worker; Owner: -
--

ALTER TABLE graphile_worker._private_known_crontabs ENABLE ROW LEVEL SECURITY;

--
-- Name: _private_tasks; Type: ROW SECURITY; Schema: graphile_worker; Owner: -
--

ALTER TABLE graphile_worker._private_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: postgraphile_watch_ddl; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER postgraphile_watch_ddl ON ddl_command_end
         WHEN TAG IN ('ALTER AGGREGATE', 'ALTER DOMAIN', 'ALTER EXTENSION', 'ALTER FOREIGN TABLE', 'ALTER FUNCTION', 'ALTER POLICY', 'ALTER SCHEMA', 'ALTER TABLE', 'ALTER TYPE', 'ALTER VIEW', 'COMMENT', 'CREATE AGGREGATE', 'CREATE DOMAIN', 'CREATE EXTENSION', 'CREATE FOREIGN TABLE', 'CREATE FUNCTION', 'CREATE INDEX', 'CREATE POLICY', 'CREATE RULE', 'CREATE SCHEMA', 'CREATE TABLE', 'CREATE TABLE AS', 'CREATE VIEW', 'DROP AGGREGATE', 'DROP DOMAIN', 'DROP EXTENSION', 'DROP FOREIGN TABLE', 'DROP FUNCTION', 'DROP INDEX', 'DROP OWNED', 'DROP POLICY', 'DROP RULE', 'DROP SCHEMA', 'DROP TABLE', 'DROP TYPE', 'DROP VIEW', 'GRANT', 'REVOKE', 'SELECT INTO')
   EXECUTE FUNCTION postgraphile_watch.notify_watchers_ddl();


--
-- Name: postgraphile_watch_drop; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER postgraphile_watch_drop ON sql_drop
   EXECUTE FUNCTION postgraphile_watch.notify_watchers_drop();


--
-- PostgreSQL database dump complete
--
