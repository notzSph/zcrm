from fastapi import APIRouter, Depends, HTTPException

from app.caldav import CalDAVError, calendar_url, configured
from app.security import RequestContext, require_context

router = APIRouter(tags=["calendar"])


@router.get("/calendar/caldav")
def caldav_status(_: RequestContext = Depends(require_context)) -> dict[str, str | bool]:
    if not configured():
        return {"enabled": False, "configured": False}
    try:
        url = calendar_url()
    except CalDAVError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"enabled": True, "configured": True, "calendar_url": url}
