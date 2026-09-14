from fastapi import APIRouter, Depends, HTTPException

from app.caldav import CalDAVError, calendar_url, configured
from app.security import RequestContext, require_context

router = APIRouter(tags=["calendar"])


@router.get("/calendar/caldav")
def caldav_status(context: RequestContext = Depends(require_context)) -> dict[str, str | bool]:
    try:
        if not configured(context.user):
            return {"enabled": False, "configured": False}
        url = calendar_url(context.user)
    except CalDAVError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"enabled": True, "configured": True, "calendar_url": url}
