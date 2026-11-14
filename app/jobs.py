import sqlite3
from openpyxl import load_workbook

DB = r"/home/ginger/myproject/seema/roads.db"
EXCEL_FILE = r"/home/ginger/Downloads/for NH Div.xlsx"

conn = sqlite3.connect(DB)
cursor = conn.cursor()

# Open Excel
workbook = load_workbook(
    EXCEL_FILE,
    read_only=True,
    data_only=True
)

sheet = workbook.active

# Read header row
headers = [
    cell.value.strip() if isinstance(cell.value, str) else cell.value
    for cell in sheet[1]
]

# Find UID column
try:
    uid_column = headers.index("UID")
except ValueError:
    workbook.close()
    conn.close()
    raise Exception("UID column not found in Excel")

updated_rows = 0
uids_found = 0

# Read UID values
for row in sheet.iter_rows(min_row=2, values_only=True):

    if uid_column >= len(row):
        continue

    uid = row[uid_column]

    if uid is None:
        continue

    uid = str(uid).strip()

    if not uid:
        continue

    uids_found += 1

    cursor.execute("""
        UPDATE road_data
        SET Hide = 1
        WHERE UID = ?
    """, (uid,))

    updated_rows += cursor.rowcount

# Save changes
conn.commit()

workbook.close()
conn.close()

print("UIDs found in Excel:", uids_found)
print("Database rows updated:", updated_rows)