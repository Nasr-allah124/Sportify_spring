import json
from io import BytesIO
from pathlib import Path
from urllib.request import urlopen
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "data" / "morocco-cities.json"

# Villes, localités habitées et chefs-lieux administratifs.
PLACE_CODES = {
    "PPL", "PPLA", "PPLA2", "PPLA3", "PPLA4", "PPLA5", "PPLC"
}

with urlopen("https://download.geonames.org/export/dump/MA.zip", timeout=60) as response:
    archive = BytesIO(response.read())

cities = []
with ZipFile(archive) as source, source.open("MA.txt") as rows:
    for row in rows:
        fields = row.decode("utf-8").rstrip("\r\n").split("\t")
        if fields[6] != "P" or fields[7] not in PLACE_CODES:
            continue

        cities.append({
            "id": fields[0],
            "name": fields[1],
            "latitude": float(fields[4]),
            "longitude": float(fields[5]),
        })

if not cities:
    raise RuntimeError("Aucune localité trouvée dans le catalogue.")

cities.sort(key=lambda city: (city["name"].casefold(), city["id"]))
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps(cities, ensure_ascii=False), encoding="utf-8")
print(f"{len(cities)} localités enregistrées dans {OUTPUT}")
