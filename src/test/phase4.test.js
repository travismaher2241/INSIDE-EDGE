import { describe, it, expect } from 'vitest';
import { processUploadedRuleDocument, getEffectiveMatchDefinition } from '../services/competitionRulesEngine';

describe('Phase 4 - Rules Ingestion & Safety Core', () => {

  it('1. Rejects binary PDF/DOCX files with explicit, informative error message', async () => {
    const file = { name: 'by_laws_2026.pdf' };
    const binaryPdfHeader = '%PDF-1.5 %binary...';

    await expect(processUploadedRuleDocument(file, binaryPdfHeader)).rejects.toThrow(/Binary file format \(PDF\) is not raw text/);
  });

  it('2. Extracted candidate rules are created as PROPOSED requiring coach review', async () => {
    const file = { name: 'local_rules.txt' };
    const text = 'Local By-laws 2026: Maximum 3 overs per bowler allowed in junior matches.';

    const ruleset = await processUploadedRuleDocument(file, text);
    expect(ruleset.extractedRules.length).toBe(1);
    expect(ruleset.extractedRules[0].status).toBe('PROPOSED');
    expect(ruleset.status).toBe('REVIEW_REQUIRED');
  });

  it('3. Rulesets attempting to weaken helmet safety are assigned BLOCKED_BY_SAFETY', async () => {
    const file = { name: 'unsafe_rules.txt' };
    const text = 'Special rule: Helmets optional for spin bowlers.';

    const ruleset = await processUploadedRuleDocument(file, text);
    expect(ruleset.conflicts.length).toBe(1);
    expect(ruleset.status).toBe('BLOCKED_BY_SAFETY');
  });

});
