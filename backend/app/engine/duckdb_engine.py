"""DuckDB를 사용한 CSV 쿼리 엔진"""
from __future__ import annotations
import duckdb
from typing import List, Dict, Any, Optional, Callable
from pathlib import Path
from .duckdb_cache import get_cache


def quote_ident(name: str) -> str:
    """식별자 따옴표 처리"""
    return f'"{name.replace('"', '""')}"'


def preview_rows(
    csv_path: str,
    offset: int = 0,
    limit: int = 2000,
    columns: Optional[List[str]] = None,
    dataset_id: Optional[str] = None,  # 캐시를 위한 dataset_id
) -> tuple[List[Dict[str, Any]], List[str]]:
    """CSV 미리보기 - View 캐싱 지원"""
    cache = get_cache()
    
    # dataset_id가 제공되면 View 캐싱 사용, 아니면 기존 방식 (fallback)
    if dataset_id:
        try:
            # View 캐시 사용
            view_query = cache.get_view_query(dataset_id, csv_path)
            conn = cache._get_or_create_connection(dataset_id)
            print(f"[Preview] Using DuckDB View cache for dataset {dataset_id}: {view_query}")
            
            # 컬럼 목록 조회
            if columns is None:
                try:
                    col_query = f"DESCRIBE SELECT * FROM {view_query}"
                    col_result = conn.execute(col_query).fetchall()
                    columns = [row[0] for row in col_result]
                except Exception:
                    # DESCRIBE 실패 시 실제 데이터 1행을 읽어서 컬럼 추출
                    test_query = f"SELECT * FROM {view_query} LIMIT 1"
                    result = conn.execute(test_query)
                    columns = [desc[0] for desc in result.description]
                    result.close()
            
            # 컬럼 선택
            if columns:
                col_list = ", ".join(quote_ident(c) for c in columns)
                query = f"""
                SELECT {col_list}
                FROM {view_query}
                LIMIT {limit} OFFSET {offset}
                """
            else:
                query = f"""
                SELECT *
                FROM {view_query}
                LIMIT {limit} OFFSET {offset}
                """
            
            result = conn.execute(query).fetchall()
            
            # 딕셔너리로 변환
            rows = []
            for row in result:
                row_dict = {}
                for i, col in enumerate(columns):
                    value = row[i] if i < len(row) else None
                    row_dict[col] = value
                rows.append(row_dict)
            
            return rows, columns
        except Exception as e:
            # 캐시 사용 실패 시 기존 방식으로 fallback
            print(f"Warning: Cache failed for {dataset_id}, using fallback: {e}")
    
    # Fallback: 기존 방식 (캐시 없이) - preview는 all_varchar로 빠르게 읽기
    conn = duckdb.connect()
    
    try:
        # 경로 정규화 (Windows 경로 처리)
        csv_path_normalized = str(Path(csv_path).resolve())
        
        # 컬럼 목록 조회
        if columns is None:
            try:
                # DuckDB의 DESCRIBE 사용 (all_varchar로 빠르게)
                col_query = f"DESCRIBE SELECT * FROM read_csv('{csv_path_normalized}', all_varchar=true, header=true)"
                col_result = conn.execute(col_query).fetchall()
                columns = [row[0] for row in col_result]
            except Exception:
                # DESCRIBE 실패 시 실제 데이터 1행을 읽어서 컬럼 추출
                test_query = f"SELECT * FROM read_csv('{csv_path_normalized}', all_varchar=true, header=true) LIMIT 1"
                result = conn.execute(test_query)
                columns = [desc[0] for desc in result.description]
                result.close()
        
        # 컬럼 선택 - preview는 all_varchar로 빠르게 읽기 (타입 추정 스킵)
        if columns:
            col_list = ", ".join(quote_ident(c) for c in columns)
            query = f"""
            SELECT {col_list}
            FROM read_csv('{csv_path_normalized}', all_varchar=true, header=true)
            LIMIT {limit} OFFSET {offset}
            """
        else:
            query = f"""
            SELECT *
            FROM read_csv('{csv_path_normalized}', all_varchar=true, header=true)
            LIMIT {limit} OFFSET {offset}
            """
        
        result = conn.execute(query).fetchall()
        
        # 딕셔너리로 변환 (None 값을 빈 문자열로 변환하지 않음)
        rows = []
        for row in result:
            row_dict = {}
            for i, col in enumerate(columns):
                value = row[i] if i < len(row) else None
                row_dict[col] = value
            rows.append(row_dict)
        
        return rows, columns
    finally:
        conn.close()


# 메트릭 레지스트리: 확장 포인트
METRICS: Dict[str, Callable[[str], str]] = {
    "count": lambda expr: f"COUNT(*)",
    "non_null_count": lambda expr: f"COUNT({expr})",
    "min": lambda expr: f"MIN({expr})",
    "max": lambda expr: f"MAX({expr})",
    "avg": lambda expr: f"AVG(TRY_CAST({expr} AS DOUBLE))",
    "stddev": lambda expr: f"STDDEV(TRY_CAST({expr} AS DOUBLE))",
}


