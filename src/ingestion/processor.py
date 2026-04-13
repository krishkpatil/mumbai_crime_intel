import os
import json
import re
from router import PdfRouter, LayoutType
from parser_modern import extract_modern_v2
from parser_legacy import extract_legacy_marathi
from fingerprinter import DataFingerprinter

PDF_DIR = "data/raw/pdfs"
OUTPUT_FILE = "data/processed/crime.json"
QUALITY_REPORT = "data/processed/quality.json"

# Load mapping (from the same directory)
mapping_path = os.path.join(os.path.dirname(__file__), 'mapping.json')
with open(mapping_path, 'r', encoding='utf-8') as f:
    mapping = json.load(f)

def get_date_from_filename(filename):
    """
    Deterministic date extraction from Marathi/English filenames.
    Covers all 98 formats (2018-2025).
    """
    months_map = mapping['months']
    variations = mapping.get('month_variations', {})
    numerals = mapping.get('marathi_numerals', {})
    
    # 1. Normalize Marathi numerals to Arabic
    clean_name = filename
    for m_num, a_num in numerals.items():
        clean_name = clean_name.replace(m_num, a_num)
    
    # 2. Extract Year (4 digits)
    year_match = re.search(r'20\d{2}', clean_name)
    year = year_match.group(0) if year_match else "Unknown"
    
    # 3. Extract Month (Marathi)
    found_month = "Unknown"
    all_month_keys = list(months_map.keys()) + list(variations.keys())
    
    for m_key in all_month_keys:
        if m_key in clean_name:
            resolved_key = variations.get(m_key, m_key)
            found_month = months_map.get(resolved_key, "Unknown")
            break
            
    return f"{year}-{found_month}"

def normalize_crime_text(text):
    """
    Strips legal/boilerplate noise while preserving semantic qualifiers like (i)/(ii).
    """
    if not text: return ""
    t = text
    # Strip legal wrappers
    t = re.sub(r"\bu/s\b.*", "", t, flags=re.I)
    t = re.sub(r"\(Sec\.[^)]+\)", "", t, flags=re.I)
    t = re.sub(r"\bIPC\b|\bBNS\b", "", t, flags=re.I)
    # Collapse punctuation and whitespace
    t = re.sub(r"[\.\-_/]+", " ", t)
    t = re.sub(r"\s+", " ", t).strip().lower()
    return t

def get_category_group(raw_name):
    """
    Multi-pass semantic mapping: Sections -> Patterns -> Keywords.
    """
    norm = normalize_crime_text(raw_name)
    sections = mapping.get('sections', {})
    categories = mapping.get('categories', {})
    
    # 1. Section Search (High Priority - e.g. "302 IPC", "103 BNS")
    for section, group in sections.items():
        if re.search(fr"\b{section}\b", raw_name):
            return group

    # 2. Regex Pattern Search (Flexible keywords)
    for pattern, group in categories.items():
        if re.search(pattern, norm):
            return group

    # 3. Fallback for specific historical markers
    if "h b t" in norm or "house breaking" in norm: return "Theft & Robbery"
    
    return "Misc"

def is_corrupt(reg, det, reg_ytd, det_ytd):
    """
    Anomaly guard for malaligned columns or non-numeric noise.
    """
    MAX_REASONABLE = 100000
    try:
        def to_int(v):
            if v is None: return 0
            if isinstance(v, str):
                # Clean commas or extra spaces
                v = v.replace(",", "").strip()
                return int(v) if v.isdigit() else 0
            return int(v)
            
        r, d = to_int(reg), to_int(det)
        ry, dy = to_int(reg_ytd), to_int(det_ytd)
        
        if any(v > MAX_REASONABLE for v in (r, d, ry, dy)): return True
        if d > r + 5 or dy > ry + 5: return True 
        return False
    except:
        return True

def is_noise(text):
    """
    Filters out header/footer leakage using tight regex.
    """
    t = text.lower().strip()
    DATE_RANGE = r"^\d{2}/\d{2}/\d{4}\s+to\s+\d{2}/\d{2}/\d{4}$"
    COL_ENUM = r"^\d+(\s+\d+)+$"
    TABLE_WORD = r"^\s*(table|column|sr\.?no|crime heads?)\b"
    return (
        re.match(DATE_RANGE, t) or
        re.match(COL_ENUM, t) or
        re.match(TABLE_WORD, t) or
        len(t) < 2
    )

