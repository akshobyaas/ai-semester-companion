# AI Semester Companion

An AI-powered study companion. Upload your syllabus and course notes, and it
builds you a personalized learning roadmap, generates quizzes and flashcards
from your own material, tracks your progress, and answers doubts grounded in
what you actually uploaded — not generic web knowledge.

## Features

- **Course roadmap generation** — upload a syllabus, notes, and past papers; get back a structured unit-by-unit, topic-by-topic study path with difficulty and time estimates
- **AI-generated lessons** — each topic gets an explanation, key points, worked examples, and memory aids, grounded in your uploaded material via retrieval-augmented generation
- **Adaptive quizzes** — auto-generated from a topic's content, with instant scoring and per-question feedback
- **Flashcards** — spaced-repetition review (SM-2 algorithm) generated from your course content
- **Revision notes** — on-demand cheat sheets, formula sheets, and exam summaries
- **Doubt solving** — ask questions in natural language, answered from your own uploaded material with cited sources
- **Progress analytics** — completion tracking, score history, and weak/strong area breakdown per course

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, React Router, Zustand, Tailwind CSS |
| Backend | Node.js, Express |
| Database | MongoDB (Mongoose) |
| Cache | Redis (LLM response caching) |
| AI | OpenAI (chat + embeddings via local sentence-transformer model) |
| Auth | JWT + bcrypt |
| Containerization | Docker, Docker Compose (separate dev and production configs) |

## Quick start (development)

```bash
cp server/.env.example server/.env
# add your OPENAI_API_KEY

docker-compose -f docker-compose.dev.yml up --build
```

- App: http://localhost:5173
- API: http://localhost:8000/api/health

The dev stack runs with hot reload on both the client and server.

## Quick start (production)

```bash
cp server/.env.example server/.env
docker-compose up --build
```

- App: http://localhost

Production images are built via multi-stage Dockerfiles (build tooling never
ships in the final image), with healthchecks and proper startup ordering
across all four services (MongoDB, Redis, the API, and the client).

## Running tests

```bash
cd server
npm install
npm test
```

## Project structure

```
server/
  src/
    agents/       AI orchestration — one module per task (teaching, quiz
                   generation, evaluation, doubt-answering, adaptive
                   recommendations, roadmap generation, etc.)
    models/       Mongoose schemas
    routes/       Express route handlers
    services/     LLM calls, embeddings, vector search, file parsing
    middleware/   Auth, file upload
  tests/          Jest + Supertest

client/
  src/
    pages/        One component per route
    components/   Shared UI (app shell / navigation)
    api/          Axios client
    store/        Zustand global state
    hooks/        Shared React hooks

docker-compose.dev.yml    Local development (hot reload, bind mounts)
docker-compose.yml        Production (built images, healthchecks, no bind mounts)
```

## Architecture notes

- **Retrieval**: course documents are chunked, embedded with a local
  sentence-transformer model, and stored in MongoDB. Retrieval is an exact
  cosine-similarity search scoped per course — no external vector database
  required.
- **Agent runtime**: AI tasks are modeled as discrete agents with a shared
  context object, run through a small orchestration layer that supports
  both fixed pipelines (e.g. document processing) and rule-based adaptive
  transitions (e.g. deciding whether a student should revise, level up, or
  move on after a quiz).
- **LLM response caching**: identical prompts are cached in Redis for an
  hour to cut down on redundant API calls during development and repeated
  student queries.
