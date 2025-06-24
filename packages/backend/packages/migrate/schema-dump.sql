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
-- Name: cleanup_expired_tokens(); Type: FUNCTION; Schema: app_public; Owner: -
--

CREATE FUNCTION app_public.cleanup_expired_tokens() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  deleted_count INTEGER;
  sessions_deleted INTEGER;
BEGIN
  DELETE FROM app_private.otp_tokens
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  DELETE FROM app_private.sessions
  WHERE expires_at < NOW();

  GET DIAGNOSTICS sessions_deleted = ROW_COUNT;

  RETURN deleted_count + sessions_deleted;
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
-- Name: current_user_from_session(text); Type: FUNCTION; Schema: app_public; Owner: -
--

CREATE FUNCTION app_public.current_user_from_session(session_token text DEFAULT NULL::text) RETURNS app_public.users
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  user_record app_public.users;
  session_record app_private.sessions;
  token TEXT;
BEGIN
  -- Use provided token or get from settings
  token := COALESCE(session_token, current_setting('app.session_token', true));

  IF token IS NULL THEN
    RETURN NULL;
  END IF;

  -- Find valid session
  SELECT * INTO session_record
  FROM app_private.sessions s
  WHERE s.session_token = token
    AND s.expires_at > NOW();

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Get user
  SELECT * INTO user_record
  FROM app_public.users u
  WHERE u.id = session_record.user_id
    AND u.deleted_at IS NULL;

  RETURN user_record;
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
-- Name: generate_webauthn_authentication_challenge(app_public.citext); Type: FUNCTION; Schema: app_public; Owner: -
--

CREATE FUNCTION app_public.generate_webauthn_authentication_challenge(user_email app_public.citext) RETURNS TABLE(challenge text, credential_ids text[])
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  user_record app_public.users;
  challenge_bytes BYTEA;
  cred_ids TEXT[];
BEGIN
  -- Find user by email
  SELECT * INTO user_record
  FROM app_public.users u
  WHERE u.email = user_email
    AND u.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Get user's WebAuthn credentials
  SELECT ARRAY_AGG(webauthn_credential_id) INTO cred_ids
  FROM app_private.user_authentication_methods uam
  WHERE uam.user_id = user_record.id
    AND uam.method = 'webauthn'
    AND uam.webauthn_credential_id IS NOT NULL;

  IF cred_ids IS NULL OR array_length(cred_ids, 1) = 0 THEN
    RAISE EXCEPTION 'No WebAuthn credentials found for user';
  END IF;

  -- Generate random 32-byte challenge
  challenge_bytes := app_public.gen_random_bytes(32);

  -- Return challenge and credential IDs
  RETURN QUERY SELECT 
    encode(challenge_bytes, 'base64') AS challenge,
    cred_ids AS credential_ids;
END;
$$;


--
-- Name: generate_webauthn_registration_challenge(app_public.citext); Type: FUNCTION; Schema: app_public; Owner: -
--