def calculate_dual_scoring(data, layout_type, filename):
    """
    Rebalanced scoring: 0.4 mapping, 0.3 invariants, 0.2 noise-free, 0.1 no anomalies.
    """
    extraction_score = 1.0 if (layout_type != LayoutType.UNKNOWN and data) else 0.0
    if not data: return extraction_score, 0.0
    
    total = len(data)
    mapped = 0
    valid_inv = 0
    noise_rows = 0
    corrupt_rows = 0
    
    for entry in data:
        if entry.get('group') not in ("Misc", "Total"):
            mapped += 1
        
        reg, det = entry.get('registered', 0), entry.get('detected', 0)
        reg_y, det_y = entry.get('registered_ytd', 0), entry.get('detected_ytd', 0)
        
        if not is_corrupt(reg, det, reg_y, det_y):
            valid_inv += 1
        else:
            corrupt_rows += 1
            
        if is_noise(entry.get('crime_type', '')):
            noise_rows += 1
            
    m_score = (mapped / total) * 0.4
    i_score = (valid_inv / total) * 0.3
    n_score = (1.0 - (noise_rows / total)) * 0.2
    a_score = (1.0 - (corrupt_rows / total)) * 0.1
    
    semantic_score = m_score + i_score + n_score + a_score
    return round(extraction_score, 2), round(max(0, semantic_score), 2)

def get_date_from_content(pdf_path):
    """
    Fallback for numeric filenames: extract date from the PDF header text.
    """
    import pdfplumber
    try:
        with pdfplumber.open(pdf_path) as pdf:
            text = pdf.pages[0].extract_text() or ""
            # Search for patterns like "Month 20XX", "Month, 20XX", "Mahe [Month] [Year]"
            text = text.upper()
            
            # Pattern 1: FOR THE MONTH OF FEBRUARY 2026
            match = re.search(r'MONTH\s+OF\s+([A-Z]+)\s+(20\d{2})', text)
            if not match:
                # Pattern 2: MAHE FEBRUARY 2026
                match = re.search(r'(MAHE|MAHAL)?\s*([A-Z]+)\s*[,-\s]?\s*(20\d{2})', text)
            
            if not match:
                # Pattern 3: Date Range 01.07.2025 To 31.07.2025
                match = re.search(r'(\d{2})[\./](\d{2})[\./](20\d{2})\s+To\s+(\d{2})[\./](\d{2})[\./](20\d{2})', text, re.I)
                if match:
                    # Use the first date's month and year
                    month_num = str(int(match.group(2))) # Remove leading zero if any
                    year = match.group(3)
                    return f"{year}-{month_num}"

            if match:
                month_name = match.group(1).lower() if "MONTH" in match.group(0) else match.group(2).lower()
                year = match.group(2) if "MONTH" in match.group(0) else match.group(3)
                month_num = mapping['months'].get(month_name, "Unknown")
                if month_num != "Unknown":
                    return f"{year}-{month_num}"
    except:
        pass
    return None

