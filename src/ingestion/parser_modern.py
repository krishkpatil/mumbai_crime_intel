import camelot
import json
import os
import re

# Canonical Column Mapping for Modern V2 Layout
COLUMN_MAP_V2 = {
    0: "sr_no",
    1: "crime_type",
    2: "registered_current_month",
    3: "detected_current_month",
    4: "registered_prev_month",
    5: "detected_prev_month",
    6: "registered_current_year",
    7: "detected_current_year",
}

def clean_value(val):
    """Clean numbers from PDF cells. Splits on newlines first to avoid
    concatenating multi-line cell content into a spurious giant integer."""
    if not val:
        return 0
    # Split on newlines/whitespace runs — take the first token that is purely numeric
    parts = re.split(r'[\n\r]+', str(val).strip())
    for part in parts:
        part = part.replace(',', '').replace(' ', '')
        if re.match(r'^\d+$', part):
            n = int(part)
            if n < 1_000_000:  # sanity cap — no monthly crime count should exceed this
                return n
    # Fallback: grab first digit sequence under the cap
    for part in parts:
        m = re.search(r'\d+', part)
        if m:
            n = int(m.group(0))
            if n < 1_000_000:
                return n
    return 0

def get_table_domain(pdf_path, page_num, table_y1, table_y2):
    """
    Heuristic to determine the domain (Cyber, Women, etc.) based on text context.
    """
    import pdfplumber
    try:
        with pdfplumber.open(pdf_path) as pdf:
            page = pdf.pages[page_num]
            # Search text in the top half or above the table
            text = page.extract_text() or ""
            text = text.upper()
            
            if "CRIME AGAINST WOMEN" in text or "WOMEN SAFETY" in text:
                return "Women Safety"
            if "CYBER CRIME" in text or "E-CRIME" in text:
                return "Cyber Crime"
            if "NDPS" in text or "NARCOTIC" in text:
                return "Narcotics"
            if "ECONOMIC OFFENCES" in text or "EOW" in text:
                return "Economic"
            return "General IPC/BNS"
    except Exception:
        return "General IPC/BNS"

