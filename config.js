// ============================================================
// Supabase-Zugangsdaten
// ============================================================
// Diese beiden Werte findest du in deinem Supabase-Projekt unter:
// Project Settings -> Data API
//   - "Project URL"       -> SUPABASE_URL
//   - "anon public" Key   -> SUPABASE_ANON_KEY
//
// Wichtig: Der "anon" Key ist bewusst öffentlich (er landet im
// Browser-Code jedes Besuchers) - das ist bei Supabase so gedacht.
// Der Schutz kommt nicht aus Geheimhaltung, sondern aus den
// Row-Level-Security-Regeln in supabase-schema.sql. Verwende hier
// NIEMALS den "service_role" Key, der ist geheim!
// ============================================================

const SUPABASE_URL = "https://ivwmixaicpmtvcjtnbjv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ceeSGcYMSSLSdAJgqbC8mQ_W93x2oq8";
