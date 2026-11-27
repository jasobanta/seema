from fastapi import FastAPI, Form, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

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
import os

from app.services.google_drive import (
    upload_to_google_drive,
    delete_drive_file,
    get_parent_folder_id
)
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
DB = BASE_DIR / "roads.db"
TABLE_NAME = "road_data_new"

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

    cursor.execute(
        f'SELECT * FROM "{TABLE_NAME}"  where hide !=1'
    )

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

@app.post("/feature/{id}")
def update_feature(
    id: int,
    entrust: str = Form(...),
    upc: str = Form(""),
    remark: str = Form(""),
    fine: UploadFile | None = File(None)
):
    conn = None
    uploaded_file_id = None
    upload_result = None

    try:
        # 1. Validate form values
        entrust = entrust.strip().lower()
        upc = upc.strip()
        remark = remark.strip()

        if entrust not in ["yes", "no", "pending"]:
            raise HTTPException(
                status_code=400,
                detail="Entrusted must be Yes, No or Pending."
            )

        entrust_value = (
            "Yes" if entrust == "yes"
            else "No" if entrust == "no"
            else "Pending"
        )

        if len(remark) > 2000:
            raise HTTPException(
                status_code=400,
                detail="Remark cannot exceed 2000 characters."
            )

        if entrust_value == "Yes" and not upc:
            raise HTTPException(
                status_code=400,
                detail="UPC is required when Entrusted is Yes."
            )

        if entrust_value == "No":
            upc = ""

        # 2. File validation and upload only for Yes/No
        fine_url = ""
        fine_drive_id = ""
        fine_folder_id = ""

        if entrust_value in ["Yes", "No"]:

            if not fine or not fine.filename:
                raise HTTPException(
                    status_code=400,
                    detail="Please select a file to upload."
                )

            filename = Path(fine.filename).name
            extension = Path(filename).suffix.lower()

            if entrust_value == "Yes" and extension not in [".kml", ".kmz"]:
                raise HTTPException(
                    status_code=400,
                    detail="For Entrusted Yes, upload only KML or KMZ files."
                )

            if entrust_value == "No" and extension != ".pdf":
                raise HTTPException(
                    status_code=400,
                    detail="For Entrusted No, upload only PDF files."
                )

            selected_folder_id = get_parent_folder_id(entrust)

            if not selected_folder_id:
                raise HTTPException(
                    status_code=500,
                    detail="Google Drive destination folder is not configured."
                )

        # 3. Check road record exists
        conn = sqlite3.connect(DB)
        cursor = conn.cursor()

        cursor.execute(
            f'SELECT id FROM "{TABLE_NAME}" WHERE id = ?',
            (id,)
        )

        road = cursor.fetchone()

        if not road:
            raise HTTPException(
                status_code=404,
                detail=f"Road record with ID {id} was not found."
            )

        # 4. Upload to Google Drive only for Yes/No
        if entrust_value in ["Yes", "No"]:

            content_type = (
                fine.content_type or "application/octet-stream"
            )

            upload_result = upload_to_google_drive(
                file_obj=fine.file,
                filename=filename,
                parent_folder_id=selected_folder_id,
                content_type=content_type,
                road_id=id
            )

            uploaded_file_id = upload_result["file_id"]
            fine_url = upload_result["file_url"]
            fine_drive_id = upload_result["file_id"]
            fine_folder_id = upload_result["folder_id"]

        # 5. Update SQLite record
        # Pending also clears previous UPC and file references.
        cursor.execute(
            f'''
            UPDATE "{TABLE_NAME}"
            SET
                UPC = ?,
                Entrusted = ?,
                Remark = ?,
                FineUrl = ?,
                FineDriveId = ?,
                FineFolderId = ?
            WHERE id = ?
            ''',
            (
                upc,
                entrust_value,
                remark,
                fine_url,
                fine_drive_id,
                fine_folder_id,
                id
            )
        )

        if cursor.rowcount == 0:
            raise RuntimeError(
                f"Road record {id} could not be updated."
            )

        conn.commit()

        return {
            "success": True,
            "message": "Road record updated successfully.",
            "id": id,
            "entrusted": entrust_value,
            "upc": upc,
            "remark": remark,
            "fineUrl": fine_url,
            "fileId": fine_drive_id,
            "fileName": upload_result["file_name"] if upload_result else "",
            "folderId": fine_folder_id
        }

    except HTTPException:
        if conn:
            conn.rollback()
        raise

    except Exception as e:
        if conn:
            conn.rollback()

        if uploaded_file_id:
            try:
                delete_drive_file(uploaded_file_id)
            except Exception as delete_error:
                print(
                    f"Could not delete uploaded Drive file: {delete_error}"
                )

        print(
            f"Feature update error for road ID {id}: "
            f"{type(e).__name__}: {e}"
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to update road record. Please check backend logs."
        )

    finally:
        if conn:
            conn.close()
@app.get("/downloadcsv")
def download_csv():

    conn = None

    try:
        conn = sqlite3.connect(DB)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        cur.execute(f'''
            SELECT
                UID,
                NH_Number,
                Agency,
                Chainage_S,
                Chainage_R,
                Chainage_P,
                Entrusted,
                UPC,
                LengthInKM,
                Remark,
                FineUrl,
                FineDriveId,
                FineFolderId,
                hide
            FROM "{TABLE_NAME}"
            ORDER BY UID
        ''')

        rows = cur.fetchall()

        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow([
            "UID",
            "NH Number",
            "Agency",
            "Chainage Start",
            "Chainage Reference",
            "Chainage Point",
            "Entrusted",
            "UPC",
            "Length (KM)",
            "Remark",
            "fine_file",
            "File Uploaded",
            "File URL",
            "Google Drive File ID",
            "Google Drive Folder ID",
            "Hidden"
        ])

        for row in rows:

            drive_file_id = row["FineDriveId"] or ""

            # Filename is not stored in SQLite.
            # It can be retrieved from Google Drive separately.
            fine_file = ""

            writer.writerow([
                row["UID"],
                row["NH_Number"],
                row["Agency"],
                row["Chainage_S"],
                row["Chainage_R"],
                row["Chainage_P"],
                row["Entrusted"],
                row["UPC"],
                row["LengthInKM"],
                row["Remark"],
                fine_file,
                "Yes" if drive_file_id.strip() else "No",
                row["FineUrl"],
                drive_file_id,
                row["FineFolderId"],
                row["hide"]
            ])

        output.seek(0)

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition":
                    "attachment; filename=Entrusted_Report.csv"
            }
        )

    except sqlite3.Error as e:

        print(f"CSV export database error: {e}")

        raise HTTPException(
            status_code=500,
            detail=f"CSV export failed: {str(e)}"
        )

    finally:
        if conn:
            conn.close()