def extract_modern_v2(pdf_path):
    """
    Extracts data using Camelot from the Modern English Bordered layout.
    Supports multi-domain discovery (General, Women, Cyber, NDPS).
    """
    print(f"\n[Modern Parser] Processing: {pdf_path}")
    results = []
    
    # Extract all tables (lattice mode)
    try:
        tables = camelot.read_pdf(pdf_path, pages='all', flavor='lattice')
    except Exception as e:
        print(f"  [Error] Camelot failed to read PDF: {e}")
        return []

    for table_idx, table in enumerate(tables):
        df = table.df
        page_num = table.parsing_report['page'] - 1 # 0-indexed for pdfplumber
        
        # Determine Domain
        domain = get_table_domain(pdf_path, page_num, 0, 0)
        print(f"  Table {table_idx} (Page {page_num+1}, Domain: {domain}, Shape: {df.shape})")
        
        # Step 1: Detect Anchor Row and Column Indices
        header_row_idx = -1
        col_map = {
            "crime_head_idx": -1,
            "reg_current_idx": -1,
            "det_current_idx": -1,
            "reg_ytd_idx": -1,
            "det_ytd_idx": -1
        }
        
        # Search first 15 rows for headers
        for i in range(min(15, len(df))):
            row_vals = [str(x).upper().strip() for x in df.iloc[i].tolist()]
            row_str = " ".join(row_vals)
            
            # Find the Crime Head anchor
            anchor_match = re.search(r'(CRIME\s*HEADS?|TYPE\s*OF\s*CRIME|गुन्हयाचा\s*प्रकार|SR\.?\s*NO)', row_str, re.I)
            if anchor_match:
                header_row_idx = i
                # Find the exact index of Crime Head
                for idx, cell in enumerate(row_vals):
                    if re.search(r'(CRIME\s*HEADS?|TYPE\s*OF\s*CRIME|गुन्हयाचा\s*प्रकार)', cell, re.I):
                        col_map["crime_head_idx"] = idx
                        break
                
                # If Crime Head not found but we have a Sr No, Crime Head is likely next
                if col_map["crime_head_idx"] == -1 and "SR" in row_str:
                    col_map["crime_head_idx"] = 1 # Heuristic for standard Mumbai reports
                
                # LOOK AHEAD for R/D markers
                found_reg = []
                found_det = []
                
                for look_ahead in range(i, min(i + 5, len(df))):
                    current_row = [str(x).upper().strip() for x in df.iloc[look_ahead].tolist()]
                    for idx, cell in enumerate(current_row):
                        is_r = cell == "R" or ("REG" in cell and "SR" not in cell) or "DAKHAL" in cell
                        is_d = cell == "D" or "UGHAD" in cell or ("DET" in cell and "TYPE" not in cell)
                        
                        if is_r:
                            if idx not in found_reg: found_reg.append(idx)
                        if is_d:
                            if idx not in found_det: found_det.append(idx)
                
                found_reg.sort()
                found_det.sort()

                if len(found_reg) >= 1:
                    col_map["reg_current_idx"] = found_reg[0]
                    col_map["reg_ytd_idx"] = found_reg[2] if len(found_reg) >= 3 else (found_reg[-1] if len(found_reg) > 1 else found_reg[0])
                
                if len(found_det) >= 1:
                    col_map["det_current_idx"] = found_det[0]
                    col_map["det_ytd_idx"] = found_det[2] if len(found_det) >= 3 else (found_det[-1] if len(found_det) > 1 else found_det[0])
                
                # FALLBACK for 11-column reports (common in 2024–2025)
                if col_map["reg_current_idx"] == -1 and len(df.columns) >= 11:
                    col_map["reg_current_idx"] = 2
                    col_map["det_current_idx"] = 3
                    col_map["reg_ytd_idx"] = 6
                    col_map["det_ytd_idx"] = 7

                break

        if col_map["crime_head_idx"] == -1:
            continue
            
        # Step 2: Extract data rows
        for i in range(header_row_idx + 1, len(df)):
            row = df.iloc[i].tolist()
            if len(row) <= col_map["crime_head_idx"]:
                continue
                
            item_name = str(row[col_map["crime_head_idx"]]).replace('\n', ' ').strip()
            
            if not item_name or item_name.isdigit() or len(item_name) < 2:
                continue
            
            header_noise = ["SR. NO", "CRIME TYPE", "CATEGORY", "CRIME HEAD", "DETEC-", "TION", "DIFF", "YEAR OF"]
            if any(h in item_name.upper() for h in header_noise):
                continue

            is_total = any(t in item_name.upper() for t in ["TOTAL", "GRAND TOTAL", "एकूण"])
            if is_total:
                item_name = f"Total {domain}"

            reg = clean_value(row[col_map["reg_current_idx"]]) if col_map["reg_current_idx"] != -1 else 0
            det = clean_value(row[col_map["det_current_idx"]]) if col_map["det_current_idx"] != -1 else 0
            reg_ytd = clean_value(row[col_map["reg_ytd_idx"]]) if col_map["reg_ytd_idx"] != -1 else 0
            det_ytd = clean_value(row[col_map["det_ytd_idx"]]) if col_map["det_ytd_idx"] != -1 else 0
            
            results.append({
                "crime_type": item_name,
                "domain": domain,
                "registered": reg,
                "detected": det,
                "registered_ytd": reg_ytd,
                "detected_ytd": det_ytd,
                "layout": "modern_v2_english_anchored",
                "table_index": table_idx,
                "page": page_num + 1,
                "is_total": is_total
            })
                
    return results

if __name__ == "__main__":
    test_file = "pdfs/मासिक_गुन्हे_अहवाल_माहे_-_नोव्हेंबर,२०२५.pdf"
    if os.path.exists(test_file):
        data = extract_modern_v2(test_file)
        print(json.dumps(data, indent=2, ensure_ascii=False))
