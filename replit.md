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
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```