# ProgressPoint Backend

ProgressPoint Backend is a TypeScript/Node.js REST API for tracking workouts, managing users, and computing profile statistics. It uses Express 5, Prisma ORM, and PostgreSQL, with optional AWS S3 integration for user profile picture uploads. The service is containerized with Docker and includes an end‑to‑end Jest test setup.

## Overview
- **API**: Express 5 with modular routers
- **DB**: PostgreSQL via Prisma
- **Auth**: JWT (Bearer) middleware
- **Uploads**: AWS S3 (via `multer-s3`), with a dev/test memory fallback
- **Testing**: Jest + Supertest, thread‑safe Prisma setup
- **Runtime**: Node 20, TypeScript

## Tech Stack
- Node.js 20, TypeScript
- Express 5, CORS
- Prisma 6, PostgreSQL
- JWT (`jsonwebtoken`), `bcrypt`
- `multer` + `multer-s3` + AWS SDK v3
- Day.js for streak/date utilities
- Jest, ts‑jest, Supertest
- Docker Compose

## Project Structure
- App entry: [src/index.ts](src/index.ts)
- Express app: [src/app.ts](src/app.ts)
- Prisma client: [src/prisma.ts](src/prisma.ts), schema: [prisma/schema.prisma](prisma/schema.prisma)
- Routers:
	- Auth: [src/auth/auth.routes.ts](src/auth/auth.routes.ts) and controller [src/auth/auth.controller.ts](src/auth/auth.controller.ts)
	- User: [src/user/user.routes.ts](src/user/user.routes.ts) and controller [src/user/user.controller.ts](src/user/user.controller.ts)
	- Me: [src/me/me.routes.ts](src/me/me.routes.ts) and controller [src/me/me.controller.ts](src/me/me.controller.ts)
	- Exercises: [src/exercises/exercise.routes.ts](src/exercises/exercise.routes.ts) and controller [src/exercises/exercise.controller.ts](src/exercises/exercise.controller.ts)
	- Workout: [src/workout/workout.routes.ts](src/workout/workout.routes.ts) and controller [src/workout/workout.controller.ts](src/workout/workout.controller.ts)
- Middleware: [src/middleware/auth.middleware.ts](src/middleware/auth.middleware.ts)
- Utilities: JWT/Hash/Upload: [src/utils](src/utils)
- Tests: under `__tests__` folders with Jest config [jest.config.ts](jest.config.ts)

## Requirements
- Node.js >= 18 (recommended 20)
- PostgreSQL (local or via Docker Compose)
- AWS credentials for S3 (optional, required for actual uploads)

## Environment Variables
Use [\.env.example](.env.example) as the base. Copy and adjust:

```
cp .env.example .env
```

- `DATABASE_URL`: PostgreSQL connection string (Prisma datasource)
- `DB_PROVIDER`: Database provider (postgresql)
- `JWT_SECRET`: Secret used to sign/verify JWT tokens
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET`: Required to enable S3 uploads
- `PORT`: Server port (default 3000)
- `NODE_ENV`: Environment name

Note: For tests, Jest loads [\.env.test](.env.test). Docker Compose also references `DB_USER`, `DB_PASSWORD`, `DB_NAME` to provision the database container.

## Setup (Local)
1) Install dependencies

```bash
npm install
```

2) Generate Prisma client and apply schema

```bash
npx prisma generate
npx prisma db push
```

3) Seed example data (optional)

```bash
npm run prisma:seed
```

4) Run the server (development)

```bash
npm run dev
```

The server starts on `http://localhost:3000`. Health check: `GET /` returns "Server is running".

## Setup (Docker)
Bring up Postgres and the backend via Compose. The backend will generate Prisma client and push the schema on start.

```bash
docker compose up -d
```

Services:
- `db`: PostgreSQL 16 on port 5432
- `backend`: API on port 3000

Compose overrides `DATABASE_URL` to point to `db`. See [docker-compose.yml](docker-compose.yml) for details. The backend start command runs: `npx prisma generate && npx prisma db push --accept-data-loss && npm run dev`.

## Scripts
- `npm run dev`: Start TS dev server (`ts-node-dev`)
- `npm run build`: Compile TypeScript to `dist`
- `npm run start`: Run compiled server (`dist/index.js`)
- `npm test`: Run Jest tests
- `npm run prisma:seed`: Seed database via [prisma/seed.ts](prisma/seed.ts)
- `npm run prisma:test`: Generate Prisma client for a test schema (if present)

## Testing
Test DB service is defined in Compose (`db-test` on port 5433). Ensure it is running or provide your own `DATABASE_URL` compatible with `.env.test`.

```bash
# Start test database
docker compose up -d db-test

# Run tests
npm test
```

Jest setup file: [src/test/setupEnv.ts](src/test/setupEnv.ts) loads `.env.test`, generates Prisma client once per worker, and `db push`es the schema.

## CORS
The API enables CORS for the frontend origin `https://progresspoint.vercel.app/`. Adjust in [src/app.ts](src/app.ts) if needed.

## API Summary

Auth (`/auth`):
- `POST /auth/register` — body: `{ email, username, password }` → returns `{ user, token }`
- `POST /auth/login` — body: `{ email, password }` → returns `{ token }`

User (`/user`, requires `Authorization: Bearer <token>`):
- `PUT /user/username` — body: `{ newUsername }`
- `PUT /user/password` — body: `{ oldPassword, newPassword }`
- `POST /user/picture` — `multipart/form-data` file field: `picture` (S3 required in production)
- `GET /user/picture`
- `DELETE /user/picture`

Exercises (`/exercises`):
- `GET /exercises` — public list of exercises `{ id, name }`

Workout (`/workout`, requires `Authorization`):
- `POST /workout` — body:
	```json
	{
		"durationMinutes": 60,
		"note": "optional",
		"exercises": [
			{
				"exerciseId": "uuid",
				"order": 1,
				"sets": [ { "setNumber": 1, "repetitions": 10, "weight": 50 } ]
			}
		]
	}
	```
- `GET /workout?page=1&limit=10` — paginated workouts with nested exercises/sets
- `DELETE /workout` — body: `{ workoutId }`

Me (`/me`, requires `Authorization`):
- `GET /me` — user profile + statistics (streak, totals, favorite exercise)

## Database & Prisma
- Schema: [prisma/schema.prisma](prisma/schema.prisma)
- Generated client output: `generated/prisma`
- Useful commands:

```bash
npx prisma generate
npx prisma db push
npx prisma migrate dev   # if you maintain migrations
npm run prisma:seed
```

## AWS S3 Uploads
- If `AWS_*` vars and `AWS_S3_BUCKET` are set, uploads use S3 via `multer-s3`.
- Without S3, upload endpoints return a `503` to signal configuration is required.
- Deleting a profile picture attempts to remove the object from S3 when configured.

## Notes
- On startup, [src/index.ts](src/index.ts) validates `DATABASE_URL` and `JWT_SECRET`.
- Docker Compose backend uses `--accept-data-loss` with `prisma db push`. Avoid in production; prefer migrations.
- Health check: `GET /` → "Server is running".
- Update CORS origin as needed.

---

Maintainers can extend this README with detailed API schemas or OpenAPI docs as the project evolves.