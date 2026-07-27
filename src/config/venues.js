export const VENUE_MODELS = [
  { 
    id: 'COMBINED_FACILITY', 
    name: 'Main Club Grounds (Nets & Open Field)', 
    type: 'COMBINED', 
    surface: 'TURF',
    defaultFeatures: { hasNetLanes: true, netLanesCount: 2, hasOpenField: true, hasCentreWicket: false, hasIndoorArea: false }
  },
  { 
    id: 'NET_LANES_TURF', 
    name: 'Turf Net Lanes & Enclosure', 
    type: 'NETS', 
    surface: 'TURF',
    defaultFeatures: { hasNetLanes: true, netLanesCount: 2, hasOpenField: false, hasCentreWicket: false, hasIndoorArea: false }
  },
  { 
    id: 'NET_LANES_SYNTHETIC', 
    name: 'Synthetic Net Lanes Complex', 
    type: 'NETS', 
    surface: 'SYNTHETIC',
    defaultFeatures: { hasNetLanes: true, netLanesCount: 2, hasOpenField: false, hasCentreWicket: false, hasIndoorArea: false }
  },
  { 
    id: 'FULL_OVAL', 
    name: 'Full Ground Oval Pitch & Outfield', 
    type: 'OVAL', 
    surface: 'TURF',
    defaultFeatures: { hasNetLanes: false, netLanesCount: 0, hasOpenField: true, hasCentreWicket: true, hasIndoorArea: false }
  },
  { 
    id: 'HALF_OVAL', 
    name: 'Half Ground Oval & Practice Pitch', 
    type: 'OVAL', 
    surface: 'SYNTHETIC',
    defaultFeatures: { hasNetLanes: false, netLanesCount: 0, hasOpenField: true, hasCentreWicket: false, hasIndoorArea: false }
  },
  { 
    id: 'INDOOR_FACILITY', 
    name: 'Indoor Cricket Centre', 
    type: 'INDOOR', 
    surface: 'CARPET_TURF',
    defaultFeatures: { hasNetLanes: true, netLanesCount: 2, hasOpenField: false, hasCentreWicket: false, hasIndoorArea: true }
  }
];

export function resolveFacilityCapabilities(venueId, customFeatures = {}) {
  const baseVenue = VENUE_MODELS.find(v => v.id === venueId) || VENUE_MODELS[0];
  const merged = {
    ...baseVenue.defaultFeatures,
    ...customFeatures
  };

  return {
    venueId: baseVenue.id,
    venueName: baseVenue.name,
    hasNetLanes: Boolean(merged.hasNetLanes),
    netLanesCount: Number(merged.netLanesCount || 2),
    hasOpenField: Boolean(merged.hasOpenField),
    hasCentreWicket: Boolean(merged.hasCentreWicket),
    hasIndoorArea: Boolean(merged.hasIndoorArea)
  };
}
