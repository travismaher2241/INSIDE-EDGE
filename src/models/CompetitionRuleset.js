/**
 * CompetitionRuleset Data Model
 * Represents an uploaded, versioned local playing conditions / competition by-laws document
 */

export const RULESET_STATUS = {
  UPLOADED: 'UPLOADED',
  PROCESSING: 'PROCESSING',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  ACTIVE: 'ACTIVE',
  SUPERSEDED: 'SUPERSEDED',
  ARCHIVED: 'ARCHIVED',
  ERROR: 'ERROR'
};

export function createCompetitionRuleset({
  name,
  associationName = 'Local Cricket Association',
  competitionName = 'Junior / Senior League',
  season = '2026',
  jurisdiction = 'Regional',
  applicableCohorts = ['U13_JUNIOR'],
  applicableTeams = [],
  sourceDocumentId = null,
  sourceDocumentName = 'Document.pdf',
  sourceVersion = '1.0'
}) {
  return {
    rulesetId: 'crs_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    name: name || `${associationName} Playing Conditions ${season}`,
    associationName,
    competitionName,
    season,
    jurisdiction,
    applicableCohorts,
    applicableTeams,
    sourceDocumentId: sourceDocumentId || 'doc_' + Date.now(),
    sourceDocumentName,
    sourceVersion,
    effectiveFrom: new Date().toISOString(),
    effectiveTo: null,
    extractedRules: [],
    unresolvedRules: [],
    conflicts: [],
    status: RULESET_STATUS.UPLOADED,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}
