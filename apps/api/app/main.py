import os
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.v1.routes_auth import router as auth_router
from app.api.v1.routes_businesses import router as businesses_router
from app.api.v1.routes_context import router as context_router
from app.api.v1.routes_leads import router as leads_router
from app.api.v1.routes_agent import router as agent_router
from app.core.config import settings
from app.deps import get_db
from app.domain_models import Business, BusinessMembership, User
from app.security import hash_password

app = FastAPI(title=settings.project_name, version="0.3.0")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.get("/health")
def health() -> dict[str, str]: return {"status": "ok"}

@app.get("/ready")
def ready(db: Session = Depends(get_db)) -> dict[str, str]:
    try: db.execute(text("SELECT 1"))
    except Exception as exc: raise HTTPException(status_code=503, detail="database unavailable") from exc
    return {"status": "ready"}

@app.on_event("startup")
def seed_admin() -> None:
    password_hash = os.getenv("ADMIN_PASSWORD_HASH", "")
    if not password_hash:
        return
    db = next(get_db())
    try:
        if db.query(User).first():
            return
        email = os.getenv("ADMIN_EMAIL", "admin@zcrm.local").lower()
        user = User(email=email, display_name=email.split("@", 1)[0], password_hash=password_hash)
        business = Business(name=os.getenv("DEFAULT_BUSINESS_NAME", "zCRM workspace"))
        db.add_all([user, business]); db.flush(); db.add(BusinessMembership(user_id=user.id, business_id=business.id)); db.commit()
    finally:
        db.close()

app.include_router(auth_router, prefix="/api/v1/auth")
app.include_router(context_router, prefix="/api/v1")
app.include_router(businesses_router, prefix="/api/v1")
app.include_router(leads_router, prefix="/api/v1")
app.include_router(agent_router, prefix="/api/v1")
