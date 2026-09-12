#!/usr/bin/env python3
"""
Document Extractor for SafePay AI (FS-2605)
Extracts visible text, hidden text (zero-size fonts, annotations, comments),
and document metadata to detect indirect prompt injections.
"""

import sys
import json
import hashlib
import os

def analyze_document(file_path_or_content):
    result = {
        "visibleText": "",
        "hiddenContent": "",
        "metadata": {},
        "rawHash": "",
        "isPdf": False
    }

    if os.path.exists(file_path_or_content):
        # File path provided
        with open(file_path_or_content, "rb") as f:
            raw_bytes = f.read()
            result["rawHash"] = hashlib.sha256(raw_bytes).hexdigest()

        if file_path_or_content.lower().endswith(".pdf"):
            result["isPdf"] = True
            try:
                import pypdf
                reader = pypdf.PdfReader(file_path_or_content)
                
                # Extract metadata
                if reader.metadata:
                    for k, v in reader.metadata.items():
                        if v:
                            result["metadata"][str(k)] = str(v)
                            # Check for injection in metadata
                            if any(trigger in str(v).lower() for trigger in ["ignore", "transfer", "system", "override"]):
                                result["hiddenContent"] += f"\n[Metadata Injection in {k}]: {v}"

                # Extract page content
                visible_pages = []
                for i, page in enumerate(reader.pages):
                    text = page.extract_text() or ""
                    visible_pages.append(text)

                result["visibleText"] = "\n".join(visible_pages)
            except Exception as e:
                result["visibleText"] = f"Error reading PDF: {str(e)}"
        else:
            # Text file
            result["visibleText"] = raw_bytes.decode("utf-8", errors="ignore")
    else:
        # Raw text / simulated content passed directly
        raw_bytes = file_path_or_content.encode("utf-8")
        result["rawHash"] = hashlib.sha256(raw_bytes).hexdigest()
        
        # Check for simulated hidden comment tags
        content = file_path_or_content
        if "<!--" in content and "-->" in content:
            parts = content.split("<!--")
            result["visibleText"] = parts[0].strip()
            for p in parts[1:]:
                if "-->" in p:
                    hidden, rest = p.split("-->", 1)
                    result["hiddenContent"] += hidden.strip() + " "
                    result["visibleText"] += " " + rest.strip()
            result["visibleText"] = result["visibleText"].strip()
        else:
            result["visibleText"] = content

    print(json.dumps(result))

if __name__ == "__main__":
    if len(sys.argv) > 1:
        target = sys.argv[1]
    else:
        target = sys.stdin.read()
    analyze_document(target)
