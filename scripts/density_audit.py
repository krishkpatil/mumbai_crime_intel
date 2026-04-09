import json
from collections import Counter

def audit():
    try:
        with open('data/processed/crime.json', 'r') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error: {e}")
        return

    file_counts = Counter()
    for entry in data:
        filename = entry.get('lineage', {}).get('filename', 'Unknown')
        num_records = len(entry.get('records', []))
        file_counts[filename] += num_records

    print(f"Total PDFs processed: {len(file_counts)}")
    print("\nTop 10 PDFs by record count:")
    for file, count in file_counts.most_common(10):
        print(f"  {file}: {count} records")

    print("\nBottom 10 PDFs by record count:")
    for file, count in sorted(file_counts.items(), key=lambda x: x[1])[:10]:
        print(f"  {file}: {count} records")

    avg_records = sum(file_counts.values()) / len(file_counts) if file_counts else 0
    print(f"\nAverage records per PDF: {avg_records:.1f}")

if __name__ == "__main__":
    audit()
