import logging
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.folder import FolderCreate, FolderUpdate, FolderResponse, FolderTreeResponse
from app.services.folder_service import FolderService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["folders"])


@router.get(
    "/companies/{company_id}/folders",
    response_model=List[FolderTreeResponse],
    summary="Get folder tree for a company",
)
def get_folder_tree(
    company_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> List[FolderTreeResponse]:
    """Return the full hierarchical folder tree for a company, including document counts."""
    service = FolderService(db)
    return service.get_folder_tree(company_id)


@router.post(
    "/companies/{company_id}/folders",
    response_model=FolderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a folder for a company",
)
def create_folder(
    company_id: str,
    payload: FolderCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> FolderResponse:
    """Create a new folder (custom or typed) under a company, optionally nested under a parent."""
    service = FolderService(db)
    folder = service.create_folder(company_id, payload)
    logger.info(f"Folder '{folder.name}' created for company {company_id}")
    result = service.get_folder_with_doc_count(folder.id, company_id)
    return FolderResponse(
        id=folder.id,
        company_id=folder.company_id,
        name=folder.name,
        folder_type=folder.folder_type,
        parent_id=folder.parent_id,
        path=folder.path,
        sort_order=folder.sort_order,
        created_at=folder.created_at,
        document_count=result["document_count"],
    )


@router.patch(
    "/companies/{company_id}/folders/{folder_id}",
    response_model=FolderResponse,
    summary="Update a folder",
)
def update_folder(
    company_id: str,
    folder_id: str,
    payload: FolderUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> FolderResponse:
    """Update the name, type, parent, or sort order of a folder."""
    service = FolderService(db)
    folder = service.update_folder(folder_id, company_id, payload)
    result = service.get_folder_with_doc_count(folder.id, company_id)
    return FolderResponse(
        id=folder.id,
        company_id=folder.company_id,
        name=folder.name,
        folder_type=folder.folder_type,
        parent_id=folder.parent_id,
        path=folder.path,
        sort_order=folder.sort_order,
        created_at=folder.created_at,
        document_count=result["document_count"],
    )


@router.delete(
    "/companies/{company_id}/folders/{folder_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a folder",
)
def delete_folder(
    company_id: str,
    folder_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> None:
    """Delete a folder. Fails if the folder still contains documents."""
    service = FolderService(db)
    service.delete_folder(folder_id, company_id)
    logger.info(f"Folder {folder_id} deleted from company {company_id}")
