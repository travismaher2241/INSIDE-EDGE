import { createCompetitionRuleset, RULESET_STATUS } from '../models/CompetitionRuleset';
import { BASE_MATCH_DEFINITIONS } from '../config/matchDefinitions';
import { SAFETY_FRAMEWORK } from '../config/safety';

/**
 * 7-Stage Controlled Ingestion Pipeline for Local By-Laws & Playing Conditions
 */
export async function processUploadedRuleDocument(file, textContent) {
  // Stage 1: Upload Document & Init Model
  const ruleset = createCompetitionRuleset({
    name: file.name.replace(/\.[^/.]+$/, "") + " Ruleset",
    sourceDocumentName: file.name
  });

  // Stage 2: Extract Text
  const rawText = textContent || "";

  // Stage 3: Identify Competition Metadata
  ruleset.status = RULESET_STATUS.PROCESSING;
  
  // Detect season / association names if present
  if (rawText.includes("2026")) ruleset.season = "2026";
  if (rawText.includes("2027")) ruleset.season = "2027";

  // Stage 4 & 5: Detect Candidate Rules & Map to Structured Schema
  const candidateRules = [];
  const unresolvedRules = [];
  const conflicts = [];

  // Example Detection 1: Max overs per bowler
  const bowlerOversMatch = rawText.match(/max(?:imum)?\s+(\d+)\s+overs\s+per\s+bowler/i);
  if (bowlerOversMatch) {
    candidateRules.push({
      ruleId: 'r_' + Date.now() + '_1',
      ruleType: 'BOWLER_MAX_OVERS',
      targetPath: 'maxOversPerBowler',
      proposedValue: parseInt(bowlerOversMatch[1], 10),
      sourceDocument: file.name,
      pageSection: 'Section 4 - Bowling Restrictions',
      supportingText: bowlerOversMatch[0],
      confidence: 0.95,
      status: 'CONFIRMED',
      isSafetyProtected: false
    });
  }

  // Example Detection 2: Max outfielders
  const outfieldersMatch = rawText.match(/max(?:imum)?\s+(\d+)\s+fielders\s+outside/i);
  if (outfieldersMatch) {
    candidateRules.push({
      ruleId: 'r_' + Date.now() + '_2',
      ruleType: 'FIELDING_CIRCLE_RESTRICTION',
      targetPath: 'fieldingRestrictions.maxOutfieldersNonPowerplay',
      proposedValue: parseInt(outfieldersMatch[1], 10),
      sourceDocument: file.name,
      pageSection: 'Section 7 - Fielding Restrictions',
      supportingText: outfieldersMatch[0],
      confidence: 0.90,
      status: 'CONFIRMED',
      isSafetyProtected: false
    });
  }

  // Example Conflict / Safety Check: If text attempts to weaken helmet safety
  if (rawText.toLowerCase().includes("helmets optional") || rawText.toLowerCase().includes("no helmets required")) {
    conflicts.push({
      conflictId: 'c_' + Date.now() + '_safety',
      ruleType: 'MANDATORY_HELMETS',
      description: 'Uploaded document attempts to weaken protected helmet safety rule.',
      attemptedValue: false,
      protectedValue: true,
      status: 'BLOCKED_BY_SAFETY'
    });
  }

  // Example Unresolved: Ambiguous wording
  const ambiguousMatch = rawText.match(/retirement\s+after\s+scoring\s+some\s+runs/i);
  if (ambiguousMatch) {
    unresolvedRules.push({
      unresolvedId: 'u_' + Date.now() + '_1',
      description: 'Ambiguous batter retirement clause detected.',
      supportingText: ambiguousMatch[0],
      notice: '[UNRESOLVED: Coach Review Required]'
    });
  }

  ruleset.extractedRules = candidateRules;
  ruleset.unresolvedRules = unresolvedRules;
  ruleset.conflicts = conflicts;
  
  // Stage 6 & 7: Coach Review & Activation
  ruleset.status = (unresolvedRules.length > 0 || candidateRules.some(r => r.status === 'PENDING_REVIEW'))
    ? RULESET_STATUS.REVIEW_REQUIRED
    : RULESET_STATUS.ACTIVE;

  ruleset.updatedAt = new Date().toISOString();
  return ruleset;
}

/**
 * Resolves EffectiveMatchDefinition by overlaying active CompetitionRuleset on Base MatchDefinition
 */
export function getEffectiveMatchDefinition(baseFormatId = 'T20', activeRuleset = null) {
  const baseDef = BASE_MATCH_DEFINITIONS[baseFormatId] || BASE_MATCH_DEFINITIONS.T20;
  
  if (!activeRuleset || activeRuleset.status !== RULESET_STATUS.ACTIVE) {
    return { ...baseDef, isOverlayApplied: false, activeRulesetName: null };
  }

  const effective = JSON.parse(JSON.stringify(baseDef));
  effective.isOverlayApplied = true;
  effective.activeRulesetName = activeRuleset.name;

  // Apply approved extracted rules
  activeRuleset.extractedRules.forEach(rule => {
    if (rule.status === 'CONFIRMED' && !rule.isSafetyProtected) {
      if (rule.targetPath === 'maxOversPerBowler') {
        effective.maxOversPerBowler = rule.proposedValue;
      } else if (rule.targetPath === 'fieldingRestrictions.maxOutfieldersNonPowerplay') {
        if (!effective.fieldingRestrictions) effective.fieldingRestrictions = {};
        effective.fieldingRestrictions.maxOutfieldersNonPowerplay = rule.proposedValue;
      }
    }
  });

  return effective;
}
