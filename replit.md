# Chess Master - Special Rules Edition

## Overview

This is a full-stack chess application built with React frontend and Express backend, featuring multiple chess variants including King of the Hill, Atomic Chess, Three-Check, and Fischer Random. The application uses TypeScript throughout the stack and implements a modern web architecture with PostgreSQL database integration via Drizzle ORM.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter for client-side routing
- **UI Components**: Extensive use of Radix UI primitives via shadcn/ui
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Session Management**: Express sessions with PostgreSQL store
- **API Design**: RESTful endpoints for game management

### Development Setup
- **Monorepo Structure**: Shared schema and types across frontend/backend
- **Hot Reload**: Vite dev server with HMR
- **Type Safety**: Shared TypeScript definitions in `/shared` directory

## Key Components

### Database Schema (`shared/schema.ts`)
- **Users Table**: Player authentication and profiles
- **Games Table**: Game state, rules, players, and metadata
- **Moves Table**: Complete move history with FEN notation
- **Type Safety**: Zod schemas for validation and type inference

### Game Logic (`client/src/lib/chess-logic.ts`)
- **Move Validation**: Complete chess rule implementation
- **Piece Movement**: Individual piece logic for all chess pieces
- **Check Detection**: King safety validation
- **Special Moves**: Castling, en passant, pawn promotion

### Special Rules Engine (`client/src/lib/chess-rules.ts`)
- **King of the Hill**: Win condition when king reaches center
- **Atomic Chess**: Explosive captures affecting adjacent pieces
- **Three-Check**: Alternative win condition via repeated checks
- **Fischer Random**: Randomized back-rank starting positions

### UI Components
- **ChessBoard**: Interactive 8x8 grid with piece rendering
- **GameStatus**: Real-time game information and rule displays
- **MoveHistory**: Complete game notation with navigation
- **RuleSelectionModal**: Game variant selection interface

## Data Flow

### Game Creation Flow
1. User selects game rules via RuleSelectionModal
2. Frontend sends POST request to `/api/games`
3. Backend validates rules and creates game record
4. Initial game state stored in PostgreSQL
5. Frontend updates with new game ID and starts polling

### Move Processing Flow
1. User clicks chess board squares
2. Chess logic validates move legality
3. Special rules engine applies variant-specific effects
4. Move posted to `/api/games/:id/moves`
5. Backend updates game state and move history
6. Frontend refetches updated game state

### State Synchronization
- TanStack Query manages server state caching
- Optimistic updates for immediate UI feedback
- Background refetching ensures data consistency
- Error boundaries handle network failures gracefully

## External Dependencies

### Core Framework Dependencies
- **@tanstack/react-query**: Server state management and caching
- **wouter**: Lightweight client-side routing
- **drizzle-orm**: Type-safe database ORM
- **@neondatabase/serverless**: PostgreSQL database driver

