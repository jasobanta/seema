import os
import zipfile
import tempfile
import geopandas as gpd
import shapefile
import zipfile
from pathlib import Path
import sqlite3
from shapely.geometry import shape
from shapefile import FieldType

conn = sqlite3.connect("roads.db")

BASE_DIR = Path(__file__).resolve().parent

def extract_zip_files(zip_path):
    with zipfile.ZipFile(zip_path, "r") as zip_ref:
        zip_ref.extractall(os.path.join(os.curdir,"uploads"))
    


zip_path = os.path.join(BASE_DIR, "uploads", "RO Banglore.zip")
#extract_zip_files(zip_path)
shp_path = os.path.join(os.curdir,"uploads","RO BANGLORE.shp")
sf = shapefile.Reader(shp_path)

cursor = conn.cursor()
cursor.execute(
"""CREATE TABLE IF NOT EXISTS road_data
(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    "NH_Number" TEXT,
    "Agency" TEXT,
    "Chainage_S" TEXT,
    "Chainage_R" TEXT,
    "Chainage_P" TEXT,
    "StartLatit" REAL,
    "StartLongi" REAL,
    "EndLatitud" REAL,
    "EndLongitu" REAL,
    "LengthInKM" REAL,
    "UID" INTEGER,
    "Entrusted" TEXT,
    "UPC" TEXT,
    "GeometryWKT" TEXT
)""")
conn.commit()


field_names = [f.name for f in sf.fields[1:]]

field_names.append("GeometryWKT")

placeholders = ",".join(["?"] * len(field_names))
table_name = 'road_data'
insert_sql = f"""
INSERT INTO "{table_name}"
({",".join(field_names)})
VALUES ({placeholders})
"""

# -----------------------------
# Insert every feature
# -----------------------------
cursor = conn.cursor()

# count = 0

# for sr in sf.iterShapeRecords():

#     # Attribute values
#     values = list(sr.record)

#     # Geometry → WKT
#     geom = shape(sr.shape.__geo_interface__)

#     values.append(geom.wkt)
    
#     cursor.execute(insert_sql, values)

#     count += 1

# conn.commit()
# conn.close()

# print(f"{count} records imported successfully.")

cursor.execute(f'SELECT * FROM "{table_name}"')

rows = cursor.fetchall()

for row in rows:
    print(row)
