import pdfplumber
import camelot
import os

class LayoutType:
    MODERN_ENGLISH_BORDERED = "modern_english_bordered"
    LEGACY_MARATHI_TEXT = "legacy_marathi_text"
    SCANNED = "scanned"
    UNKNOWN = "unknown"

class PdfRouter:
    def __init__(self, pdf_dir="pdfs"):
        self.pdf_dir = pdf_dir

    def classify(self, pdf_path):
        """
        Classifies a PDF into a layout type.
        """
        try:
            with pdfplumber.open(pdf_path) as pdf:
                if len(pdf.pages) == 0:
                    return LayoutType.UNKNOWN
                
                # Sample the first page for keywords
                first_page = pdf.pages[0]
                text = first_page.extract_text()
                
                if not text or len(text.strip()) < 50:
                    return LayoutType.SCANNED
                
                # Check for modern English headers
                if "COMPARATIVE STATEMENT" in text or "CRIME HEADS" in text:
                    return LayoutType.MODERN_ENGLISH_BORDERED
                
                # Check for legacy Marathi headers
                if "गुन्हयाचा प्रकार" in text or "दाखल" in text:
                    return LayoutType.LEGACY_MARATHI_TEXT
                
                return LayoutType.UNKNOWN
        except Exception as e:
            print(f"Error classifying {pdf_path}: {e}")
            return LayoutType.UNKNOWN

if __name__ == "__main__":
    router = PdfRouter()
    # Test with a few known files
    test_files = [
        "मासिक_गुन्हे_अहवाल_माहे_-_नोव्हेंबर,२०२५.pdf",  # Modern
        "मासिक_गुन्हे_अहवाल_माहे_-_मार्च,_२०२१.pdf"      # Legacy (Assuming)
    ]
    
    for f in test_files:
        path = os.path.join("pdfs", f)
        if os.path.exists(path):
            print(f"{f}: {router.classify(path)}")
