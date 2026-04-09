import hashlib

class DataFingerprinter:
    def get_file_hash(self, filepath):
        """
        Generates a SHA-256 hash of the file content for deduplication.
        """
        sha256_hash = hashlib.sha256()
        try:
            with open(filepath, "rb") as f:
                # Read and update hash string value in blocks of 4K
                for byte_block in iter(lambda: f.read(4096), b""):
                    sha256_hash.update(byte_block)
            return sha256_hash.hexdigest()
        except Exception:
            return None
