/**
 * Reading the stored Coverage Report packs.
 *
 * Since 2026-09-11 this table holds ONE ROW PER WEEK rather than a single
 * overwritten row, which makes two things load-bearing everywhere below:
 *
 *  1. Always order. An unordered limit(1) returns an arbitrary week.
 *  2. Never maybeSingle(). It throws on multiple rows, which this table now
 *     has by design.
 *
 * The index deliberately selects JSON fields rather than whole packs: a pack is
 * ~385KB, so listing 52 weeks by selecting `pack` would read 20MB every time a
 * page regenerates, to render a list of dates.
 */

// Weeks before `report.week` existed fall back to the generation date, which is
// what the field was derived from anyway.
const weekOf = row => row?.week || (row?.generatedAt || '').slice(0, 10) || null

export async function fetchLatestReport(db) {
  const { data } = await db.from('social_drafts')
    .select('pack').eq('pack->>kind', 'coverage_report')
    .order('created_at', { ascending: false }).limit(1)
  return data?.[0]?.pack || null
}

export async function fetchReportByWeek(db, week) {
  const { data } = await db.from('social_drafts')
    .select('pack').eq('pack->>kind', 'coverage_report').eq('pack->>week', week)
    .order('created_at', { ascending: false }).limit(1)
  if (data?.[0]?.pack) return data[0].pack
  // Legacy row: stored before `week` existed, so it has no key to match on.
  // Fall back to scanning for one whose generation date is the week asked for.
  const { data: all } = await db.from('social_drafts')
    .select('pack').eq('pack->>kind', 'coverage_report')
    .order('created_at', { ascending: false })
  return (all || []).map(r => r.pack).find(p => weekOf(p) === week) || null
}

/**
 * Lightweight list for the archive index and getStaticPaths.
 * @returns {Promise<Array<{week:string, since:string, generatedAt:string, headlines:number, outlets:number}>>}
 */
export async function listReportWeeks(db) {
  const { data, error } = await db.from('social_drafts')
    .select('week:pack->>week, generatedAt:pack->>generatedAt, since:pack->>since, corpus:pack->corpus')
    .eq('pack->>kind', 'coverage_report')
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data
    .map(r => ({
      week: weekOf(r),
      since: r.since || null,
      generatedAt: r.generatedAt || null,
      headlines: r.corpus?.headlines ?? null,
      outlets: r.corpus?.outlets ?? null,
    }))
    .filter(r => r.week)
    // Newest first, and de-duplicated in case a legacy row and a keyed row ever
    // resolve to the same week.
    .filter((r, i, arr) => arr.findIndex(x => x.week === r.week) === i)
    .sort((a, b) => (a.week < b.week ? 1 : -1))
}