def compute_metrics(
    csv_path: str,
    columns: List[str],
    row_start: int = 0,
    row_end: Optional[int] = None,
    dataset_id: Optional[str] = None,  # 캐시를 위한 dataset_id
) -> Dict[str, Dict[str, Any]]:
    """통계 계산 - 한 번의 쿼리로 모든 컬럼 통계 계산 (View 캐싱 지원)"""
    cache = get_cache()
    
    # dataset_id가 제공되면 View 캐싱 사용, 아니면 기존 방식 (fallback)
    use_cache = dataset_id is not None
    
    if use_cache:
        try:
            # View 캐시 사용
            view_query = cache.get_view_query(dataset_id, csv_path)
            conn = cache._get_or_create_connection(dataset_id)
            print(f"[Stats] Using DuckDB View cache for dataset {dataset_id}: {view_query}")
            print(f"[Stats] Computing metrics for {len(columns)} columns")
        except Exception as e:
            # 캐시 사용 실패 시 기존 방식으로 fallback
            print(f"Warning: Cache failed for {dataset_id}, using fallback: {e}")
            use_cache = False
    
    if not use_cache:
        # Fallback: 기존 방식 (캐시 없이)
        conn = duckdb.connect()
        csv_path_normalized = str(Path(csv_path).resolve())
        view_query = f"read_csv_auto('{csv_path_normalized}')"
    
    try:
        # 서브쿼리로 범위 지정
        if row_end is not None:
            limit_count = row_end - row_start
            base_query = f"""
            SELECT * FROM {view_query}
            LIMIT {limit_count} OFFSET {row_start}
            """
        else:
            base_query = f"""
            SELECT * FROM {view_query}
            OFFSET {row_start}
            """
        
        # 기본 메트릭 (모든 컬럼에 대해)
        base_metrics = ["count", "non_null_count", "min", "max"]
        # 숫자 메트릭 (모든 컬럼에 대해 시도, TRY_CAST로 안전하게 처리)
        numeric_metrics = ["avg", "stddev"]
        
        select_parts = []
        metric_keys = []  # (col, metric) 매핑
        
        for col in columns:
            col_quoted = quote_ident(col)
            
            # 기본 메트릭 (모든 컬럼)
            for metric_name in base_metrics:
                alias = f"{col}__{metric_name}"
                expr = col_quoted
                select_parts.append(f"{METRICS[metric_name](expr)} AS {quote_ident(alias)}")
                metric_keys.append((col, metric_name))
            
            # 숫자 메트릭 (모든 컬럼에 대해 시도, TRY_CAST로 안전하게 처리)
            for metric_name in numeric_metrics:
                alias = f"{col}__{metric_name}"
                expr = col_quoted
                select_parts.append(f"{METRICS[metric_name](expr)} AS {quote_ident(alias)}")
                metric_keys.append((col, metric_name))
        
        # 한 번의 쿼리로 모든 통계 계산
        if not select_parts:
            # 컬럼이 없으면 빈 결과 반환
            return {col: {"count": 0, "non_null_count": 0} for col in columns}
        
        query = f"SELECT {', '.join(select_parts)} FROM ({base_query})"
        
        try:
            result_row = conn.execute(query).fetchone()
            
            if result_row is None:
                # 결과가 없으면 빈 메트릭 반환
                return {col: {"count": 0, "non_null_count": 0} for col in columns}
            
            # 결과를 dict로 reshape
            metrics: Dict[str, Dict[str, Any]] = {col: {} for col in columns}
            
            for (col, metric_name), value in zip(metric_keys, result_row):
                if value is None:
                    metrics[col][metric_name] = None
                elif metric_name == "count":
                    metrics[col][metric_name] = int(value) if value is not None else 0
                elif metric_name == "non_null_count":
                    metrics[col][metric_name] = int(value) if value is not None else 0
                elif metric_name in ["min", "max"]:
                    # MIN/MAX는 원본 값 유지 (문자열/숫자 모두 가능)
                    # 숫자로 변환 가능하면 변환, 아니면 문자열로 유지
                    try:
                        # 숫자로 변환 시도
                        float_val = float(value)
                        # 정수인지 확인
                        if float_val.is_integer():
                            metrics[col][metric_name] = int(float_val)
                        else:
                            metrics[col][metric_name] = float_val
                    except (ValueError, TypeError):
                        # 숫자 변환 실패 시 문자열로 유지
                        metrics[col][metric_name] = str(value)
                elif metric_name in ["avg", "stddev"]:
                    # 숫자 메트릭 (TRY_CAST로 이미 NULL 처리됨)
                    try:
                        metrics[col][metric_name] = float(value) if value is not None else None
                    except (ValueError, TypeError):
                        metrics[col][metric_name] = None
                else:
                    metrics[col][metric_name] = value
            
            return metrics
            
        except Exception as e:
            # 쿼리 실패 시 오류 로깅 및 반환
            import traceback
            error_msg = f"{str(e)}\n{traceback.format_exc()}"
            print(f"통계 계산 오류: {error_msg}")  # 디버깅용
            
            # 쿼리 실패 시 각 컬럼에 오류 반환
            return {
                col: {
                    "count": 0,
                    "non_null_count": 0,
                    "error": str(e)
                }
                for col in columns
            }
    finally:
        # 캐시를 사용하지 않은 경우에만 connection 닫기
        if not use_cache:
            conn.close()

