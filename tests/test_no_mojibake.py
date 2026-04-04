from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIRS = ("client/src", "server", "shared")
SOURCE_EXTENSIONS = {".ts", ".tsx"}
MOJIBAKE_MARKERS = ['РџР', 'РЎР', 'РќР', 'РўС', 'Р’С', 'СЃ', 'С‚', 'вЂ', 'в†', 'Р‘Р', 'Р§Р', 'Р\xa0В', 'РЎР‚', 'РЎвЂ', 'СЊ', 'СЏР', 'Р\x98']


def iter_source_files():
    for relative_dir in SOURCE_DIRS:
        base_dir = ROOT / relative_dir
        for path in sorted(base_dir.rglob("*")):
            if path.is_file() and path.suffix in SOURCE_EXTENSIONS:
                yield path


def find_mojibake_lines(text: str):
    findings = []

    for line_number, line in enumerate(text.splitlines(), start=1):
        if any(marker in line for marker in MOJIBAKE_MARKERS):
            findings.append((line_number, line.strip()))

    return findings


def test_source_files_do_not_contain_mojibake_sequences():
    findings = []

    for path in iter_source_files():
        text = path.read_text(encoding="utf-8")
        for line_number, line in find_mojibake_lines(text):
            findings.append(f"{path.relative_to(ROOT)}:{line_number}: {line}")

    assert not findings, "Found mojibake in source files:\n" + "\n".join(findings)
