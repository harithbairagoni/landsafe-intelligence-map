"""Read-only parcel endpoint for the synthetic LandSafe demo."""
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen

from fastapi import FastAPI

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
FIXTURES = Path(__file__).resolve().parents[1] / "src" / "fixtures.json"
COLUMNS = "id,survey,plot,village,mandal,district,area,bbox,example"


def catalogue():
    project_url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_PUBLISHABLE_KEY")
    if project_url and key:
        request = Request(
            f"{project_url.rstrip('/')}/rest/v1/landsafe_demo_parcels"
            f"?select={COLUMNS}&order=id.asc&limit=25",
            headers={"apikey": key, "Accept": "application/json"},
        )
        try:
            with urlopen(request, timeout=4) as response:
                parcels = json.load(response)
            if isinstance(parcels, list) and parcels:
                return {"mode": "synthetic", "source": "supabase", "parcels": parcels}
        except (OSError, ValueError):
            pass
    return {"mode": "synthetic", "source": "fixtures", "parcels": json.loads(FIXTURES.read_text())}


@app.get("/api/parcels")
@app.get("/")
def list_parcels():
    return catalogue()
