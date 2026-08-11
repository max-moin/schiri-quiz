// ============================================================
// Supabase-Zugangsdaten
// ============================================================
// Diese beiden Werte findest du in deinem Supabase-Projekt unter:
// Project Settings -> Data API
//   - "Project URL"       -> SUPABASE_URL
//   - "anon public" Key   -> SUPABASE_ANON_KEY
//
// Wichtig: Der Publishable Key ist bewusst öffentlich (er landet im
// Browser-Code jedes Besuchers). Der Schutz kommt aus den aktuellen
// Datenbankrechten, RLS-Regeln und den PIN-prüfenden RPCs der Live-Datenbank.
// supabase-schema.sql bildet nur den historischen Prototyp ab und ist dafür
// NICHT die aktuelle Quelle. Verwende hier NIEMALS einen Secret- oder
// service_role-Key!
// ============================================================

const SUPABASE_URL = "https://ivwmixaicpmtvcjtnbjv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ceeSGcYMSSLSdAJgqbC8mQ_W93x2oq8";
