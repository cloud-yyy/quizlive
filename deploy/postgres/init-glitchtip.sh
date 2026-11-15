#!/bin/sh
# Runs once on an empty data volume: a separate database for GlitchTip in the same PostgreSQL.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "CREATE DATABASE glitchtip;"