CREATE FUNCTION app_public.generate_webauthn_registration_challenge(user_email app_public.citext) RETURNS TABLE(challenge text, user_id uuid, user_name text, user_display_name text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  user_record app_public.users;
  challenge_bytes BYTEA;
BEGIN
  -- Find user by email
  SELECT * INTO user_record
  FROM app_public.users u
  WHERE u.email = user_email
    AND u.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Generate random 32-byte challenge
  challenge_bytes := app_public.gen_random_bytes(32);

  -- Return challenge and user info
  RETURN QUERY SELECT 
    encode(challenge_bytes, 'base64') AS challenge,
    user_record.id AS user_id,
    user_record.email::TEXT AS user_name,
    user_record.name AS user_display_name;
END;
$$;


--
-- Name: login_with_password(app_public.citext, text); Type: FUNCTION; Schema: app_public; Owner: -
--

CREATE FUNCTION app_public.login_with_password(email app_public.citext, password text) RETURNS TABLE(user_id uuid, session_token text, expires_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  user_record app_public.users;
  auth_record app_private.user_authentication_methods;
  new_session_token TEXT;
  session_expires_at TIMESTAMPTZ;
BEGIN
  -- Find user by email
  SELECT * INTO user_record
  FROM app_public.users u
  WHERE u.email = login_with_password.email
    AND u.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid email or password';
  END IF;

  -- Get authentication method
  SELECT * INTO auth_record
  FROM app_private.user_authentication_methods uam
  WHERE uam.user_id = user_record.id
    AND uam.method = 'password';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid email or password';
  END IF;

  -- Verify password
  IF NOT (auth_record.password_hash = app_public.crypt(password, auth_record.password_hash)) THEN
    RAISE EXCEPTION 'Invalid email or password';
  END IF;

  -- Generate session token
  new_session_token := encode(app_public.gen_random_bytes(32), 'base64');
  session_expires_at := NOW() + INTERVAL '30 days';

  -- Create session
  INSERT INTO app_private.sessions (user_id, session_token, expires_at)
  VALUES (user_record.id, new_session_token, session_expires_at);

  -- Return session info
  RETURN QUERY SELECT user_record.id, new_session_token, session_expires_at;
END;
$$;


--
-- Name: login_with_webauthn(app_public.citext, text, text, text, text, text); Type: FUNCTION; Schema: app_public; Owner: -
--

CREATE FUNCTION app_public.login_with_webauthn(user_email app_public.citext, credential_id text, challenge text, client_data_json text, authenticator_data text, signature text) RETURNS TABLE(user_id uuid, session_token text, expires_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  user_record app_public.users;
  auth_record app_private.user_authentication_methods;
  new_session_token TEXT;
  session_expires_at TIMESTAMPTZ;
BEGIN
  -- Find user by email
  SELECT * INTO user_record
  FROM app_public.users u
  WHERE u.email = user_email
    AND u.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid credentials';
  END IF;

  -- Get WebAuthn authentication method
  SELECT * INTO auth_record
  FROM app_private.user_authentication_methods uam
  WHERE uam.user_id = user_record.id
    AND uam.method = 'webauthn'
    AND uam.webauthn_credential_id = credential_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid credentials';
  END IF;

  -- TODO: In a real implementation, you would verify the signature here
  -- For now, we'll assume the signature is valid since this is a demo
  -- In production, you would:
  -- 1. Parse the authenticator data
  -- 2. Verify the signature using the stored public key
  -- 3. Check the challenge matches
  -- 4. Update the counter to prevent replay attacks

  -- Update credential counter (simplified for demo)
  UPDATE app_private.user_authentication_methods
  SET 
    webauthn_counter = webauthn_counter + 1,
    updated_at = NOW()
  WHERE user_id = user_record.id
    AND method = 'webauthn'
    AND webauthn_credential_id = credential_id;

  -- Generate session token
  new_session_token := encode(app_public.gen_random_bytes(32), 'base64');
  session_expires_at := NOW() + INTERVAL '30 days';

  -- Create session
  INSERT INTO app_private.sessions (user_id, session_token, expires_at)
  VALUES (user_record.id, new_session_token, session_expires_at);

  -- Return session info
  RETURN QUERY SELECT user_record.id, new_session_token, session_expires_at;
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
-- Name: register_user_with_password(app_public.citext, text, text); Type: FUNCTION; Schema: app_public; Owner: -
--

CREATE FUNCTION app_public.register_user_with_password(email app_public.citext, name text, password text) RETURNS app_public.users
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  new_user app_public.users;
  password_hash TEXT;
BEGIN
  -- Hash the password using pgcrypto
  password_hash := app_public.crypt(password, app_public.gen_salt('bf'));

  -- Insert new user
  INSERT INTO app_public.users (email, name, auth_method)
  VALUES (email, name, 'password')
  RETURNING * INTO new_user;

  -- Create primary email record
  INSERT INTO app_private.user_emails (user_id, email, is_primary, is_verified)
  VALUES (new_user.id, email, TRUE, FALSE);

  -- Store password hash
  INSERT INTO app_private.user_authentication_methods (user_id, method, password_hash)
  VALUES (new_user.id, 'password', password_hash);

  RETURN new_user;
END;
$$;


--
-- Name: register_webauthn_credential(app_public.citext, text, text, text, text, text); Type: FUNCTION; Schema: app_public; Owner: -
--

CREATE FUNCTION app_public.register_webauthn_credential(user_email app_public.citext, credential_id text, public_key text, challenge text, client_data_json text, attestation_object text) RETURNS app_public.users
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  user_record app_public.users;
  existing_auth app_private.user_authentication_methods;
BEGIN
  -- Find user by email
  SELECT * INTO user_record
  FROM app_public.users u
  WHERE u.email = user_email
    AND u.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Check if user already has WebAuthn credentials
  SELECT * INTO existing_auth
  FROM app_private.user_authentication_methods uam
  WHERE uam.user_id = user_record.id
    AND uam.method = 'webauthn';

  IF FOUND THEN
    -- Update existing WebAuthn credential
    UPDATE app_private.user_authentication_methods
    SET 
      webauthn_credential_id = credential_id,
      webauthn_public_key = public_key,
      webauthn_counter = 0,
      updated_at = NOW()
    WHERE user_id = user_record.id
      AND method = 'webauthn';
  ELSE
    -- Insert new WebAuthn credential
    INSERT INTO app_private.user_authentication_methods (
      user_id, 
      method, 
      webauthn_credential_id, 
      webauthn_public_key, 
      webauthn_counter
    )
    VALUES (
      user_record.id, 
      'webauthn', 
      credential_id, 
      public_key, 
      0
    );
  END IF;

  -- Update user's auth method to webauthn
  UPDATE app_public.users
  SET auth_method = 'webauthn', updated_at = NOW()
  WHERE id = user_record.id;

  -- Return updated user record
  SELECT * INTO user_record
  FROM app_public.users u
  WHERE u.id = user_record.id;

  RETURN user_record;
END;
$$;


--
-- Name: switch_auth_method(uuid, app_public.auth_method); Type: FUNCTION; Schema: app_public; Owner: -
--

CREATE FUNCTION app_public.switch_auth_method(user_id uuid, new_method app_public.auth_method) RETURNS app_public.users
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  user_record app_public.users;
BEGIN
  -- Find user
  SELECT * INTO user_record
  FROM app_public.users u
  WHERE u.id = user_id
    AND u.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Remove existing authentication methods
  DELETE FROM app_private.user_authentication_methods
  WHERE user_authentication_methods.user_id = user_id;

  -- Update user's auth method
  UPDATE app_public.users
  SET auth_method = new_method, updated_at = NOW()
  WHERE id = user_id;

  -- Return updated user record
  SELECT * INTO user_record
  FROM app_public.users u
  WHERE u.id = user_id;

  RETURN user_record;
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
-- PostgreSQL database dump complete
--
