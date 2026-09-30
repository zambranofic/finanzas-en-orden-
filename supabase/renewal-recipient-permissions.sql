-- Renewal worker needs only recipient identity; no password or other Auth fields.
GRANT SELECT (id, email) ON auth.users TO service_role;
