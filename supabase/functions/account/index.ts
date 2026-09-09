// ============================================================
//  account — profil-handlinger som krever service_role
//  ------------------------------------------------------------
//  actions:
//    sync   → binder admin-rad til auth-bruker + speiler e-post til tabellene
//    rename → oppdaterer navn i runners / check_ins / winners
//    delete → sletter all brukerdata + selve auth-kontoen
//
//  Kalles fra appen med sbClient.functions.invoke('account', { body })
// ============================================================
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const SUPER_ADMIN_EMAIL = 'ziadnasif77@gmail.com';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/** Admin-raden til brukeren — via user_id, ellers via e-post (og bind den da). */
async function findAdminRow(db: SupabaseClient, uid: string, email: string) {
  const { data: bound } = await db
    .from('admins')
    .select('id,email,admin_code,is_active')
    .eq('user_id', uid)
    .maybeSingle();
  if (bound) return bound;

  // Ikke bundet ennå — finn på e-post (case-insensitivt, uten LIKE-jokertegn).
  const { data: unbound } = await db
    .from('admins')
    .select('id,email,admin_code,is_active')
    .is('user_id', null);
  const match = (unbound || []).find(
    (a) => (a.email || '').toLowerCase() === email.toLowerCase(),
  );
  if (!match) return null;
  await db.from('admins').update({ user_id: uid }).eq('id', match.id);
  return match;
}

async function syncProfile(db: SupabaseClient, uid: string, email: string) {
  const adminRow = await findAdminRow(db, uid, email);
  if (adminRow && (adminRow.email || '').toLowerCase() !== email.toLowerCase()) {
    // E-posten er byttet i auth — flytt admin-rettighetene med.
    await db.from('admins').update({ email }).eq('id', adminRow.id);
  }
  await db.from('runners').update({ email }).eq('id', uid);
  return { ok: true, isAdmin: !!adminRow, adminCode: adminRow?.admin_code ?? null };
}

async function renameUser(db: SupabaseClient, uid: string, rawName: unknown) {
  const name = String(rawName ?? '').trim();
  if (name.length < 2) throw new Error('Navnet må ha minst 2 tegn');
  if (name.length > 60) throw new Error('Navnet kan ha maks 60 tegn');

  await db.from('runners').update({ name }).eq('id', uid);
  await db.from('check_ins').update({ runner_name: name }).eq('runner_id', uid);
  await db.from('winners').update({ winner_name: name }).eq('winner_id', uid);
  return { ok: true, name };
}

async function deleteAccount(db: SupabaseClient, uid: string, email: string) {
  // 1) Er brukeren arrangør? Turer og steder må bort før admin-raden (FK).
  const adminRow = await findAdminRow(db, uid, email);
  if (adminRow) {
    const code = adminRow.admin_code;
    const { data: races } = await db.from('races').select('race_id').eq('admin_code', code);
    const raceIds = (races || []).map((r) => r.race_id).filter(Boolean);
    if (raceIds.length) await db.from('checkpoints').delete().in('race_id', raceIds);
    await db.from('races').delete().eq('admin_code', code);
    // Deltakerne beholdes, men kobles fra arrangøren.
    await db.from('runners').update({ race_id: null, prev_race_id: code }).eq('race_id', code);
    await db.from('winners').delete().eq('admin_code', code);
    await db.from('admins').delete().eq('id', adminRow.id);
  }

  // 2) Brukerens egne data.
  await db.from('check_ins').delete().eq('runner_id', uid);
  await db.from('winners').delete().eq('winner_id', uid);
  await db.from('runners').delete().eq('id', uid);

  // 3) Selve kontoen.
  const { error } = await db.auth.admin.deleteUser(uid);
  if (error) throw error;

  return { ok: true, wasAdmin: !!adminRow };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Mangler autorisasjon' }, 401);

  const { data: { user }, error: userErr } = await db.auth.getUser(token);
  if (userErr || !user) return json({ error: 'Ugyldig sesjon — logg inn på nytt' }, 401);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* tom body */ }

  const uid = user.id;
  const email = user.email || '';

  try {
    switch (body.action) {
      case 'sync':
        return json(await syncProfile(db, uid, email));
      case 'rename':
        return json(await renameUser(db, uid, body.name));
      case 'delete':
        if (email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() && body.confirm !== 'SLETT') {
          return json({ error: 'Eierkontoen krever ekstra bekreftelse' }, 400);
        }
        return json(await deleteAccount(db, uid, email));
      default:
        return json({ error: 'Ukjent handling' }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error)?.message || 'Noe gikk galt' }, 500);
  }
});
