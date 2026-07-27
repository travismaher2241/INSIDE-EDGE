# Inside Edge — Cricket Coaching Operating System

Inside Edge is a production-honest, privacy-focused, local-first React 19 application for cricket coaches, squad managers, and tactical analysts.

## Key Features

- **Local Workstation Privacy & Safety**: 100% offline-first architecture. All player medical notes are sanitized in storage with explicit application data reset controls.
- **Deterministic Training Planner Engine**:
  - **Standard Session Planner**: Multi-select tactical focus selection, station subgroup split (5-6 players per station for default 11 roster), scaled block durations (30 to 120 mins).
  - **Cricket Nets Session Planner**: Single-turn batting allocation architecture (no repeat batting turns), per-net sequential time validation, productive secondary target bowling assignments.
- **Cricket Match State Engine**:
  - Validated delivery schema, strike rotation, legal over calculations, extras penalty accounting (1 Wide = 1 extra run total).
  - Bowler conceded runs exclude Byes/Leg-byes. Illegal dismissals on No-Balls are rejected.
  - Automatic target score determination & chase completion summaries.
- **Local Competition By-Laws Engine**:
  - Ingests `.txt` and `.json` local ruleset specifications. Candidate rules are created as `PROPOSED` for coach review.
  - Immutable `SAFETY_FRAMEWORK` blocks activation of rulesets attempting to weaken helmet or player safety rules.
- **Safe Roster File Parsing**: Zero-dependency CSV/text roster importer validating name, jersey (1–999), role, and duplicate jerseys.
- **IndexedDB Video Analyser**: Video clips stored in local browser IndexedDB storage with stable object URL rehydration and clean memory revocation.

## Getting Started

### Prerequisites
- **Node.js**: v20 LTS (or v22)
- **npm**: v10+

### Installation & Execution

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Execute unit and integration test suite
npm run test

# Run Oxlint check (0 warnings threshold)
npm run lint

# Build production bundle
npm run build
```

## Architecture & Data Flow

```
[UI Layer: React 19 / Suspense]
       │
       ├──► SquadHub (Roster Management & Safe CSV Import)
       ├──► TrainingLab (Standard & Cricket Nets Session Planner)
       ├──► MatchDay (Cricket Match Engine & Live Scoreboard)
       ├──► TacticsBoard (11 Fielder + 2 Batter Accessible Board)
       └──► VideoAnalyser (IndexedDB Media Storage)
       │
[Core Engines]
       ├──► deterministicPlanner & cricketNetsPlanner
       ├──► cricketMatchEngine
       └──► competitionRulesEngine & SAFETY_FRAMEWORK
       │
[Storage & Security Layer]
       ├──► storage.js (safeStorageGet / safeStorageSet with encryption)
       ├──► dbStorage.js (IndexedDB Binary Media Store)
       └──► syncService.js (Local Transaction Ledger)
```
