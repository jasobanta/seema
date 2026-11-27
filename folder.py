from dotenv import load_dotenv
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

load_dotenv(BASE_DIR / "app/.env")

from app.services.google_drive import (
    get_drive_service,
    get_parent_folder_id,
    get_or_create_road_folder
)

service = get_drive_service()
user = service.about().get(
    fields="user(displayName,emailAddress)"
).execute()

print("Authenticated Google account:", user["user"]["emailAddress"])

for entrust in ["yes", "no"]:

    print("\n" + "=" * 45)
    print(f"Checking {entrust.upper()} destination")
    print("=" * 45)

    try:
        folder_id = get_parent_folder_id(entrust)

        folder = service.files().get(
            fileId=folder_id,
            fields=(
                "id,name,mimeType,"
                "capabilities(canAddChildren),"
                "shared,owners(emailAddress)"
            )
        ).execute()

        print("Folder name:", folder.get("name"))
        print("Folder ID:", folder.get("id"))
        print("Folder type:", folder.get("mimeType"))
        print(
            "Can add children:",
            folder.get("capabilities", {}).get("canAddChildren")
        )
        print("Shared:", folder.get("shared"))
        print("Owners:", folder.get("owners"))

    except Exception as error:
        print("Folder access error:", error)

for entrust in ["yes", "no"]:

    folder_id = get_parent_folder_id(entrust)

    print("\n" + "=" * 55)
    print("Permissions for:", entrust.upper())
    print("=" * 55)

    permissions = service.permissions().list(
        fileId=folder_id,
        supportsAllDrives=True,
        fields=(
            "permissions("
            "id,type,emailAddress,domain,role,"
            "deleted,permissionDetails"
            ")"
        )
    ).execute()

    for permission in permissions.get("permissions", []):
        print({
            "email": permission.get("emailAddress"),
            "type": permission.get("type"),
            "role": permission.get("role"),
            "domain": permission.get("domain"),
            "deleted": permission.get("deleted"),
            "details": permission.get("permissionDetails")
        })
        
print("=" *65) 
service = get_drive_service()

parent_id = get_parent_folder_id("yes")

folder_id = get_or_create_road_folder(
    service,
    2452,
    parent_id
)

print("Road folder created/found:", folder_id)