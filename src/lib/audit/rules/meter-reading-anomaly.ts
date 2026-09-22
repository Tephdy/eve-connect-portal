import type { Rule, RuleViolation } from "../types";

export const meterReadingAnomaly: Rule = {
  key: "METER_READING_ANOMALY",
  async run({ client }) {
    // 1. Fetch all active meters
    const { data: meters, error: mErr } = await client
      .schema("acct").from("meter")
      .select("id, unit_id, utility_type, meter_number, unit_label, initial_reading")
      .eq("active", true);

    if (mErr) throw new Error("METER_READING_ANOMALY.meters: " + mErr.message);
    if (!meters || meters.length === 0) return [];

    const meterIds = meters.map((m: any) => m.id);

    // 2. Fetch all readings for those meters, newest first
    const { data: readings, error: rErr } = await client
      .schema("acct").from("meter_reading")
      .select("meter_id, reading, reading_date")
      .in("meter_id", meterIds)
      .order("reading_date", { ascending: false });

    if (rErr) throw new Error("METER_READING_ANOMALY.readings: " + rErr.message);

    // Group by meter
    const byMeter = new Map<string, { reading: number; reading_date: string }[]>();
    for (const r of readings ?? []) {
      const id = (r as any).meter_id;
      if (!byMeter.has(id)) byMeter.set(id, []);
      byMeter.get(id)!.push({ reading: Number((r as any).reading), reading_date: (r as any).reading_date });
    }

    const violations: RuleViolation[] = [];

    for (const m of meters as any[]) {
      const rs = byMeter.get(m.id) ?? [];
      if (rs.length < 2) continue;

      const current = rs[0];
      const previous = rs[1];

      // Anomaly A: reading went backwards
      if (current.reading < previous.reading) {
        violations.push({
          entity_type: "meter",
          entity_id: m.id,
          title: "Meter " + (m.meter_number ?? m.id.slice(0, 8)) + " went backwards (" + previous.reading + " to " + current.reading + ")",
          summary: "Current reading is lower than the previous reading. Likely a data-entry error.",
          evidence: {
            meter_id: m.id,
            utility_type: m.utility_type,
            previous_reading: previous.reading,
            previous_date: previous.reading_date,
            current_reading: current.reading,
            current_date: current.reading_date,
          },
        });
        continue; // don't also flag as a spike
      }

      // Anomaly B: consumption is 3x the trailing 3-month average
      if (rs.length >= 5) {
        const recentDelta = current.reading - previous.reading;
        const trailing = rs.slice(1, 5);
        const deltas: number[] = [];
        for (let i = 0; i < trailing.length - 1; i++) {
          const d = trailing[i].reading - trailing[i + 1].reading;
          if (d > 0) deltas.push(d);
        }
        if (deltas.length >= 2) {
          const avg = deltas.reduce((s, d) => s + d, 0) / deltas.length;
          if (avg > 0 && recentDelta > avg * 3) {
            violations.push({
              entity_type: "meter",
              entity_id: m.id,
              title: "Meter " + (m.meter_number ?? m.id.slice(0, 8)) + " spiked to " + recentDelta.toFixed(1) + " " + m.unit_label + " (avg " + avg.toFixed(1) + ")",
              summary: "Current consumption is more than 3x the trailing average.",
              evidence: {
                meter_id: m.id,
                utility_type: m.utility_type,
                recent_consumption: recentDelta,
                trailing_average: avg,
                ratio: recentDelta / avg,
                current_date: current.reading_date,
              },
            });
          }
        }
      }
    }

    return violations;
  },
};
