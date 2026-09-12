import uuid
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.domain_models import BusinessMembership
from app.domain_schemas import ActiveBusinessUpdate, UserOut
from app.security import get_db, get_user_session
from app.api.v1.routes_auth import serialize_user

router = APIRouter(prefix="/auth", tags=["auth"])

@router.patch("/active-business", response_model=UserOut)
def set_active_business(payload: ActiveBusinessUpdate, request: Request, db: Session = Depends(get_db)) -> UserOut:
    user, session = get_user_session(request, db)
    if not db.query(BusinessMembership).filter(BusinessMembership.user_id == user.id, BusinessMembership.business_id == payload.business_id).first():
        raise HTTPException(status_code=403, detail="Business access denied")
    session.active_business_id = payload.business_id; db.commit(); db.refresh(session)
    return serialize_user(db, user, session)
