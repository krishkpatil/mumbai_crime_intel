import os
import requests
import time
from tqdm import tqdm

def download_mumbai_police_stats(start_id=1, end_id=106, output_dir="data/raw/pdfs/official_english"):
    """
    Downloads monthly crime statistics PDFs from the official Mumbai Police website.
    """
    os.makedirs(output_dir, exist_ok=True)
    
    base_url = "https://mumbaipolice.gov.in/files/Cstat/{}.pdf"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://mumbaipolice.gov.in/CrimeStatistics"
    }

    print(f"🚀 Starting synchronization of official statistics (IDs {start_id} to {end_id})...")
    
    downloaded = 0
    skipped = 0
    failed = []

    for file_id in tqdm(range(start_id, end_id + 1)):
        filename = f"{file_id}.pdf"
        filepath = os.path.join(output_dir, filename)
        
        # Skip if already exists
        if os.path.exists(filepath):
            skipped += 1
            continue
            
        url = base_url.format(file_id)
        
        try:
            response = requests.get(url, headers=headers, timeout=15)
            
            if response.status_code == 200:
                with open(filepath, 'wb') as f:
                    f.write(response.content)
                downloaded += 1
                # Small delay to be polite
                time.sleep(0.5)
            elif response.status_code == 404:
                # Many IDs in the sequence are naturally missing on the server
                continue
            else:
                failed.append((file_id, response.status_code))
                
        except Exception as e:
            print(f"\n[Error] ID {file_id}: {e}")
            failed.append((file_id, "Exception"))

    print("\n--- Synchronization Complete ---")
    print(f"✅ Downloaded: {downloaded}")
    print(f"⏩ Skipped:    {skipped}")
    if failed:
        print(f"❌ Failed:     {len(failed)} (IDs: {[f[0] for f in failed]})")
    
    return downloaded

if __name__ == "__main__":
    download_mumbai_police_stats()
