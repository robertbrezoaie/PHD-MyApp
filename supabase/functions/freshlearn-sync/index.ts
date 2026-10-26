import { createClient } from "jsr:@supabase/supabase-js@2";

const FL_BASE = "https://api.freshlearn.com/v1/integration";

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { "Content-Type": "application/json" },
    });
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const apiKey = Deno.env.get("FRESHLEARN_API_KEY") ?? "";
  const headers = { "api-key": apiKey };
  const now = new Date().toISOString();
  const result: Record<string, unknown> = { timestamp: now };

  // 1. Sync all members (persistent endpoint — always returns full list)
  try {
    const res = await fetch(`${FL_BASE}/member`, { headers });
    if (res.ok) {
      const raw = await res.json();
      const all: Record<string, unknown>[] = Array.isArray(raw) ? raw : raw?.data ?? [];

      if (all.length > 0) {
        const rows = all.map((m) => ({
          email: String(m.email ?? "").toLowerCase(),
          full_name: m.fullName ? String(m.fullName) : null,
          first_name: m.firstName ? String(m.firstName) : null,
          last_name: m.lastName ? String(m.lastName) : null,
          phone: m.phone ? String(m.phone) : null,
          city: m.city ? String(m.city) : null,
          country: m.country ? String(m.country) : null,
          fl_member_id: m.id ? Number(m.id) : null,
          uid_number: m.uidNumber ? String(m.uidNumber) : null,
          joined_date: m.createdDate ? String(m.createdDate) : null,
          synced_at: now,
        }));

        const { error } = await db
          .from("freshlearn_members")
          .upsert(rows, { onConflict: "email", ignoreDuplicates: false });

        result.members_synced = error ? 0 : rows.length;
        result.members_error = error?.message ?? null;
      } else {
        result.members_synced = 0;
      }
    } else {
      result.members_error = `FreshLearn members returned ${res.status}`;
    }
  } catch (e) {
    result.members_error = String(e);
  }

  // 2. Sync completed courses (queue — consumes new completions)
  try {
    const res = await fetch(`${FL_BASE}/member/completed-courses`, { headers });
    if (res.ok) {
      const raw = await res.json();
      const all: Record<string, unknown>[] = Array.isArray(raw) ? raw : raw?.data ?? [];

      if (all.length > 0) {
        const rows = all.map((c) => ({
          email: String(c.email ?? "").toLowerCase(),
          course_id: String(c.courseId ?? ""),
          course_name: String(c.courseName ?? ""),
          progress: Number(c.courseCompletion ?? 100),
          completion_date: c.courseCompletionTime ? String(c.courseCompletionTime) : null,
          enrollment_date: c.enrollmentDate ? String(c.enrollmentDate) : null,
          rating: c.rating != null ? Number(c.rating) : null,
          synced_at: now,
        }));

        const { error } = await db
          .from("freshlearn_completions")
          .upsert(rows, { onConflict: "email,course_id", ignoreDuplicates: false });

        result.completions_synced = error ? 0 : rows.length;
        result.completions_error = error?.message ?? null;
      } else {
        result.completions_synced = 0;
      }
    } else {
      result.completions_error = `FreshLearn completions returned ${res.status}`;
    }
  } catch (e) {
    result.completions_error = String(e);
  }

  return new Response(JSON.stringify(result), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
