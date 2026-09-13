"""Small iCloud CalDAV client used to mirror zCRM reminders."""

from __future__ import annotations

import base64
from datetime import UTC, datetime, timedelta
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

from app.core.config import settings
from app.domain_models import Lead, Reminder

DAV_NS = "DAV:"
CALDAV_NS = "urn:ietf:params:xml:ns:caldav"
APPLE_CALDAV_NS = "http://calendarserver.org/ns/"
NS = {"d": DAV_NS, "c": CALDAV_NS, "a": APPLE_CALDAV_NS}


class CalDAVError(RuntimeError):
    """A user-safe error raised when the configured calendar cannot be reached."""


def configured() -> bool:
    return settings.caldav_enabled and bool(settings.caldav_username and settings.caldav_app_password)


def _href(response: ET.Element) -> str:
    value = response.findtext(".//d:current-user-principal/d:href", namespaces=NS)
    if not value:
        value = response.findtext(".//d:principal-URL/d:href", namespaces=NS)
    if not value:
        raise CalDAVError("CalDAV account did not return a principal URL")
    return value.strip()


def _request(url: str, method: str, body: bytes | None = None, content_type: str = "application/xml; charset=utf-8") -> ET.Element | None:
    auth = base64.b64encode(f"{settings.caldav_username}:{settings.caldav_app_password}".encode()).decode()
    request = Request(url, data=body, method=method, headers={
        "Authorization": f"Basic {auth}",
        "Content-Type": content_type,
        "Depth": "0",
        "User-Agent": "zCRM CalDAV integration",
    })
    try:
        with urlopen(request, timeout=settings.caldav_timeout_seconds) as response:
            payload = response.read()
    except (HTTPError, URLError, TimeoutError) as exc:
        detail = getattr(exc, "reason", exc)
        raise CalDAVError(f"CalDAV request failed: {detail}") from exc
    if not payload:
        return None
    try:
        return ET.fromstring(payload)
    except ET.ParseError as exc:
        raise CalDAVError("CalDAV returned invalid XML") from exc


def _propfind(url: str, properties: str, depth: str = "0") -> ET.Element:
    body = f'<d:propfind xmlns:d="{DAV_NS}" xmlns:c="{CALDAV_NS}"><d:prop>{properties}</d:prop></d:propfind>'.encode()
    auth = base64.b64encode(f"{settings.caldav_username}:{settings.caldav_app_password}".encode()).decode()
    request = Request(url, data=body, method="PROPFIND", headers={
        "Authorization": f"Basic {auth}",
        "Content-Type": "application/xml; charset=utf-8",
        "Depth": depth,
        "User-Agent": "zCRM CalDAV integration",
    })
    try:
        with urlopen(request, timeout=settings.caldav_timeout_seconds) as response:
            return ET.fromstring(response.read())
    except (HTTPError, URLError, TimeoutError, ET.ParseError) as exc:
        detail = getattr(exc, "reason", exc)
        raise CalDAVError(f"CalDAV discovery failed: {detail}") from exc


def _first_href(root: ET.Element, property_name: str, namespace: str = DAV_NS) -> str:
    prefix = "c" if namespace == CALDAV_NS else "d"
    value = root.findtext(f".//{prefix}:{property_name}/d:href", namespaces=NS)
    if not value:
        raise CalDAVError(f"CalDAV did not return {property_name}")
    return value.strip()


def calendar_url() -> str:
    if settings.caldav_calendar_url:
        return settings.caldav_calendar_url.rstrip("/") + "/"
    principal_response = _propfind(settings.caldav_url, "<d:current-user-principal/>")
    principal_url = urljoin(settings.caldav_url, _href(principal_response))
    principal = _propfind(principal_url, "<c:calendar-home-set/>")
    home_url = urljoin(principal_url, _first_href(principal, "calendar-home-set", CALDAV_NS))
    calendars = _propfind(home_url, "<d:resourcetype/><d:displayname/>", depth="1")
    wanted = settings.caldav_calendar_name.casefold()
    for response in calendars.findall("d:response", NS):
        name = response.findtext("d:propstat/d:prop/d:displayname", namespaces=NS) or ""
        resource_type = response.find("d:propstat/d:prop/d:resourcetype", NS)
        if resource_type is not None and resource_type.find("c:calendar", NS) is not None and name.casefold() == wanted:
            href = response.findtext("d:href", namespaces=NS)
            if href:
                return urljoin(home_url, href).rstrip("/") + "/"
    raise CalDAVError(f'CalDAV calendar "{settings.caldav_calendar_name}" was not found')


def _ics_datetime(value: datetime) -> str:
    return value.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")


def _escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def _event_payload(reminder: Reminder, lead: Lead, uid: str) -> bytes:
    description = f"zCRM lead: {lead.company}"
    if lead.contact_name:
        description += f"\\nContact: {lead.contact_name}"
    travel_each_way = reminder.travel_minutes // 2
    start = reminder.due_at - timedelta(minutes=travel_each_way)
    end = reminder.due_at + timedelta(minutes=reminder.duration_minutes + reminder.travel_minutes - travel_each_way)
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//zCRM//CalDAV//EN", "BEGIN:VEVENT",
             f"UID:{uid}", f"DTSTAMP:{_ics_datetime(datetime.now(UTC))}",
             f"DTSTART:{_ics_datetime(start)}", f"DTEND:{_ics_datetime(end)}",
             f"SUMMARY:{_escape(reminder.title)}", f"DESCRIPTION:{_escape(description)}"]
    if reminder.location:
        lines.append(f"LOCATION:{_escape(reminder.location)}")
    lines.extend(["STATUS:CONFIRMED"])
    for minutes in reminder.alarm_minutes_before:
        if minutes > 0:
            lines.extend(["BEGIN:VALARM", f"TRIGGER:-PT{minutes}M", "ACTION:DISPLAY", f"DESCRIPTION:{_escape(reminder.title)}", "END:VALARM"])
    lines.extend(["END:VEVENT", "END:VCALENDAR"])
    return ("\r\n".join(lines) + "\r\n").encode()


def sync_reminder(reminder: Reminder, lead: Lead) -> tuple[str, str] | None:
    if not configured():
        return None
    uid = reminder.caldav_uid or f"zcrm-{reminder.id}@zcrm"
    event_url = reminder.caldav_url or urljoin(calendar_url(), f"{uid}.ics")
    _request(event_url, "PUT", _event_payload(reminder, lead, uid), "text/calendar; charset=utf-8")
    return uid, event_url


def delete_event(reminder: Reminder) -> None:
    if configured() and reminder.caldav_url:
        _request(reminder.caldav_url, "DELETE")
