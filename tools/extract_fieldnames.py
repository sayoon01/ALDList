import csv
import os
from pathlib import Path

# 작업 디렉토리 설정
base_dir = Path(__file__).parent

# 모든 CSV 파일 찾기
csv_files = sorted(base_dir.glob("*.csv"))

# 모든 필드명을 저장할 집합 (중복 제거)
all_fieldnames = set()

# 각 CSV 파일에서 필드명 추출
for csv_file in csv_files:
    try:
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            # 첫 번째 줄(헤더) 읽기
            headers = next(reader)
            # 필드명 추가
            all_fieldnames.update(headers)
            print(f"처리 완료: {csv_file.name} ({len(headers)}개 필드)")
    except Exception as e:
        print(f"오류 발생 ({csv_file.name}): {e}")

# 리스트로 변환하고 정렬
fieldnames_list = sorted(list(all_fieldnames))

print(f"\n총 {len(csv_files)}개 파일에서 {len(fieldnames_list)}개의 고유 필드명을 추출했습니다.")

# Python 파일로 저장
py_output = base_dir / "fieldnames_list.py"
with open(py_output, 'w', encoding='utf-8') as f:
    f.write("# CSV 파일들에서 추출한 모든 필드명 리스트\n")
    f.write(f"# 총 {len(fieldnames_list)}개의 고유 필드명\n\n")
    f.write("fieldnames = [\n")
    for fieldname in fieldnames_list:
        # 필드명에 특수문자가 있을 수 있으므로 따옴표 처리
        f.write(f"    '{fieldname}',\n")
    f.write("]\n")

print(f"Python 파일로 저장 완료: {py_output}")

# 텍스트 파일로도 저장
txt_output = base_dir / "fieldnames_list.txt"
with open(txt_output, 'w', encoding='utf-8') as f:
    f.write(f"# CSV 파일들에서 추출한 모든 필드명 리스트\n")
    f.write(f"# 총 {len(fieldnames_list)}개의 고유 필드명\n\n")
    for fieldname in fieldnames_list:
        f.write(f"{fieldname}\n")

print(f"텍스트 파일로 저장 완료: {txt_output}")

