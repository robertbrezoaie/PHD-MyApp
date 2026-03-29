import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MAX_ENERGY = 100;
const ENERGY_REGEN_PER_HOUR = 10;

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("energy, energy_regen_at, updated_at")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Use energy_regen_at if available, otherwise fall back to updated_at
    const lastRegen = new Date(profile.energy_regen_at ?? profile.updated_at).getTime();
    const now = Date.now();
    const hoursElapsed = (now - lastRegen) / (1000 * 60 * 60);
    const energyToRegen = Math.floor(hoursElapsed * ENERGY_REGEN_PER_HOUR);
    const newEnergy = Math.min(MAX_ENERGY, profile.energy + energyToRegen);

    if (newEnergy !== profile.energy) {
      await serviceClient
        .from("profiles")
        .update({ energy: newEnergy, energy_regen_at: new Date().toISOString() })
        .eq("id", user.id);
    }

    return new Response(
      JSON.stringify({
        energy: newEnergy,
        max_energy: MAX_ENERGY,
        regenerated: newEnergy - profile.energy,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
