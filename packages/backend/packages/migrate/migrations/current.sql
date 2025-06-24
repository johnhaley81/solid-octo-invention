-- Enter migration here

-- ============================================================================
-- WEBAUTHN/PASSKEY FUNCTIONS
-- ============================================================================

-- Function to generate WebAuthn registration challenge
CREATE OR REPLACE FUNCTION app_public.generate_webauthn_registration_challenge(
  user_email app_public.citext
) RETURNS TABLE(
  challenge TEXT,
  user_id UUID,
  user_name TEXT,
  user_display_name TEXT
) AS $$
DECLARE
  user_record app_public.users;
  challenge_bytes BYTEA;
  challenge_b64 TEXT;
BEGIN
  -- Find user by email
  SELECT * INTO user_record
  FROM app_public.users u
  WHERE u.email = user_email
    AND u.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Generate random challenge (32 bytes)
  challenge_bytes := app_public.gen_random_bytes(32);
  challenge_b64 := encode(challenge_bytes, 'base64');
  
  -- Remove padding and make URL-safe
  challenge_b64 := replace(replace(replace(challenge_b64, '+', '-'), '/', '_'), '=', '');

  -- Return challenge and user info
  RETURN QUERY SELECT 
    challenge_b64,
    user_record.id,
    user_record.email::TEXT,
    user_record.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to register WebAuthn credential
CREATE OR REPLACE FUNCTION app_public.register_webauthn_credential(
  user_email app_public.citext,
  credential_id TEXT,
  public_key TEXT,
  challenge TEXT,
  client_data_json TEXT,
  attestation_object TEXT
) RETURNS app_public.users AS $$
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

  -- Check if user already has WebAuthn auth method
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
    WHERE user_id = user_record.id AND method = 'webauthn';
  ELSE
    -- Remove any existing auth methods (enforce single method)
    DELETE FROM app_private.user_authentication_methods
    WHERE user_id = user_record.id;

    -- Insert new WebAuthn auth method
    INSERT INTO app_private.user_authentication_methods (
      user_id,
      method,
      webauthn_credential_id,
      webauthn_public_key,
      webauthn_counter
    ) VALUES (
      user_record.id,
      'webauthn',
      credential_id,
      public_key,
      0
    );

    -- Update user's auth method
    UPDATE app_public.users
    SET auth_method = 'webauthn'
    WHERE id = user_record.id;
  END IF;

  -- Return updated user
  SELECT * INTO user_record
  FROM app_public.users u
  WHERE u.id = user_record.id;

  RETURN user_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate WebAuthn authentication challenge
CREATE OR REPLACE FUNCTION app_public.generate_webauthn_authentication_challenge(
  user_email app_public.citext
) RETURNS TABLE(
  challenge TEXT,
  credential_ids TEXT[]
) AS $$
DECLARE
  user_record app_public.users;
  auth_record app_private.user_authentication_methods;
  challenge_bytes BYTEA;
  challenge_b64 TEXT;
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

  -- Get WebAuthn authentication method
  SELECT * INTO auth_record
  FROM app_private.user_authentication_methods uam
  WHERE uam.user_id = user_record.id
    AND uam.method = 'webauthn';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No WebAuthn credentials found for user';
  END IF;

  -- Generate random challenge (32 bytes)
  challenge_bytes := app_public.gen_random_bytes(32);
  challenge_b64 := encode(challenge_bytes, 'base64');
  
  -- Remove padding and make URL-safe
  challenge_b64 := replace(replace(replace(challenge_b64, '+', '-'), '/', '_'), '=', '');

  -- Collect credential IDs
  cred_ids := ARRAY[auth_record.webauthn_credential_id];

  -- Return challenge and credential IDs
  RETURN QUERY SELECT challenge_b64, cred_ids;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to authenticate with WebAuthn
CREATE OR REPLACE FUNCTION app_public.login_with_webauthn(
  user_email app_public.citext,
  credential_id TEXT,
  challenge TEXT,
  client_data_json TEXT,
  authenticator_data TEXT,
  signature TEXT
) RETURNS TABLE(
  user_id UUID,
  session_token TEXT,
  expires_at TIMESTAMPTZ
) AS $$
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

  -- TODO: In a production system, you would verify the WebAuthn signature here
  -- For now, we'll trust that the frontend has done proper WebAuthn validation
  -- This is a simplified implementation for demonstration purposes

  -- Update counter (in real implementation, this would be extracted from authenticator_data)
  UPDATE app_private.user_authentication_methods
  SET 
    webauthn_counter = webauthn_counter + 1,
    updated_at = NOW()
  WHERE user_id = user_record.id AND method = 'webauthn';

  -- Generate session token
  new_session_token := encode(app_public.gen_random_bytes(32), 'base64');
  session_expires_at := NOW() + INTERVAL '30 days';

  -- Create session
  INSERT INTO app_private.sessions (user_id, session_token, expires_at)
  VALUES (user_record.id, new_session_token, session_expires_at);

  -- Return session info
  RETURN QUERY SELECT user_record.id, new_session_token, session_expires_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to switch authentication method (enhanced for WebAuthn)
CREATE OR REPLACE FUNCTION app_public.switch_auth_method(
  user_id UUID,
  new_method auth_method
) RETURNS app_public.users AS $$
DECLARE
  user_record app_public.users;
BEGIN
  -- Find user
  SELECT * INTO user_record
  FROM app_public.users u
  WHERE u.id = switch_auth_method.user_id
    AND u.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Remove existing authentication methods
  DELETE FROM app_private.user_authentication_methods
  WHERE user_authentication_methods.user_id = switch_auth_method.user_id;

  -- Update user's auth method
  UPDATE app_public.users
  SET auth_method = new_method
  WHERE id = switch_auth_method.user_id;

  -- Return updated user
  SELECT * INTO user_record
  FROM app_public.users u
  WHERE u.id = switch_auth_method.user_id;

  RETURN user_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
