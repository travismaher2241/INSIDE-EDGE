import React, { useState, useEffect } from 'react';
import AuthScreen from './screens/AuthScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import SquadHub from './components/SquadHub';
import TrainingLab from './components/TrainingLab';
import TacticsBoard from './components/TacticsBoard';
import MatchDay from './components/MatchDay';
import VideoAnalyser from './components/VideoAnalyser';
import SettingsModal from './components/SettingsModal';
import LocalRulesReviewModal from './components/LocalRulesReviewModal';
import { DEFAULT_ROSTER } from './data/defaultRoster';
import { getEffectiveMatchDefinition } from './services/competitionRulesEngine';
import { getSyncQueue, saveSyncQueue, queueSyncTransaction, flushSyncQueue } from './services/syncService';

export default function App() {
  // Auth & Onboarding State
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('insideedge_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [isOnboarded, setIsOnboarded] = useState(() => {
    return localStorage.getItem('insideedge_onboarded') === 'true';
  });

  // Active Tab Index (0: Squad, 1: Training, 2: Tactics, 3: Match Day, 4: Video)
  const [activeTab, setActiveTab] = useState(0);

  // Global Squad Roster
  const [squad, setSquad] = useState(() => {
    const saved = localStorage.getItem('insideedge_squad');
    return saved ? JSON.parse(saved) : DEFAULT_ROSTER;
  });

  // Global Video Clips
  const [videoClips, setVideoClips] = useState(() => {
    const saved = localStorage.getItem('insideedge_videoclips');
    return saved ? JSON.parse(saved) : [];
  });

  // Settings & Integrations
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('insideedge_api_key') || '');
  const [subscriptionTier, setSubscriptionTier] = useState(() => localStorage.getItem('insideedge_tier') || 'Ultra');
  const [selectedCoachLevel, setSelectedCoachLevel] = useState(() => localStorage.getItem('insideedge_coach_level') || 'DEVELOPMENT_LEVEL_1');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Local Competition Ruleset State
  const [activeRuleset, setActiveRuleset] = useState(() => {
    const saved = localStorage.getItem('insideedge_active_ruleset');
    return saved ? JSON.parse(saved) : null;
  });

  const [isRulesReviewOpen, setIsRulesReviewOpen] = useState(false);

  // Connection & Offline Sync
  const [isOnline, setIsOnline] = useState(true);
  const [syncQueue, setSyncQueueState] = useState(() => getSyncQueue());

  // Persistence Effects
  useEffect(() => {
    if (user) localStorage.setItem('insideedge_user', JSON.stringify(user));
    else localStorage.removeItem('insideedge_user');
  }, [user]);

  useEffect(() => {
    localStorage.setItem('insideedge_onboarded', isOnboarded.toString());
  }, [isOnboarded]);

  useEffect(() => {
    localStorage.setItem('insideedge_squad', JSON.stringify(squad));
  }, [squad]);

  useEffect(() => {
    localStorage.setItem('insideedge_videoclips', JSON.stringify(videoClips));
  }, [videoClips]);

  useEffect(() => {
    localStorage.setItem('insideedge_api_key', apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem('insideedge_tier', subscriptionTier);
  }, [subscriptionTier]);

  useEffect(() => {
    localStorage.setItem('insideedge_coach_level', selectedCoachLevel);
  }, [selectedCoachLevel]);

  useEffect(() => {
    if (activeRuleset) {
      localStorage.setItem('insideedge_active_ruleset', JSON.stringify(activeRuleset));
    }
  }, [activeRuleset]);

  // Player Handlers
  const handleAddPlayer = (newPlayer) => {
    const player = { ...newPlayer, id: 'p_' + Date.now() };
    setSquad(prev => [...prev, player]);
    queueSyncTransaction('ADD_PLAYER', player);
    setSyncQueueState(getSyncQueue());
  };

  const handleEditPlayer = (id, updatedFields) => {
    setSquad(prev => prev.map(p => p.id === id ? { ...p, ...updatedFields } : p));
  };

  const handleImportPlayers = (newPlayers) => {
    const withIds = newPlayers.map((p, idx) => ({ ...p, id: 'p_' + Date.now() + '_' + idx }));
    setSquad(prev => [...prev, ...withIds]);
  };

  const handleRemovePlayer = (id) => {
    setSquad(prev => prev.filter(p => p.id !== id));
  };

  const handleSaveVideoClip = (newClip) => {
    setVideoClips(prev => [newClip, ...prev]);
  };

  // Auth Protection Gate
  if (!user) {
    return (
      <AuthScreen 
        onLoginSuccess={(userData) => setUser(userData)} 
        onEnableTesterAccess={() => {
          setUser({ uid: 'tester_01', email: 'tester@insideedge.org', name: 'Tester Coach' });
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
            CRICKET
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Active Ruleset Indicator Badge */}
          {activeRuleset && (
            <button 
              className="badge badge-ruleset" 
              onClick={() => setIsRulesReviewOpen(true)}
              style={{ cursor: 'pointer', border: 'none' }}
            >
              📜 {activeRuleset.season} Rules Active
            </button>
          )}

          {/* Tier Simulation Badge */}
          <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-match)' }}>
            {subscriptionTier} TIER
          </span>

          {/* Settings Trigger */}
          <button className="icon-btn" onClick={() => setIsSettingsOpen(true)} aria-label="Settings">
            ⚙️
          </button>
        </div>
      </header>

      {/* Main Feature View */}
      <main className="tab-content">
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
            apiKey={apiKey}
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
      </main>

      {/* Bottom Navigation Tab Bar */}
      <nav className="bottom-nav">
        <button className={`nav-item ${activeTab === 0 ? 'active-0' : ''}`} onClick={() => setActiveTab(0)}>
          <span>👥</span>
          <span>Squad</span>
        </button>
        <button className={`nav-item ${activeTab === 1 ? 'active-1' : ''}`} onClick={() => setActiveTab(1)}>
          <span>⚡</span>
          <span>Training</span>
        </button>
        <button className={`nav-item ${activeTab === 2 ? 'active-2' : ''}`} onClick={() => setActiveTab(2)}>
          <span>📋</span>
          <span>Tactics</span>
        </button>
        <button className={`nav-item ${activeTab === 3 ? 'active-3' : ''}`} onClick={() => setActiveTab(3)}>
          <span>🏏</span>
          <span>Match Day</span>
        </button>
        <button className={`nav-item ${activeTab === 4 ? 'active-4' : ''}`} onClick={() => setActiveTab(4)}>
          <span>📹</span>
          <span>Video</span>
        </button>
      </nav>

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKey={apiKey}
        setApiKey={setApiKey}
        subscriptionTier={subscriptionTier}
        setSubscriptionTier={setSubscriptionTier}
        selectedCoachLevel={selectedCoachLevel}
        setSelectedCoachLevel={setSelectedCoachLevel}
        syncQueue={syncQueue}
        clearSyncQueue={() => {
          saveSyncQueue([]);
          setSyncQueueState([]);
        }}
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
