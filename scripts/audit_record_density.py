import json
import os
import sys

def audit():
    DATA_PATH = "data/processed/crime.json"
    if not os.path.exists(DATA_PATH):
        print(f"Error: {DATA_PATH} not found.")
        return

    with open(DATA_PATH, "r") as f:
        data = json.load(f)

    # Sort files by record density
    sorted_data = sorted(data, key=lambda x: len(x.get("records", [])), reverse=True)

    print(f"\n{'| PDF Filename':<50} | {'Records':<8} | {'Status':<15} |")
    print("-" * 80)
    
    total_records = 0
    for item in sorted_data:
        filename = item["lineage"]["filename"]
        count = len(item.get("records", []))
        total_records += count
        
        status = "✅ HIGH" if count >= 30 else ("⚠️ MEDIUM" if count >= 20 else "❌ LOW")
        print(f"| {filename:<48} | {count:<8} | {status:<15} |")

    print("-" * 80)
    print(f"Total PDFs: {len(data)}")
    print(f"Total Records: {total_records}")
    print(f"Avg Density: {total_records / len(data):.2f} records/pdf")

if __name__ == "__main__":
    audit()
