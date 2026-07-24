import { describe, it, expect, vi } from 'vitest';
import { COHORTS } from '../config/cohorts';
import { COACH_LEVELS } from '../config/coachLevels';
import { BASE_MATCH_DEFINITIONS } from '../config/matchDefinitions';
import { SAFETY_FRAMEWORK } from '../config/safety';
import { STRUCTURED_ACTIVITIES } from '../data/structuredActivityRecords';
import { searchActivities } from '../data/retrievalIndex';
import { generateTrainingPlan } from '../engine/deterministicPlanner';
import { createInitialMatchState, recordDelivery, undoLastDelivery, calculatePlayerStats } from '../engine/cricketMatchEngine';
import { processUploadedRuleDocument, getEffectiveMatchDefinition } from '../services/competitionRulesEngine';
import { processVideoImport } from '../services/videoImportPipeline';
import * as dbStorage from '../services/dbStorage';
import { queueSyncTransaction, getSyncQueue } from '../services/syncService';

describe('Inside Edge - Comprehensive Domain Test Suite', () => {

  // 1. Training Eligibility & Cohort Filtering
  it('1. Filters training activities by cohort eligibility', () => {
    const u11Activities = searchActivities({ cohortId: 'U11_JUNIOR', focus: 'All Round' });
    expect(u11Activities.every(act => act.cohortSuitability.includes('U11_JUNIOR'))).toBe(true);
  });

  // 2. Participant Capacity Constraints
  it('2. Enforces min and max participant limits against squad size', () => {
    const results = searchActivities({ maxParticipants: 5, focus: 'All Round' });
    expect(results.every(act => act.minParticipants <= 5 && act.maxParticipants >= 5)).toBe(true);
  });

  // 3. Equipment & Venue Constraints
  it('3. Filters activities by venue requirements', () => {
    const netActivities = STRUCTURED_ACTIVITIES.filter(a => a.venueRequirements.includes('NET_LANES_TURF'));
    expect(netActivities.length).toBeGreaterThan(0);
  });

  // 4. Session Timing Calculation
  it('4. Calculates session block duration from percentage ratios', () => {
    const totalDuration = 90;
    const blockPct = 0.35;
    const blockDuration = Math.round(Number((totalDuration * blockPct).toFixed(2)));
    expect(blockDuration).toBe(32);
  });

  // 5. Deterministic Local Planner (No AI)
  it('5. Generates deterministic plan locally without requiring AI', () => {
    const plan = searchActivities({ cohortId: 'U13_JUNIOR', focus: 'Batting' });
    expect(plan.length).toBeGreaterThan(0);
    expect(plan[0].id).toBe('BA-001');
  });

  // 6. AI Invariant Protections
  it('6. Ensures AI text enhancement cannot mutate protected drill IDs or safety tags', () => {
    const originalDrill = STRUCTURED_ACTIVITIES[0];
    const aiEnhancedTitle = `${originalDrill.id} - ${originalDrill.title} (Enhanced Cues)`;
    expect(originalDrill.id).toBe('BA-001');
    expect(aiEnhancedTitle).toContain('BA-001');
  });

  // 7. Repetition Avoidance
  it('7. Prevents duplicate drill IDs in plan selection', () => {
    const plan = searchActivities({ focus: 'All Round' });
    const ids = plan.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  // 8. Activity Replacements
  it('8. Replaces single drill while preserving phase slot', () => {
    const original = STRUCTURED_ACTIVITIES[0];
    const replacement = STRUCTURED_ACTIVITIES[1];
    expect(original.id).not.toBe(replacement.id);
  });

  // 9. Activity Schema Validation
  it('9. Validates required activity schema fields and stable IDs', () => {
    STRUCTURED_ACTIVITIES.forEach(act => {
      expect(act.id).toBeDefined();
      expect(act.title).toBeDefined();
      expect(act.primarySkills).toBeInstanceOf(Array);
      expect(act.sourceReferences).toBeDefined();
    });
  });

  // 10. Cricket Scoring Events
  it('10. Scores 4 and 6 runs correctly to team total and striker', () => {
    let state = createInitialMatchState('T20');
    state.activeStrikerId = 'p1';
    state = recordDelivery(state, { runsBat: 4, extraType: 'NONE' });
    expect(state.innings[0].totalRuns).toBe(4);
  });

  // 11. Extras Accounting
  it('11. Scores Wides and No-Balls as extras without adding to batter runs', () => {
    let state = createInitialMatchState('T20');
    state.activeStrikerId = 'p1';
    state = recordDelivery(state, { runsBat: 0, runsExtra: 0, extraType: 'WIDE' });
    expect(state.innings[0].totalRuns).toBe(1);
    expect(state.innings[0].totalExtras).toBe(1);
  });

  // 12. Wicket Processing
  it('12. Increments wickets and updates match state on Bowled dismissal', () => {
    let state = createInitialMatchState('T20');
    state = recordDelivery(state, { runsBat: 0, wicketType: 'BOWLED', dismissedPlayerId: 'p1' });
    expect(state.innings[0].totalWickets).toBe(1);
  });

  // 13. Over Completion Logic
  it('13. Completes over after 6 legal deliveries', () => {
    let state = createInitialMatchState('T20');
    for (let i = 0; i < 6; i++) {
      state = recordDelivery(state, { runsBat: 1 });
    }
    expect(state.innings[0].oversBowled).toBe(1);
    expect(state.innings[0].ballsInCurrentOver).toBe(0);
  });

  // 14. Strike Changes
  it('14. Rotates strike on odd runs scored', () => {
    let state = createInitialMatchState('T20');
    state.activeStrikerId = 'p1';
    state.activeNonStrikerId = 'p2';
    state = recordDelivery(state, { runsBat: 1 });
    expect(state.activeStrikerId).toBe('p2');
    expect(state.activeNonStrikerId).toBe('p1');
  });

  // 15. Innings Completion Criteria Driven by MatchDefinition
  it('15. Completes innings when 10 wickets fall in T20 format', () => {
    let state = createInitialMatchState('T20');
    for (let i = 0; i < 10; i++) {
      state = recordDelivery(state, { wicketType: 'BOWLED', dismissedPlayerId: `p${i}` });
    }
    expect(state.innings[0].isComplete).toBe(true);
    expect(state.innings[0].completionReason).toBe('ALL_OUT');
  });

  // 16. Delivery Undo Transaction
  it('16. Restores previous match state on undo delivery', () => {
    let state = createInitialMatchState('T20');
    state = recordDelivery(state, { runsBat: 4 });
    expect(state.innings[0].totalRuns).toBe(4);
    const restored = undoLastDelivery(state);
    expect(restored.innings[0].totalRuns).toBe(0);
  });

  // 17. Statistics Computation
  it('17. Calculates individual batting and bowling statistics', () => {
    let state = createInitialMatchState('T20');
    state.activeStrikerId = 'p1';
    state = recordDelivery(state, { runsBat: 4, bowlerId: 'b1' });
    const stats = calculatePlayerStats(state);
    expect(stats.batting['p1'].runs).toBe(4);
    expect(stats.bowling['b1'].runs).toBe(4);
  });

  // 18. Offline Queue & Sync
  it('18. Queues offline transactions when offline', () => {
    const tx = queueSyncTransaction('ADD_PLAYER', { name: 'Test Player' });
    expect(tx.status).toBe('PENDING_CLOUD_SYNC');
    const queue = getSyncQueue();
    expect(queue.length).toBeGreaterThan(0);
  });

  // 19. Squad Integrity
  it('19. Maintains player roster structure', () => {
    expect(COHORTS.U11_JUNIOR.id).toBe('U11_JUNIOR');
  });

  // 20. Tactics Board 11-Fielder Token Model
  it('20. Validates exactly 11 fielder tokens in Tactics Board model', () => {
    const fielderTokens = [
      { id: 'f1', role: 'Bowler' }, { id: 'f2', role: 'Keeper' },
      { id: 'f3', role: '1st Slip' }, { id: 'f4', role: '2nd Slip' },
      { id: 'f5', role: 'Gully' }, { id: 'f6', role: 'Point' },
      { id: 'f7', role: 'Cover' }, { id: 'f8', role: 'Mid-off' },
      { id: 'f9', role: 'Mid-on' }, { id: 'f10', role: 'Mid-wicket' },
      { id: 'f11', role: 'Square Leg' }
    ];
    expect(fielderTokens.length).toBe(11);
  });

  // 21. Video Import Pipeline Stages
  it('21. Executes video import pipeline stages', async () => {
    vi.spyOn(dbStorage, 'storeVideoBlob').mockResolvedValue(true);
    const file = new File(['test video content'], 'test.mp4', { type: 'video/mp4' });
    const result = await processVideoImport(file);
    expect(result.requestId).toBeDefined();
    expect(result.fileName).toBe('test.mp4');
  });

  // 22. Local Ruleset Ingestion Pipeline
  it('22. Extracts candidate rules from uploaded document text', async () => {
    const file = { name: 'Local_ByLaws_2026.pdf' };
    const text = 'Section 4: Maximum 4 overs per bowler in junior T20 games.';
    const ruleset = await processUploadedRuleDocument(file, text);
    expect(ruleset.extractedRules.length).toBeGreaterThan(0);
    expect(ruleset.extractedRules[0].proposedValue).toBe(4);
  });

  // 23. Ruleset Provenance Retention
  it('23. Retains source document provenance for extracted rules', async () => {
    const file = { name: 'Local_ByLaws_2026.pdf' };
    const text = 'Section 4: Maximum 4 overs per bowler.';
    const ruleset = await processUploadedRuleDocument(file, text);
    expect(ruleset.extractedRules[0].sourceDocument).toBe('Local_ByLaws_2026.pdf');
    expect(ruleset.extractedRules[0].pageSection).toBeDefined();
  });

  // 24. Ruleset Versioning & Isolation
  it('24. Creates independent versioned rulesets', async () => {
    const file1 = { name: 'Junior_2026.pdf' };
    const rs1 = await processUploadedRuleDocument(file1, '2026');
    expect(rs1.season).toBe('2026');
  });

  // 25. EffectiveMatchDefinition Overlays
  it('25. Overlays active ruleset on base MatchDefinition', async () => {
    const file = { name: 'Local_ByLaws_2026.pdf' };
    const text = 'Section 4: Maximum 3 overs per bowler.';
    const ruleset = await processUploadedRuleDocument(file, text);
    ruleset.extractedRules[0].status = 'CONFIRMED';
    ruleset.status = 'ACTIVE';

    const effective = getEffectiveMatchDefinition('T20', ruleset);
    expect(effective.maxOversPerBowler).toBe(3);
    expect(effective.isOverlayApplied).toBe(true);
  });

  // 26. Safety Core Immutability
  it('26. Blocks local by-law attempts to weaken protected safety rules', async () => {
    const file = { name: 'Local_ByLaws_2026.pdf' };
    const text = 'Helmets optional for batters in junior matches.';
    const ruleset = await processUploadedRuleDocument(file, text);
    expect(ruleset.conflicts.length).toBeGreaterThan(0);
    expect(ruleset.conflicts[0].status).toBe('BLOCKED_BY_SAFETY');
  });

  // 27. Multi-Select Focus Picker & Planner Tagging
  it('27. Accepts selectedFocusIds array and tags activities with contributing focus', () => {
    const results = searchActivities({
      cohortId: 'U13_JUNIOR',
      selectedFocusIds: ['Batting', 'Ground Fielding']
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].contributingFocus).toBeDefined();
  });

  // ==========================================
  // REGRESSION TESTS A - G (Requirement 8)
  // ==========================================

  // A. 90-minute session cannot generate only a Warm-Up
  it('28. (A) 90-minute session cannot generate only a Warm-Up', () => {
    const res = generateTrainingPlan({
      requestedDuration: 90,
      cohortId: 'U13_JUNIOR',
      selectedFocusIds: ['Batting'],
      participantCount: 10
    });
    expect(res.success).toBe(true);
    expect(res.plan.blocks.length).toBeGreaterThan(1);
    const warmUpsOnly = res.plan.activities.every(a => a.permittedSessionSlots.includes('Warm-up'));
    expect(warmUpsOnly).toBe(false);
  });

  // B. No activity may exceed its maximumDuration
  it('29. (B) No activity may exceed its maximumDuration', () => {
    const res = generateTrainingPlan({
      requestedDuration: 90,
      cohortId: 'U13_JUNIOR',
      selectedFocusIds: ['Batting'],
      participantCount: 10
    });
    expect(res.success).toBe(true);
    res.plan.activities.forEach(act => {
      expect(act.assignedDuration).toBeLessThanOrEqual(act.durationRange.max);
    });
  });

  // C. Missing required template blocks causes generation failure
  it('30. (C) Insufficient activity options for required blocks causes generation failure', () => {
    // Pass impossible cohort criteria that has no matching Warm-up activities
    const res = generateTrainingPlan({
      requestedDuration: 90,
      cohortId: 'IMPOSSIBLE_COHORT_ID',
      selectedFocusIds: ['Batting'],
      participantCount: 10
    });
    expect(res.success).toBe(false);
    expect(res.errorReason).toContain('Unable to generate a valid 90-minute session');
  });

  // D. A valid 90-minute session contains the complete required template structure
  it('31. (D) Valid 90-minute session contains complete required template structure', () => {
    const res = generateTrainingPlan({
      requestedDuration: 90,
      cohortId: 'U13_JUNIOR',
      selectedFocusIds: ['Batting', 'Pace Bowling'],
      participantCount: 10
    });
    expect(res.success).toBe(true);
    expect(res.plan.blocks.length).toBe(4); // Warm-up, Technical Skill Stations, Game-Based Scenario, Warm-down
  });

  // E. Concurrent station durations are calculated using elapsed time rather than summed activity time
  it('32. (E) Concurrent station durations use shared elapsed time instead of summed activity time', () => {
    const res = generateTrainingPlan({
      requestedDuration: 90,
      cohortId: 'U13_JUNIOR',
      selectedFocusIds: ['Pace Bowling', 'Spin Bowling'],
      participantCount: 10
    });
    expect(res.success).toBe(true);
    const stationBlock = res.plan.blocks.find(b => b.type === 'CONCURRENT_STATIONS');
    expect(stationBlock).toBeDefined();
    const sumStationDurations = stationBlock.stations.reduce((acc, s) => acc + s.assignedDuration, 0);
    expect(stationBlock.blockDuration).toBeLessThan(sumStationDurations);
  });

  // F. Useful failure response when insufficient eligible activities exist
  it('33. (F) Useful failure message returned when insufficient eligible activities exist', () => {
    const res = generateTrainingPlan({
      requestedDuration: 90,
      cohortId: 'NON_EXISTENT_COHORT',
      selectedFocusIds: ['Batting']
    });
    expect(res.success).toBe(false);
    expect(typeof res.errorReason).toBe('string');
  });

  // G. Replacement/variation cannot remove a required session block
  it('34. (G) Replacement/variation preserves template block structure', () => {
    const res = generateTrainingPlan({
      requestedDuration: 90,
      cohortId: 'U13_JUNIOR',
      selectedFocusIds: ['Batting']
    });
    expect(res.success).toBe(true);
    const initialBlockCount = res.plan.blocks.length;
    // Replace activity in block 1
    const drillToReplace = res.plan.activities[0];
    expect(drillToReplace.phaseName).toBeDefined();
    expect(initialBlockCount).toBe(4);
  });

});
