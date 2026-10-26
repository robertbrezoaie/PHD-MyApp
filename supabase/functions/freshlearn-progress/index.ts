import { createClient } from "jsr:@supabase/supabase-js@2";

const FL_BASE = "https://api.freshlearn.com/v1/integration";

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  // Verify user identity
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user?.email) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  // Service client for DB writes (bypasses RLS)
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const apiKey = Deno.env.get("FRESHLEARN_API_KEY") ?? "";
  const userEmail = user.email.toLowerCase();

  // 1. Poll FreshLearn for new completions and sync into DB
  try {
    const res = await fetch(`${FL_BASE}/member/completed-courses`, {
      headers: { "api-key": apiKey },
    });
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
          synced_at: new Date().toISOString(),
        }));

        // Upsert — on conflict (email, course_id) update progress + dates
        await db.from("freshlearn_completions").upsert(rows, {
          onConflict: "email,course_id",
          ignoreDuplicates: false,
        });
      }
    }
  } catch (_) {
    // Don't fail the request if polling fails — just serve stored data
  }

  // 2. Return all stored completions for this user
  const { data: stored } = await db
    .from("freshlearn_completions")
    .select("*")
    .eq("email", userEmail)
    .order("completion_date", { ascending: false });

  const courses = (stored ?? []).map((r) => ({
    courseId: r.course_id,
    courseName: r.course_name,
    progress: r.progress,
    completionDate: r.completion_date,
    enrollmentDate: r.enrollment_date,
    rating: r.rating,
  }));

  return new Response(JSON.stringify({ courses }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
