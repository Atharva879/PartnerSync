# Partner Sync - Mobile App Design

## Overview
Partner Sync is a private communication and task management app for two partners. It features end-to-end encrypted messaging, shared to-do lists, and a goal completion rate calculator to track progress together.

---

## Screen List

1. **Auth Screen** - Login/signup with email or OAuth
2. **Partner Connection** - Invite or accept partner invitation
3. **Chat Screen** - End-to-end encrypted messaging
4. **Tasks Screen** - Shared to-do list with completion tracking
5. **Goals Screen** - Goal completion rate calculator and analytics
6. **Settings Screen** - Profile, encryption keys, app settings

---

## Primary Content and Functionality

### Auth Screen
- Email/password signup and login
- OAuth integration (Google/Apple)
- Session persistence with secure token storage

### Partner Connection Screen
- Display unique partner code to share
- Input field to enter partner's code
- Connection status indicator
- Ability to disconnect and reconnect

### Chat Screen
- Message list with timestamps
- End-to-end encrypted message input
- Message status indicators (sent, delivered, read)
- Typing indicator
- Message search capability
- Auto-scroll to latest message

### Tasks Screen
- Shared to-do list (both partners see same list)
- Add/edit/delete tasks
- Mark tasks as complete
- Task priority levels (Low, Medium, High)
- Due date assignment
- Task filtering (All, Active, Completed)
- Completion count display

### Goals Screen
- Create goals with target completion rates
- Track completed tasks against goals
- Visual progress indicators (percentage)
- Goal history and statistics
- Completion rate calculator showing:
  - Total tasks created
  - Tasks completed
  - Completion percentage
  - Trend analysis

### Settings Screen
- User profile display
- Partner information
- App theme toggle (light/dark)
- Notification preferences
- Logout option
- About section

---

## Key User Flows

### Flow 1: Initial Setup
1. User launches app → Auth Screen
2. User signs up/logs in
3. User enters Partner Connection screen
4. User shares unique code with partner OR enters partner's code
5. Connection established → Redirected to Chat screen

### Flow 2: Messaging
1. User navigates to Chat tab
2. User types message
3. Message is encrypted locally before sending
4. Message appears in chat with "sent" status
5. Partner receives and decrypts message
6. Message status updates to "delivered"

### Flow 3: Task Management
1. User navigates to Tasks tab
2. User taps "Add Task" button
3. User enters task title, priority, due date
4. Task appears in shared list
5. Partner sees task in real-time
6. Either user can mark task complete
7. Completion count updates automatically

### Flow 4: Goal Tracking
1. User navigates to Goals tab
2. User views completion rate statistics
3. User can create new goals with target rates
4. System calculates: (completed tasks / total tasks) × 100
5. User sees visual progress bar
6. User can view historical trends

---

## Color Choices

- **Primary**: #0a7ea4 (Professional Blue) - Main actions, highlights
- **Background**: #ffffff (Light) / #151718 (Dark) - Screen backgrounds
- **Surface**: #f5f5f5 (Light) / #1e2022 (Dark) - Cards, elevated surfaces
- **Foreground**: #11181C (Light) / #ECEDEE (Dark) - Primary text
- **Muted**: #687076 (Light) / #9BA1A6 (Dark) - Secondary text
- **Success**: #22C55E - Task completion, success states
- **Error**: #EF4444 - Errors, warnings
- **Border**: #E5E7EB (Light) / #334155 (Dark) - Dividers

---

## Technical Architecture

### Data Storage
- **Local**: AsyncStorage for user preferences, theme
- **Encrypted**: End-to-end encrypted messages stored locally
- **Server**: User accounts, partner connections, task sync

### Encryption
- Use TweetNaCl.js or libsodium for E2E encryption
- Each message encrypted with shared secret key
- Keys stored securely in device keychain

### Real-time Sync
- WebSocket connection for live message delivery
- Polling fallback for task updates
- Conflict resolution for simultaneous edits

### State Management
- React Context + useReducer for global state
- AsyncStorage for persistence
- TanStack Query for server data

---

## Design Principles

1. **Privacy First**: All messages encrypted end-to-end
2. **Simplicity**: Minimal UI, focus on core features
3. **Responsiveness**: Instant feedback on user actions
4. **Accessibility**: Clear typography, sufficient contrast
5. **Consistency**: Unified design across all screens
