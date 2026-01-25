/**
 * Fallback reasoning for KSQL → KSMF route
 * Used when Gemini API is unavailable, rate-limited, or times out
 */

export const FALLBACK_REASONING = {
  summary:
    'Route avoids SFO Class B airspace using SUNOL waypoint for positive navigation, then direct to Sacramento area. This routing provides terrain clearance while remaining clear of controlled airspace.',

  steps: [
    {
      segment: 'KSQL → SUNOL',
      rationale:
        'Initial departure heading 070° climbs above Class B floor (3,000\' MSL) while providing terrain clearance over East Bay hills. SUNOL waypoint provides positive GPS navigation fix at the edge of Class B lateral boundaries.',
      airspace_notes:
        'Remains in Class E airspace - no clearance required. SFO Class B overhead begins at 3,000\' MSL, requiring altitude awareness.',
      alternatives_considered:
        'Direct route passes through SFO Class B core (surface to 10,000\' MSL) - would require ATC clearance and two-way radio communication. Northern routing via Concord (CCR) adds 12 nautical miles.',
    },
    {
      segment: 'SUNOL → PYE',
      rationale:
        'Pyramid VOR (112.2 MHz) provides traditional navigation backup if GPS signal is lost. This leg keeps aircraft clear of Oakland and Hayward Class D airspace to the west.',
      airspace_notes: 'Clear of all restricted areas. Standard VFR flight following recommended.',
      alternatives_considered:
        'Direct SUNOL to Sacramento adds minimal distance but loses VOR navigation reference point.',
    },
    {
      segment: 'PYE → SAC → KSMF',
      rationale:
        'Sacramento VORTAC (115.2 MHz) provides final approach guidance into KSMF Class D airspace. Standard arrival procedures use SAC for alignment with Runway 20.',
      airspace_notes:
        'Contact Sacramento Executive Tower (118.5) approximately 10 miles out for Class D entry clearance.',
      alternatives_considered: 'None - this is the optimal direct path for terminal area entry.',
    },
  ],

  weather_assumptions: {
    conditions: 'VFR',
    visibility: '10+ statute miles',
    winds_aloft: 'Light and variable (assumed for demonstration)',
    notes:
      'Pilots should always check current METAR/TAF and NOTAMs before flight. This route planning assumes clear weather conditions.',
  },

  safety_notes: [
    'Maintain VFR cloud clearances: 1,000\' above, 500\' below, 2,000\' horizontal',
    'Monitor 121.5 MHz emergency frequency on COM2',
    'Squawk 1200 (VFR) unless assigned different code by ATC',
    'Consider flight following with NorCal Approach (135.65) for traffic advisories',
  ],

  educational_points: [
    'Class B Airspace: Designed to protect high-density traffic areas around major airports. Entry requires explicit clearance.',
    'VOR Navigation: Traditional ground-based radio navigation - still valuable as GPS backup',
    'Waypoint Selection: Using named fixes provides shared understanding with ATC and other pilots on frequency',
  ],
}

/**
 * Generate formatted reasoning text from fallback data
 */
export function generateFallbackReasoningText(): string {
  const reasoning = FALLBACK_REASONING

  let text = `## Route Analysis\n\n${reasoning.summary}\n\n`

  text += `## Segment-by-Segment Breakdown\n\n`

  reasoning.steps.forEach((step, index) => {
    text += `### ${index + 1}. ${step.segment}\n\n`
    text += `**Rationale:** ${step.rationale}\n\n`
    text += `**Airspace Notes:** ${step.airspace_notes}\n\n`
    text += `**Alternatives Considered:** ${step.alternatives_considered}\n\n`
  })

  text += `## Weather Assumptions\n\n`
  text += `- **Conditions:** ${reasoning.weather_assumptions.conditions}\n`
  text += `- **Visibility:** ${reasoning.weather_assumptions.visibility}\n`
  text += `- **Winds:** ${reasoning.weather_assumptions.winds_aloft}\n\n`
  text += `*${reasoning.weather_assumptions.notes}*\n\n`

  text += `## Safety Reminders\n\n`
  reasoning.safety_notes.forEach((note) => {
    text += `- ${note}\n`
  })

  text += `\n## Educational Notes\n\n`
  reasoning.educational_points.forEach((point) => {
    text += `- ${point}\n`
  })

  return text
}
