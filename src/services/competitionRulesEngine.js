import { createCompetitionRuleset, RULESET_STATUS } from '../models/CompetitionRuleset';
import { BASE_MATCH_DEFINITIONS } from '../config/matchDefinitions';
import { SAFETY_FRAMEWORK } from '../config/safety';

export { SAFETY_FRAMEWORK };

/**
 * Controlled Ingestion Pipeline for Local By-Laws & Playing Conditions
 */
export async function processUploadedRuleDocument(file, textContent) {
  if (!file) {
    throw new Error('No rule document file provided.');
  }

  const rawText = textContent || '';

  // Binary Format Validation: Check for binary PDF (%PDF-), DOCX (PK\x03\x04), or null bytes
  const isBinaryContent = rawText.startsWith('%PDF-') || rawText.startsWith('PK\x03\x04') || rawText.includes('\u0000');

  if (isBinaryContent) {
    throw new Error(
      `Binary file format (${file.name.split('.').pop().toUpperCase()}) is not raw text. Please convert your local by-laws to .txt or .json format for ingestion.`
    );
  }

  // Stage 1: Init Model & Metadata
  const ruleset = createCompetitionRuleset({
    name: file.name.replace(/\.[^/.]+$/, "") + " Ruleset",
    sourceDocumentName: file.name
  });

  ruleset.status = RULESET_STATUS.PROCESSING;

  if (rawText.includes("2026")) ruleset.season = "2026";
  if (rawText.includes("2027")) ruleset.season = "2027";

  const candidateRules = [];
  const unresolvedRules = [];
  const conflicts = [];

  // Candidate Rule Extraction: Bowler Max Overs
  const bowlerOversMatch = rawText.match(/max(?:imum)?\s+(\d+)\s+overs\s+per\s+bowler/i);
  if (bowlerOversMatch) {
    const proposedVal = parseInt(bowlerOversMatch[1], 10);
    if (proposedVal >= 1 && proposedVal <= 20) {
      candidateRules.push({
        ruleId: 'r_' + Date.now() + '_1',
        ruleType: 'BOWLER_MAX_OVERS',
        targetPath: 'maxOversPerBowler',
        proposedValue: proposedVal,
        sourceDocument: file.name,
        pageSection: 'Section 4 - Bowling Restrictions',
        supportingText: bowlerOversMatch[0],
        confidence: 0.95,
        status: 'PROPOSED',
        isSafetyProtected: false
      });
    }
  }

  // Candidate Rule Extraction: Max Outfielders
  const outfieldersMatch = rawText.match(/max(?:imum)?\s+(\d+)\s+fielders\s+outside/i);
  if (outfieldersMatch) {
    const proposedVal = parseInt(outfieldersMatch[1], 10);
    if (proposedVal >= 1 && proposedVal <= 9) {
      candidateRules.push({
        ruleId: 'r_' + Date.now() + '_2',
        ruleType: 'FIELDING_CIRCLE_RESTRICTION',
        targetPath: 'fieldingRestrictions.maxOutfieldersNonPowerplay',
        proposedValue: proposedVal,
        sourceDocument: file.name,
        pageSection: 'Section 7 - Fielding Restrictions',
        supportingText: outfieldersMatch[0],
        confidence: 0.90,
        status: 'PROPOSED',
        isSafetyProtected: false
      });
    }
  }

  // Immutable Safety Framework Check
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

  // Ambiguous clause check
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
  
  // Activation Gate: Blocked if safety conflicts exist
  if (conflicts.length > 0) {
    ruleset.status = 'BLOCKED_BY_SAFETY';
  } else {
    ruleset.status = RULESET_STATUS.REVIEW_REQUIRED;
  }

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

  // Apply only explicitly CONFIRMED extracted rules that do NOT violate safety
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
