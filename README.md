# Preiļi & Madona Data Collector

This project is a small website + backend that:

- reads data from **https://www.primero.lv/korukari/rezultati**
- uses the same data API that page uses
- collects data every **5 minutes**
- tracks only two cities/city teams:
  - **Preiļi**
  - **Madona**
- saves all snapshots locally
- shows latest data and history in a web UI

## Run

```bash
npm install
npm start
```

Open:

```text
http://localhost:3000
```

## Docker

### Build and run with Docker

```bash
docker build -t koru-city-collector .
docker run --rm -p 3000:3000 -v "$(pwd)/data:/app/data" koru-city-collector
```

### Run with Docker Compose

```bash
docker compose up --build -d
```

Stop:

```bash
docker compose down
```

## Data storage

Collected snapshots are saved in:

```text
data/snapshots.json
```

When running in Docker Compose, this path is persisted via a bind mount to `./data`.

## Charts

The dashboard includes two charts:

- **Votes over time** (Preiļi and Madona lines)
- **Vote change per snapshot** (how many votes were added since previous collection)

## API endpoints

- `GET /api/status` - collector status
- `GET /api/latest` - latest snapshot
- `GET /api/snapshots?limit=80` - history
- `POST /api/collect` - collect now (manual trigger)
