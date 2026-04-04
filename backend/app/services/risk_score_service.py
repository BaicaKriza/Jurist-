"""Risk Score Calculator for Procedures."""
from __future__ import annotations
import re
from typing import Optional
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.models.procedure import Procedure, ProcedureStatus

_VAGUE_PATTERNS = re.compile(
    r"(shërbime\s+të\s+ndryshme|blerje\s+të\s+përgjithshme|sipas\s+specifikimeve|"
    r"materiale\s+të\s+ndryshme|punë\s+të\s+ndryshme|objekt\s+i\s+gjerë|"
    r"furnizim\s+i\s+përgjithshëm)",
    re.IGNORECASE,
)

def _is_vague_object(description):
    if not description:
        return False
    return bool(_VAGUE_PATTERNS.search(description)) or len(description.strip()) < 15

def _cpv_mismatch(cpv, description):
    if not cpv or not description:
        return False
    desc_lower = description.lower()
    prefix = cpv[:2]
    mismatches = {"45": ["ndërtim","rikonstruksion","rehabilitim"], "71": ["projektim","konsulencë","mbikëqyrje"], "33": ["mjekësi","farmaceutik","spital"], "34": ["automjet","transport"]}
    for cpv_prefix, keywords in mismatches.items():
        if any(kw in desc_lower for kw in keywords) and prefix != cpv_prefix:
            return True
    return False

def _atypical_deadline(procedure):
    if not procedure.publication_date or not procedure.closing_date:
        return False
    delta = (procedure.closing_date - procedure.publication_date).days
    return delta < 5 or delta > 120

def calculate_risk_score(db: Session, procedure_id: str) -> dict:
    procedure = db.get(Procedure, procedure_id)
    if not procedure:
        return {"procedure_id": procedure_id, "total_score": 0, "risk_level": "UNKNOWN", "factors": [], "recommendation": "Procedura nuk u gjet."}
    factors = []
    total = 0
    if procedure.status == ProcedureStatus.CANCELLED:
        factors.append({"name": "Procedurë e anuluar", "score": 30, "description": "Kjo procedurë ka statusin CANCELLED."})
        total += 30
    if procedure.authority_name and procedure.cpv_code:
        cancel_count = db.scalar(select(func.count(Procedure.id)).where(Procedure.authority_name == procedure.authority_name, Procedure.cpv_code == procedure.cpv_code, Procedure.status == ProcedureStatus.CANCELLED)) or 0
        if cancel_count >= 2:
            factors.append({"name": "Autoriteti me shumë anulime në CPV", "score": 20, "description": f"{procedure.authority_name} ka {cancel_count} anulime në CPV {procedure.cpv_code}."})
            total += 20
    if _cpv_mismatch(procedure.cpv_code, procedure.object_description):
        factors.append({"name": "CPV nuk përputhet me objektin", "score": 25, "description": "Kodi CPV nuk duket i përshtatshëm."})
        total += 25
    if _atypical_deadline(procedure):
        delta_days = (procedure.closing_date - procedure.publication_date).days if procedure.publication_date and procedure.closing_date else 0
        factors.append({"name": "Afate jo tipike", "score": 15, "description": f"Periudha ({delta_days} ditë) jashtë intervalit 5-120 ditë."})
        total += 15
    if _is_vague_object(procedure.object_description):
        factors.append({"name": "Objekt i paqartë", "score": 10, "description": "Përshkrimi i objektit është shumë i shkurtër ose i përgjithshëm."})
        total += 10
    risk_level = "HIGH" if total >= 70 else "MEDIUM" if total >= 30 else "LOW"
    recs = {"LOW": "Risk i ulët — procedura duket standarde.", "MEDIUM": "Risk mesatar — rekomandohet verifikim.", "HIGH": "Risk i lartë — rekomandohet analizë e thellë juridike."}
    return {"procedure_id": procedure_id, "total_score": total, "risk_level": risk_level, "factors": factors, "recommendation": recs.get(risk_level, "")}