### UI and Styling
- **@radix-ui/***: Accessible primitive components
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Component variant management
- **lucide-react**: Icon library

### Development Tools
- **vite**: Build tool and dev server
- **tsx**: TypeScript execution for server
- **esbuild**: Fast JavaScript bundler

## Deployment Strategy

### Build Process
- **Frontend**: Vite builds optimized React application
- **Backend**: esbuild bundles Express server with external packages
- **Database**: Drizzle migrations manage schema changes

### Production Configuration
- **Environment Variables**: DATABASE_URL for PostgreSQL connection
- **Static Assets**: Frontend builds to `dist/public`
- **Server Bundle**: Backend builds to `dist/index.js`

### Database Requirements
- PostgreSQL database with connection pooling
- Drizzle migrations applied via `npm run db:push`
- Session storage configured for user management

## Adding New Game Modes

### Server-Side Implementation Guide

When adding new game modes, follow this centralized approach:

1. **Update Shared Schema** (`shared/schema.ts`):
   - Add new rule to `GameRules` type
   - Add any required state tracking to `ChessGameState`

2. **Server Logic** (`server/routes.ts`):
   - Add validation logic to `getPossibleMoves()` function
   - Add state tracking logic to `applyAllSpecialRules()` function
   - Create dedicated `apply[RuleName]Rule()` function
   - Add rule case to switch statement in `applyAllSpecialRules()`

3. **Client Logic** (`client/src/lib/chess-logic.ts`):
   - Add validation logic to piece movement functions
   - Update `chess-rules.ts` with rule-specific logic

4. **UI Components** (`client/src/components/rule-selection-modal.tsx`):
   - Add rule description and badges

5. **Storage** (`server/storage.ts`):
   - Initialize rule state in `getInitialGameState()`

### Example Implementation Pattern:

```typescript
// In server/routes.ts
function applyNewRuleRule(gameState: any, fromSquare: string, toSquare: string, piece: any): any {
  // Rule-specific state tracking logic
  return gameState;
}

// Add to applyAllSpecialRules switch statement:
case 'new-rule':
  newGameState = applyNewRuleRule(newGameState, fromSquare, toSquare, piece);
  break;
```

## Changelog

```
Changelog:
- July 01, 2025. Initial setup
- July 02, 2025. Successfully implemented X-ray Bishop rule with full validation
  * Bishops can move through one piece and continue beyond it
  * Proper check/checkmate detection with X-ray attacks
  * Server-side validation prevents illegal moves under X-ray attack
  * Interface fully localized in Russian
- July 02, 2025. Completed PawnRotation + PawnWall combination mode
  * PawnRotation mode allows unlimited double moves (forward and horizontal)
  * PawnWall creates double rows of pawns on 2-3 ranks (white) and 6-7 ranks (black)
  * Combined mode works correctly with all pawn movement capabilities
  * Fixed double move restrictions to work properly in rotation mode
  * Updated descriptions to accurately reflect unlimited movement abilities
- July 02, 2025. Fixed critical bug preventing pieces from capturing themselves
  * Added client-side validation to prevent capturing own pieces
  * Added server-side validation for basic move validation
  * Improved error handling and move validation pipeline
  * Applied classic green chess board design with proper piece colors
- July 03, 2025. Implemented Blink mode and centralized rule system
  * Added Blink mode: King can teleport once per game to any legal square
  * Created centralized server-side rule processing system
  * All game modes now properly tracked on server: double-knight, pawn-rotation, xray-bishop, pawn-wall, blink
  * Unified rule application through applyAllSpecialRules function
  * Added comprehensive documentation for future rule additions
- July 03, 2025. Fixed X-ray Bishop rule affecting Queen incorrectly
  * X-ray Bishop effect now applies only to bishops, not queens
  * Queens maintain standard movement without X-ray penetration
  * Fixed both client-side and server-side logic for proper rule isolation
  * Added PostgreSQL database for multiple concurrent games support
- July 03, 2025. Implemented complete guest authentication system and passed full stress test
  * Fixed Express session conflicts by removing session middleware 
  * Implemented localStorage-based guest user management
  * Guest users are randomly selected from 50 pre-made accounts (guest1-guest50)
  * Successfully tested with 10 concurrent guest users and 5 simultaneous games
  * All game modes tested: standard, blink, double-knight + pawn-rotation, xray-bishop + pawn-wall
  * Multiplayer game joining and real-time synchronization working perfectly
- July 04, 2025. Fixed Blink mode mechanics and improved real-time performance
  * Fixed Blink mode castling logic: rook castling and Blink teleport are separate mechanics  
  * King loses castling rights after any move (standard chess rules)
  * Only actual teleport moves (not castling) are marked as Blink usage
  * Improved multiplayer responsiveness: reduced polling interval from 3s to 0.5s
  * Real-time game state updates now occur every 500ms for smoother gameplay
- July 04, 2025. Perfected PawnRotation mode with unlimited double moves
  * Fixed Blink distance calculation: only moves >1 square count as teleportation
  * Normal king moves (1 square) preserve Blink ability, only teleportation uses it
  * PawnRotation mode: pawns ALWAYS have double move capability (horizontal/vertical)
  * Removed movement history restrictions in PawnRotation - any pawn can double move anytime
  * Both client-side and server-side logic updated for consistent behavior
  * Fixed castling in Blink mode: castling no longer consumes Blink charge
  * Only true teleportation (non-castling moves >1 square) marks Blink as used
  * Fixed en passant captures: captured pawn now properly removed from board
  * Corrected horizontal en passant logic to remove pawn from "jumped over" square
  * Fixed client-side en passant detection: added support for horizontal captures in PawnRotation mode
- July 04, 2025. Enhanced horizontal en passant debugging and logic refinement
  * Added comprehensive debugging logs for horizontal en passant detection
  * Improved client-side captured pawn lookup logic for horizontal en passant
  * Fixed search algorithm to properly find adjacent pawns on same rank
  * Vertical en passant confirmed working correctly, focusing on horizontal edge cases
  * Ready for final testing of horizontal double moves and subsequent en passant captures
- July 04, 2025. Major code simplification and deduplication
  * Created shared chess utilities module (shared/chess-utils.ts) for common logic
  * Simplified client-side chess-logic.ts from 800+ lines to 32 lines
  * Simplified server-side routes.ts from 1000+ lines to 350 lines
  * Removed duplicate move validation, board analysis, and piece movement code
  * Centralized all chess rule logic in shared module for consistency
  * Enhanced draw offer system with confirmation dialogs and proper state management
  * Fixed database schema type issues and improved error handling
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```