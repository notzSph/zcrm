import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session, selectinload
from app.domain_models import Business, BusinessMembership, User, UserSession
from app.domain_schemas import BusinessCreate, BusinessOut, BusinessUpdate, MemberAdd, MemberOut, MemberRoleUpdate, OwnershipTransfer
from app.security import get_db, get_user_session
from app.api.v1.routes_auth import serialize_user

router = APIRouter(prefix="/businesses", tags=["businesses"])

def business_for_user(db: Session, user_id: uuid.UUID, business_id: uuid.UUID) -> Business:
    business = db.query(Business).join(BusinessMembership).filter(Business.id == business_id, BusinessMembership.user_id == user_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    return business

def admin_membership(db: Session, user_id: uuid.UUID, business_id: uuid.UUID) -> BusinessMembership:
    membership = db.query(BusinessMembership).filter(BusinessMembership.user_id == user_id, BusinessMembership.business_id == business_id).first()
    if not membership: raise HTTPException(status_code=404, detail="Business not found")
    if not membership.is_admin: raise HTTPException(status_code=403, detail="Business admin access is required")
    return membership

@router.get("", response_model=list[BusinessOut])
def list_businesses(request: Request, db: Session = Depends(get_db)) -> list[Business]:
    user, _ = get_user_session(request, db)
    return [item.business for item in db.query(BusinessMembership).options(selectinload(BusinessMembership.business)).filter(BusinessMembership.user_id == user.id).all()]

@router.post("", response_model=BusinessOut, status_code=status.HTTP_201_CREATED)
def create_business(payload: BusinessCreate, request: Request, db: Session = Depends(get_db)) -> Business:
    user, _ = get_user_session(request, db); business = Business(name=payload.name.strip(), owner_id=user.id); db.add(business); db.flush(); db.add(BusinessMembership(user_id=user.id, business_id=business.id, is_admin=True)); db.commit(); db.refresh(business); return business

@router.get("/{business_id}", response_model=BusinessOut)
def get_business(business_id: uuid.UUID, request: Request, db: Session = Depends(get_db)) -> Business:
    user, _ = get_user_session(request, db); return business_for_user(db, user.id, business_id)

@router.patch("/{business_id}", response_model=BusinessOut)
def update_business(business_id: uuid.UUID, payload: BusinessUpdate, request: Request, db: Session = Depends(get_db)) -> Business:
    user, _ = get_user_session(request, db); admin_membership(db, user.id, business_id); business = business_for_user(db, user.id, business_id); business.name = payload.name.strip(); db.commit(); db.refresh(business); return business

@router.delete("/{business_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_business(business_id: uuid.UUID, request: Request, db: Session = Depends(get_db)) -> None:
    user, _ = get_user_session(request, db); admin_membership(db, user.id, business_id); business = business_for_user(db, user.id, business_id)
    db.query(UserSession).filter(UserSession.active_business_id == business.id).update({"active_business_id": None})
    db.delete(business); db.commit()

@router.get("/{business_id}/members", response_model=list[MemberOut])
def list_members(business_id: uuid.UUID, request: Request, db: Session = Depends(get_db)) -> list[MemberOut]:
    user, session = get_user_session(request, db); business_for_user(db, user.id, business_id)
    members = db.query(BusinessMembership).options(selectinload(BusinessMembership.user)).filter(BusinessMembership.business_id == business_id).all()
    return [MemberOut(id=member.user.id, email=member.user.email, display_name=member.user.display_name, profile_pic=member.user.profile_pic, is_admin=member.is_admin) for member in members]

@router.post("/{business_id}/members", status_code=status.HTTP_204_NO_CONTENT)
def add_member(business_id: uuid.UUID, payload: MemberAdd, request: Request, db: Session = Depends(get_db)) -> None:
    user, _ = get_user_session(request, db); admin_membership(db, user.id, business_id)
    member = db.query(User).filter(User.email == payload.email.lower()).first()
    if not member: raise HTTPException(status_code=404, detail="User not found")
    if not db.query(BusinessMembership).filter(BusinessMembership.user_id == member.id, BusinessMembership.business_id == business_id).first():
        db.add(BusinessMembership(user_id=member.id, business_id=business_id, is_admin=False)); db.commit()

@router.patch("/{business_id}/owner", response_model=BusinessOut)
def transfer_ownership(business_id: uuid.UUID, payload: OwnershipTransfer, request: Request, db: Session = Depends(get_db)) -> Business:
    user, _ = get_user_session(request, db); admin_membership(db, user.id, business_id)
    business = business_for_user(db, user.id, business_id)
    target = db.query(BusinessMembership).filter(BusinessMembership.user_id == payload.user_id, BusinessMembership.business_id == business_id).first()
    if not target: raise HTTPException(status_code=400, detail="Owner must already be a business member")
    target.is_admin = True; business.owner_id = payload.user_id
    db.commit(); db.refresh(business)
    return business

@router.patch("/{business_id}/members/{member_id}", response_model=MemberOut)
def update_member_role(business_id: uuid.UUID, member_id: uuid.UUID, payload: MemberRoleUpdate, request: Request, db: Session = Depends(get_db)) -> MemberOut:
    user, _ = get_user_session(request, db); admin_membership(db, user.id, business_id)
    membership = db.query(BusinessMembership).filter(BusinessMembership.user_id == member_id, BusinessMembership.business_id == business_id).first()
    if not membership: raise HTTPException(status_code=404, detail="Member not found")
    if membership.is_admin and not payload.is_admin and db.query(BusinessMembership).filter(BusinessMembership.business_id == business_id, BusinessMembership.is_admin.is_(True)).count() == 1:
        raise HTTPException(status_code=400, detail="Business must retain an admin")
    membership.is_admin = payload.is_admin; db.commit(); db.refresh(membership)
    member = db.get(User, member_id)
    return MemberOut(id=member.id, email=member.email, display_name=member.display_name, profile_pic=member.profile_pic, is_admin=membership.is_admin)
