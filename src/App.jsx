import React, { useState, useEffect, lazy, Suspense } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import AuthScreen from './screens/AuthScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import SettingsModal from './components/SettingsModal';
import LocalRulesReviewModal from './components/LocalRulesReviewModal';
import { DEFAULT_ROSTER } from './data/defaultRoster';
import { getEffectiveMatchDefinition } from './services/competitionRulesEngine';
import { getSyncQueue, queueSyncTransaction, clearSyncQueue } from './services/syncService';
import { 
  safeStorageGet, 
  safeStorageSet, 
  safeStorageRemove,
  sanitizeRosterForStorage, 
  unmaskRosterFromStorage,
  clearAllLocalApplicationData 
} from './services/storage';

// Lazy Loaded Feature Tab Components for Code Splitting & Performance
const SquadHub = lazy(() => import('./components/SquadHub'));
const TrainingLab = lazy(() => import('./components/TrainingLab'));
const TacticsBoard = lazy(() => import('./components/TacticsBoard'));
const MatchDay = lazy(() => import('./components/MatchDay'));
const VideoAnalyser = lazy(() => import('./components/VideoAnalyser'));

export default function App() {
  return (
    <ErrorBoundary>
      <MainAppContent />
    </ErrorBoundary>
  );
}

function MainAppContent() {
  // Auth & Onboarding State
  const [user, setUser] = useState(() => safeStorageGet('user', null));
  const [isOnboarded, setIsOnboarded] = useState(() => safeStorageGet('onboarded', false));

  // Coach Onboarding Profile
  const [coachProfile, setCoachProfile] = useState(() => safeStorageGet('coach_profile', {
    coachName: 'Head Coach',
    teamName: 'Westside Cricket Club XI',
    selectedCohort: 'U13_JUNIOR',
    selectedCoachLevel: 'DEVELOPMENT_LEVEL_1'
  }));

  // Active Tab Index (0: Squad, 1: Training, 2: Tactics, 3: Match Day, 4: Video)
  const [activeTab, setActiveTab] = useState(0);

  // Global Squad Roster (With Privacy Unmasking)
  const [squad, setSquad] = useState(() => {
    const raw = safeStorageGet('squad', null);
    return raw ? unmaskRosterFromStorage(raw) : DEFAULT_ROSTER;
  });

  // Global Video Clips
  const [videoClips, setVideoClips] = useState(() => safeStorageGet('videoclips', []));

  // Settings & Parameters
  const [subscriptionTier, setSubscriptionTier] = useState(() => safeStorageGet('tier', 'Workstation Pro'));
  const [selectedCoachLevel, setSelectedCoachLevel] = useState(() => safeStorageGet('coach_level', 'DEVELOPMENT_LEVEL_1'));
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Local Competition Ruleset State
  const [activeRuleset, setActiveRuleset] = useState(() => safeStorageGet('active_ruleset', null));
  const [isRulesReviewOpen, setIsRulesReviewOpen] = useState(false);

  // Offline Sync Queue State
  const [syncQueue, setSyncQueueState] = useState(() => getSyncQueue());

  // Persistence Effects (Using safeStorageSet)
  useEffect(() => {
    if (user) safeStorageSet('user', user);
    else safeStorageRemove('user');
  }, [user]);

  useEffect(() => {
    safeStorageSet('onboarded', isOnboarded);
  }, [isOnboarded]);

  useEffect(() => {
    safeStorageSet('coach_profile', coachProfile);
  }, [coachProfile]);

  useEffect(() => {
    const sanitized = sanitizeRosterForStorage(squad);
    safeStorageSet('squad', sanitized);
  }, [squad]);

  useEffect(() => {
    safeStorageSet('videoclips', videoClips);
  }, [videoClips]);

  useEffect(() => {
    safeStorageSet('tier', subscriptionTier);
  }, [subscriptionTier]);

  useEffect(() => {
    safeStorageSet('coach_level', selectedCoachLevel);
  }, [selectedCoachLevel]);

  useEffect(() => {
    if (activeRuleset) {
      safeStorageSet('active_ruleset', activeRuleset);
    }
  }, [activeRuleset]);

  // Player Roster Handlers
  const handleAddPlayer = (newPlayer) => {
    const player = { ...newPlayer, id: 'p_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6) };
    setSquad(prev => [...prev, player]);
    queueSyncTransaction('ADD_PLAYER', player);
    setSyncQueueState(getSyncQueue());
  };

  const handleEditPlayer = (id, updatedFields) => {
    setSquad(prev => prev.map(p => p.id === id ? { ...p, ...updatedFields } : p));
    queueSyncTransaction('EDIT_PLAYER', { id, ...updatedFields });
    setSyncQueueState(getSyncQueue());
  };

  const handleImportPlayers = (newPlayers) => {
    const withIds = newPlayers.map((p, idx) => ({ ...p, id: 'p_' + Date.now() + '_' + idx }));
    setSquad(prev => [...prev, ...withIds]);
    queueSyncTransaction('IMPORT_PLAYERS', { count: withIds.length });
    setSyncQueueState(getSyncQueue());
  };

  const handleRemovePlayer = (id) => {
    setSquad(prev => prev.filter(p => p.id !== id));
    queueSyncTransaction('REMOVE_PLAYER', { id });
    setSyncQueueState(getSyncQueue());
  };

  const handleSaveVideoClip = (newClip) => {
    setVideoClips(prev => [newClip, ...prev]);
    queueSyncTransaction('SAVE_VIDEO_CLIP', { clipId: newClip.id });
    setSyncQueueState(getSyncQueue());
  };

  const handleLogout = () => {
    setUser(null);
  };

  const handleResetApplicationData = () => {
    if (window.confirm("Are you sure you want to reset all local application data?")) {
      clearAllLocalApplicationData();
      clearSyncQueue();
      setUser(null);
      setIsOnboarded(false);
      setSquad(DEFAULT_ROSTER);
      setVideoClips([]);
      setActiveRuleset(null);
      window.location.reload();
    }
  };

  // Auth Protection Gate
  if (!user) {
    return (
      <AuthScreen 
        onLoginSuccess={(userData) => setUser(userData)} 
        onEnableTesterAccess={() => {
          setUser({ uid: 'tester_01', email: 'tester@insideedge.org', name: 'Tester Coach', isTester: true });
          setIsOnboarded(true);
        }}
      />
    );
  }

  // Onboarding Wizard Gate
  if (!isOnboarded) {
    return (
      <OnboardingScreen 
        onCompleteOnboarding={(data) => {
          setCoachProfile(data);
          setSelectedCoachLevel(data.selectedCoachLevel);
          setIsOnboarded(true);
        }}
      />
    );
  }

  const effectiveMatchDef = getEffectiveMatchDefinition('T20', activeRuleset);

  return (
    <div className="app-container">
      {/* Top Command Bar */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.3rem' }}>🏏</span>
          <span className="scoreboard-font" style={{ color: 'var(--text-primary)', fontSize: '1.2rem' }}>
            INSIDE EDGE
          </span>
          <span className="badge" style={{ background: 'var(--color-training-glow)', color: 'var(--color-training)' }}>
            LOCAL WORKSTATION
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            👤 {coachProfile.coachName} ({coachProfile.teamName})
          </span>

          {activeRuleset && (
            <button 
              type="button"
              className="badge badge-ruleset" 
              onClick={() => setIsRulesReviewOpen(true)}
              style={{ cursor: 'pointer', border: 'none' }}
              aria-label="View Active Ruleset Details"
            >
              📜 {activeRuleset.season} Rules Active
            </button>
          )}

          <button 
            type="button"
            className="icon-btn" 
            onClick={() => setIsSettingsOpen(true)} 
            aria-label="Application Settings"
          >
            ⚙️
          </button>

          <button 
            type="button"
            className="btn btn-secondary" 
            onClick={handleLogout}
            style={{ fontSize: '0.75rem', padding: '4px 8px' }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Feature View with Suspense Lazy Loading */}
      <main className="tab-content">
        <Suspense fallback={
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading Workstation Module...
          </div>
        }>
          {activeTab === 0 && (
            <SquadHub 
              squad={squad}
              onAddPlayer={handleAddPlayer}
              onEditPlayer={handleEditPlayer}
              onImportPlayers={handleImportPlayers}
              onRemovePlayer={handleRemovePlayer}
              videoClips={videoClips}
            />
          )}

          {activeTab === 1 && (
            <TrainingLab 
              squad={squad}
              subscriptionTier={subscriptionTier}
              selectedCoachLevel={selectedCoachLevel}
              activeRuleset={activeRuleset}
              onSaveVideoClip={handleSaveVideoClip}
            />
          )}

          {activeTab === 2 && (
            <TacticsBoard 
              squad={squad}
              subscriptionTier={subscriptionTier}
              activeMatchDef={effectiveMatchDef}
            />
          )}

          {activeTab === 3 && (
            <MatchDay 
              squad={squad}
              activeMatchDef={effectiveMatchDef}
              activeRuleset={activeRuleset}
              onSaveVideoClip={handleSaveVideoClip}
            />
          )}

          {activeTab === 4 && (
            <VideoAnalyser 
              squad={squad}
              videoClips={videoClips}
              setVideoClips={setVideoClips}
              activeRuleset={activeRuleset}
            />
          )}
        </Suspense>
      </main>

      {/* Bottom Navigation Tab Bar */}
      <nav className="bottom-nav" aria-label="Main Navigation">
        <button 
          type="button"
          className={`nav-item ${activeTab === 0 ? 'active-0' : ''}`} 
          onClick={() => setActiveTab(0)}
          aria-label="Squad Hub Tab"
        >
          <span>👥</span>
          <span>Squad</span>
        </button>
        <button 
          type="button"
          className={`nav-item ${activeTab === 1 ? 'active-1' : ''}`} 
          onClick={() => setActiveTab(1)}
          aria-label="Training Lab Tab"
        >
          <span>⚡</span>
          <span>Training</span>
        </button>
        <button 
          type="button"
          className={`nav-item ${activeTab === 2 ? 'active-2' : ''}`} 
          onClick={() => setActiveTab(2)}
          aria-label="Tactics Board Tab"
        >
          <span>📋</span>
          <span>Tactics</span>
        </button>
        <button 
          type="button"
          className={`nav-item ${activeTab === 3 ? 'active-3' : ''}`} 
          onClick={() => setActiveTab(3)}
          aria-label="Match Day Tab"
        >
          <span>🏏</span>
          <span>Match Day</span>
        </button>
        <button 
          type="button"
          className={`nav-item ${activeTab === 4 ? 'active-4' : ''}`} 
          onClick={() => setActiveTab(4)}
          aria-label="Video Analyser Tab"
        >
          <span>📹</span>
          <span>Video</span>
        </button>
      </nav>

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        subscriptionTier={subscriptionTier}
        setSubscriptionTier={setSubscriptionTier}
        selectedCoachLevel={selectedCoachLevel}
        setSelectedCoachLevel={setSelectedCoachLevel}
        syncQueue={syncQueue}
        clearSyncQueue={() => {
          clearSyncQueue();
          setSyncQueueState([]);
        }}
        onResetData={handleResetApplicationData}
        activeRuleset={activeRuleset}
        onRulesetCreated={(rs) => setActiveRuleset(rs)}
        onOpenRulesReview={() => setIsRulesReviewOpen(true)}
      />

      {/* Local Rules Review Modal */}
      <LocalRulesReviewModal 
        isOpen={isRulesReviewOpen}
        onClose={() => setIsRulesReviewOpen(false)}
        activeRuleset={activeRuleset}
        onApproveRule={(ruleId) => {
          if (!activeRuleset) return;
          const updated = {
            ...activeRuleset,
            extractedRules: activeRuleset.extractedRules.map(r => r.ruleId === ruleId ? { ...r, status: 'CONFIRMED' } : r)
          };
          setActiveRuleset(updated);
        }}
        onRejectRule={(ruleId) => {
          if (!activeRuleset) return;
          const updated = {
            ...activeRuleset,
            extractedRules: activeRuleset.extractedRules.map(r => r.ruleId === ruleId ? { ...r, status: 'REJECTED' } : r)
          };
          setActiveRuleset(updated);
        }}
        onActivateRuleset={() => {
          if (!activeRuleset) return;
          setActiveRuleset({ ...activeRuleset, status: 'ACTIVE' });
          setIsRulesReviewOpen(false);
        }}
      />
    </div>
  );
}
