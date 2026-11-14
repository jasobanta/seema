from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import sqlite3
from shapely import wkt
from shapely.geometry import mapping
import time

from fastapi.responses import ORJSONResponse
from fastapi.responses import StreamingResponse

from pathlib import Path

from app.routers.reports import router as reports_router

import csv
import io


BASE_DIR = Path(__file__).resolve().parent.parent
DB = BASE_DIR / "roads.db"


app = FastAPI(
    default_response_class=ORJSONResponse
)

app.include_router(reports_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
        "http://127.0.0.1:4200",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get('/')
def home():
    return{
        "message":"This is the home for seema App."
    }
@app.post("/jaso")
def jaso():
    return{
        "jaso return to home"
    }
@app.get('/roads')
def road_data():

    total_start = time.perf_counter()

    conn = sqlite3.connect(DB)
    print(DB)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # ---------------------------------------
    # SQL
    # ---------------------------------------

    start = time.perf_counter()

    cursor.execute("""
        SELECT *
        FROM road_data
        where hide !=1
    """)

    rows = cursor.fetchall()

    print(
        f"SQL: {time.perf_counter() - start:.3f}s"
    )

    print(
        f"Rows: {len(rows)}"
    )

    # ---------------------------------------
    # GeoJSON conversion
    # ---------------------------------------

    start = time.perf_counter()

    features = []

    for row in rows:

        properties = dict(row)

        geometry_wkt = properties.pop("GeometryWKT", None)

        geometry = (
            mapping(wkt.loads(geometry_wkt))
            if geometry_wkt
            else None
        )

        features.append({
            "type": "Feature",
            "geometry": geometry,
            "properties": properties
        })

    print(
        f"WKT + GeoJSON: {time.perf_counter() - start:.3f}s"
    )

    conn.close()

    print(
        f"TOTAL function: {time.perf_counter() - total_start:.3f}s"
    )

    return {
        "type": "FeatureCollection",
        "features": features
    }
@app.post('/feature/{id}')
def update_feature(id: int, data: dict):
    conn = sqlite3.connect(DB)
    conn.execute(
        """
        UPDATE road_data
        SET UPC=?,
        Entrusted=?
        WHERE id=?
        """,
        (
            data["upc"],
            data["entrust"],
            id
        )
    )
    conn.commit()
    conn.close()

    return data
@app.get("/downloadcsv")
def download_csv():
    
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row

    cur = conn.cursor()

    cur.execute("""
        SELECT
            UID,
            NH_Number,
            Chainage_S,
            Chainage_R,
            Chainage_P,
            Entrusted,
            UPC,
            LengthInKM,
            hide
        FROM road_data
        ORDER BY UID
    """)

    rows = cur.fetchall()

    output = io.StringIO()

    writer = csv.writer(output)

    writer.writerow([
        "UID",
        "NH Number",
        "Chainage_S",
        "Chainage_R",
        "Chainage_P",
        "Entrusted",
        "UPC",
        "Length (KM)",
        "hide"
    ])

    for row in rows:

        writer.writerow(row)

    conn.close()

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition":
            "attachment; filename=Entrusted_Report.csv"
        }
    )
    
