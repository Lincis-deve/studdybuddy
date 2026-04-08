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

## Data storage

Collected snapshots are saved in:

```text
data/snapshots.json
```

## API endpoints

- `GET /api/status` - collector status
- `GET /api/latest` - latest snapshot
- `GET /api/snapshots?limit=80` - history
- `POST /api/collect` - collect now (manual trigger)