def process_pipeline(progress_cb=None):
    router = PdfRouter()
    fingerprinter = DataFingerprinter()

    # Process both sources
    pdf_sources = [
        {"dir": "data/raw/pdfs", "method": "filename"},
        {"dir": "data/raw/pdfs/official_english", "method": "content"}
    ]

    all_results = []
    quality_summary = []
    processed_hashes = set()

    # Pre-count total PDFs for progress reporting
    _total = sum(
        len([f for f in os.listdir(s["dir"]) if f.endswith('.pdf')])
        for s in pdf_sources if os.path.exists(s["dir"])
    )
    _done = 0
    if progress_cb:
        progress_cb(files_total=_total, msg=f"Processing {_total} PDFs…")

    print(f"Starting Industrial Grade Ingestion Pipeline...")

    for source in pdf_sources:
        s_dir = source["dir"]
        if not os.path.exists(s_dir): continue

        pdf_files = [f for f in os.listdir(s_dir) if f.endswith('.pdf')]
        pdf_files.sort()

        for pdf_file in pdf_files:
            pdf_path = os.path.join(s_dir, pdf_file)
            
            file_hash = fingerprinter.get_file_hash(pdf_path)
            if file_hash in processed_hashes: continue
            processed_hashes.add(file_hash)

            if progress_cb:
                progress_cb(current_file=pdf_file, files_done=_done,
                            msg=f"[{_done + 1}/{_total}] {pdf_file}")
            _done += 1

            # Determine Date
            report_date = "Unknown"
            if source["method"] == "filename":
                report_date = get_date_from_filename(pdf_file)
            else:
                report_date = get_date_from_content(pdf_path) or "Unknown"
            
            # If still unknown, try filename as fallback
            if report_date == "Unknown":
                report_date = get_date_from_filename(pdf_file)
            
            layout = router.classify(pdf_path)
            extracted_data = []
            
            try:
                if layout == LayoutType.MODERN_ENGLISH_BORDERED:
                    extracted_data = extract_modern_v2(pdf_path)
                elif layout == LayoutType.LEGACY_MARATHI_TEXT:
                    extracted_data = extract_legacy_marathi(pdf_path)
                
                refined_data = []
                last_parent = None
                
                for rec in extracted_data:
                    c_type = rec['crime_type'].strip()
                    if is_noise(c_type): continue
                    
                    norm = normalize_crime_text(c_type)
                    is_sub = re.match(r"^\(?i+\)?|^\d+\)|\bmajor\b|\bminor\b", norm)
                    
                    if is_sub and last_parent:
                        rec['crime_type'] = f"{last_parent} {c_type}"
                    elif not is_sub and "total" not in norm:
                        last_parent = c_type
                    
                    if "total" in norm: last_parent = None
                    
                    # Store Domain (preserving parser output)
                    rec['domain'] = rec.get('domain', 'General IPC/BNS')
                    rec['group'] = get_category_group(rec['crime_type'])

                    # Drop corrupt rows — don't save garbage values to output
                    if is_corrupt(rec.get('registered'), rec.get('detected'),
                                  rec.get('registered_ytd'), rec.get('detected_ytd')):
                        continue

                    refined_data.append(rec)
                
                extraction_conf, semantic_conf = calculate_dual_scoring(refined_data, layout, pdf_file)
                
                all_results.append({
                    "lineage": {
                        "filename": pdf_file,
                        "source": s_dir,
                        "source_hash": file_hash,
                        "layout_version": layout,
                        "report_date": report_date,
                        "parser_id": "v3_industrial_pipeline"
                    },
                    "scores": {
                        "extraction": extraction_conf,
                        "semantic": semantic_conf
                    },
                    "records": refined_data
                })
                
                quality_summary.append({
                    "filename": pdf_file,
                    "report_date": report_date,
                    "layout": layout,
                    "extraction_score": extraction_conf,
                    "semantic_score": semantic_conf,
                    "status": "SUCCESS" if (extraction_conf >= 1.0 and semantic_conf > 0.8) else "PARTIAL"
                })
                
                print(f"  [Done] {pdf_file} | Date: {report_date} | Scores: E={extraction_conf}, S={semantic_conf}")
                
            except Exception as e:
                print(f"  [Error] Failed processing {pdf_file}: {e}")
                quality_summary.append({
                    "filename": pdf_file,
                    "error": str(e),
                    "status": "ERROR"
                })
            
    # Save results (OUTSIDE LOOPS)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_results, f, indent=2, ensure_ascii=False)
        
    with open(QUALITY_REPORT, 'w', encoding='utf-8') as f:
        json.dump(quality_summary, f, indent=2, ensure_ascii=False)
        
    # Mapping Audit Summary
    unmapped = set()
    for res in all_results:
        for rec in res['records']:
            if rec.get('group') == "Misc":
                unmapped.add(rec['crime_type'])

    print(f"\nPipeline execution complete.")
    print(f"Full Data: {OUTPUT_FILE}")
    print(f"Quality Report: {QUALITY_REPORT}")
    if unmapped:
        unmapped_list = sorted(list(unmapped))
        print(f"Found {len(unmapped_list)} unmapped categories: {unmapped_list[:10]}...")

if __name__ == "__main__":
    process_pipeline()
