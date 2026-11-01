"""Independent deterministic baseline; this is not a trained AI model."""
import re
import unicodedata

VOCABULARY = {
    "python": ["python", "بايثون"], "sql": ["sql"],
    "kotlin": ["kotlin", "كوتلن"], "android": ["android", "أندرويد", "اندرويد"],
    "java": ["java", "جافا"], "javascript": ["javascript", "جافاسكريبت"],
    "docker": ["docker"], "react": ["react"], "postgresql": ["postgresql", "postgres"],
}

def normalize(value):
    return unicodedata.normalize("NFKC", value).casefold().strip()

def extract_skills(text):
    text = normalize(text)
    return sorted(skill for skill, aliases in VOCABULARY.items()
                  if any(re.search(r"(?<!\w)" + re.escape(a) + r"(?!\w)", text) for a in aliases))

def match(candidate, required):
    have = {normalize(s) for s in candidate}
    need = {normalize(s) for s in required}
    return {"method": "skill-overlap-v1", "score": round(100 * len(have & need) / len(need)) if need else None,
            "matched": sorted(have & need), "missing": sorted(need - have),
            "notice": "Advisory skill coverage; never an automated hiring decision."}
