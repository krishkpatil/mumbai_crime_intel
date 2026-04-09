import pdfplumber
import json
import re
import os

# Load mapping relative to script directory
_curr_dir = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(_curr_dir, 'mapping.json'), 'r', encoding='utf-8') as f:
    mapping = json.load(f)

def extract_legacy_marathi(pdf_path):
    """
    Extracts data from legacy Marathi text-based PDFs using pdfplumber.
    """
    print(f"Using Legacy Marathi Parser for {pdf_path}")
    data = []
    
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            text = page.extract_text()
            if not text:
                continue
            
            lines = text.split('\n')
            for line in lines:
                matched_category = None
                # Search for Marathi category labels
                for cat_key, meta in mapping['crime_categories'].items():
                    if cat_key in line:
                        matched_category = meta['label']
                        break
                
                if matched_category:
                    numbers = re.findall(r'\d+', line)
                    if len(numbers) >= 2:
                        # Heuristic: SrNo is usually first if it matches ^\d+
                        if re.match(r'^\s*\d+', line):
                            reg = int(numbers[1]) if len(numbers) > 1 else 0
                            det = int(numbers[2]) if len(numbers) > 2 else 0
                        else:
                            reg = int(numbers[0])
                            det = int(numbers[1])
                            
                        data.append({
                            'crime_type': matched_category,
                            'registered': reg,
                            'detected': det,
                            'layout': 'legacy_marathi_text'
                        })
    return data

if __name__ == "__main__":
    # Test with a known legacy file
    test_file = "pdfs/मासिक_गुन्हे_अहवाल_माहे_-_मार्च,_२०२१.pdf"
    if os.path.exists(test_file):
        result = extract_legacy_marathi(test_file)
        print(json.dumps(result, indent=2, ensure_ascii=False))
