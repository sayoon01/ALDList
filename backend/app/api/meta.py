# backend/app/api/meta.py
from __future__ import annotations

from fastapi import APIRouter

from ..core.column_meta import get_store
from ..models.schemas import MetaTypesResponse

router = APIRouter(prefix="/api/meta", tags=["meta"])


@router.get("/types", response_model=MetaTypesResponse)
def meta_types():
    """
    UI용 타입 메타:
    - types: allowed types 목록 (order 우선 정렬)
    - labels: type -> label
    - order: type 순서 (없으면 None)
    """
    store = get_store()
    store.ensure_loaded()

    # allowed types
    types: list[str] = store.get_allowed_types()

    # patterns.yaml에서 type_labels/type_order를 같이 내려주기
    labels = store.get_ui_type_labels()  # Dict[str, str]
    order = store.get_ui_type_order()  # Optional[List[str]]

    # order가 있으면 types를 order 우선으로 재정렬
    if order:
        order_set = set(order)
        # order에 있는 것 먼저 + 나머지(새로 등장한 타입) 뒤
        types_sorted: list[str] = [t for t in order if t in types]
        types_sorted += [t for t in types if t not in order_set]
        types = types_sorted

    # labels 없는 타입은 type 그대로 노출(프론트에서도 fallback 가능)
    return {"types": types, "labels": labels, "order": order}
