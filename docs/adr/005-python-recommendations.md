# ADR-005: Python recommendation service

Accepted. A small FastAPI service provides a stable internal API-key boundary. Python 3.11 is the container/CI target; no algorithm or heavy analytics dependencies are installed until Phases 11–12. Mongo read-only access and snapshot-scoped writes will be separate users then. Health is public; business endpoints require x-api-key.
