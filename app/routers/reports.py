# app/routers/reports.py

from fastapi import APIRouter
from fastapi.responses import FileResponse
import sqlite3
import geopandas as gpd
from shapely import wkt
import tempfile
import os
import zipfile
from pathlib import Path

router = APIRouter(
    prefix="/reports",
    tags=["Reports"]
)

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DB = BASE_DIR / "roads.db"


@router.get("/roads/shp")
def download_roads_shp():

    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    print("DATABASE",DB)

    try:

        cursor = conn.cursor()
        cursor.execute("""
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
        """)

        print("TABLES:", cursor.fetchall())       

        cursor.execute("""
            SELECT *
            FROM road_data
            WHERE COALESCE(hide, 0) != 1
        """)

        rows = cursor.fetchall()

    finally:
        conn.close()

    if not rows:
        return {
            "success": False,
            "message": "No road data available"
        }

    # --------------------------------
    # Convert SQLite rows to records
    # --------------------------------

    records = []

    for row in rows:

        record = dict(row)

        geometry_wkt = record.pop("GeometryWKT", None)

        if not geometry_wkt:
            continue

        record["geometry"] = wkt.loads(geometry_wkt)

        records.append(record)

    # --------------------------------
    # Create GeoDataFrame
    # --------------------------------

    gdf = gpd.GeoDataFrame(
        records,
        geometry="geometry"
    )

    # IMPORTANT:
    # Replace this with the actual CRS of your road data.
    gdf.set_crs("EPSG:4326", inplace=True)

    # --------------------------------
    # Temporary directory
    # --------------------------------

    temp_dir = tempfile.mkdtemp()

    shp_path = os.path.join(
        temp_dir,
        "road_data.shp"
    )

    # --------------------------------
    # Write Shapefile
    # --------------------------------

    gdf.to_file(
        shp_path,
        driver="ESRI Shapefile",
        encoding="UTF-8"
    )

    # --------------------------------
    # ZIP all Shapefile components
    # --------------------------------

    zip_path = os.path.join(
        temp_dir,
        "road_data.zip"
    )

    with zipfile.ZipFile(
        zip_path,
        "w",
        zipfile.ZIP_DEFLATED
    ) as zipf:

        for filename in os.listdir(temp_dir):

            if filename.endswith(
                (".shp", ".shx", ".dbf", ".prj", ".cpg")
            ):

                filepath = os.path.join(
                    temp_dir,
                    filename
                )

                zipf.write(
                    filepath,
                    arcname=filename
                )

    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename="road_data.zip"
    )