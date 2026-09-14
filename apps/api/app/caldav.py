"""Small iCloud CalDAV client used to mirror zCRM reminders."""

from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

from app.core.config import settings
from app.domain_models import Lead, Reminder, User

DAV_NS = "DAV:"
CALDAV_NS = "urn:ietf:params:xml:ns:caldav"
APPLE_CALDAV_NS = "http://calendarserver.org/ns/"
NS = {"d": DAV_NS, "c": CALDAV_NS, "a": APPLE_CALDAV_NS}


class CalDAVError(RuntimeError):
    """A user-safe error raised when the configured calendar cannot be reached."""


@dataclass(frozen=True)
class CalDAVConfig:
    username: str
    app_password: str
    calendar_name: str
    calendar_url: str


def config_for_user(user: User | None = None) -> CalDAVConfig:
    config = CalDAVConfig(settings.caldav_username, settings.caldav_app_password, settings.caldav_calendar_name, settings.caldav_calendar_url)
    if not user or not settings.caldav_profiles_json:
        return config
    try:
        profiles = json.loads(settings.caldav_profiles_json)
    except json.JSONDecodeError as exc:
        raise CalDAVError("CALDAV_PROFILES_JSON is invalid") from exc
    if not isinstance(profiles, dict):
        raise CalDAVError("CALDAV_PROFILES_JSON must be an object keyed by user email")
    profile = profiles.get(user.email.casefold())
    if not profile:
        return config
    if not isinstance(profile, dict):
        raise CalDAVError(f"CalDAV profile for {user.email} is invalid")
    return CalDAVConfig(profile.get("username", ""), profile.get("app_password", ""), profile.get("calendar_name", config.calendar_name), profile.get("calendar_url", ""))


def configured(user: User | None = None) -> bool:
    config = config_for_user(user)
    return settings.caldav_enabled and bool(config.username and config.app_password)


def _href(response: ET.Element) -> str:
    value = response.findtext(".//d:current-user-principal/d:href", namespaces=NS)
    if not value:
        value = response.findtext(".//d:principal-URL/d:href", namespaces=NS)
    if not value:
        raise CalDAVError("CalDAV account did not return a principal URL")
    return value.strip()


def _request(url: str, method: str, config: CalDAVConfig, body: bytes | None = None, content_type: str = "application/xml; charset=utf-8") -> ET.Element | None:
    auth = base64.b64encode(f"{config.username}:{config.app_password}".encode()).decode()
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


def _propfind(url: str, properties: str, config: CalDAVConfig, depth: str = "0") -> ET.Element:
    body = f'<d:propfind xmlns:d="{DAV_NS}" xmlns:c="{CALDAV_NS}"><d:prop>{properties}</d:prop></d:propfind>'.encode()
    auth = base64.b64encode(f"{config.username}:{config.app_password}".encode()).decode()
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


def calendar_url(user: User | None = None) -> str:
    config = config_for_user(user)
    if config.calendar_url:
        return config.calendar_url.rstrip("/") + "/"
    principal_response = _propfind(settings.caldav_url, "<d:current-user-principal/>", config)
    principal_url = urljoin(settings.caldav_url, _href(principal_response))
    principal = _propfind(principal_url, "<c:calendar-home-set/>", config)
    home_url = urljoin(principal_url, _first_href(principal, "calendar-home-set", CALDAV_NS))
    calendars = _propfind(home_url, "<d:resourcetype/><d:displayname/>", config, depth="1")
    wanted = config.calendar_name.casefold()
    for response in calendars.findall("d:response", NS):
        name = response.findtext("d:propstat/d:prop/d:displayname", namespaces=NS) or ""
        resource_type = response.find("d:propstat/d:prop/d:resourcetype", NS)
        if resource_type is not None and resource_type.find("c:calendar", NS) is not None and name.casefold() == wanted:
            href = response.findtext("d:href", namespaces=NS)
            if href:
                return urljoin(home_url, href).rstrip("/") + "/"
    raise CalDAVError(f'CalDAV calendar "{config.calendar_name}" was not found')


def _ics_datetime(value: datetime) -> str:
    return value.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")


def _escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def _event_payload(reminder: Reminder, lead: Lead, uid: str) -> bytes:
    description = f"zCRM lead: {lead.company}"
    if lead.contact_name:
        description += f"\\nContact: {lead.contact_name}"
    start = reminder.due_at
    end = reminder.due_at + timedelta(minutes=reminder.duration_minutes)
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//zCRM//CalDAV//EN", "BEGIN:VEVENT",
             f"UID:{uid}", f"DTSTAMP:{_ics_datetime(datetime.now(UTC))}",
             f"DTSTART:{_ics_datetime(start)}", f"DTEND:{_ics_datetime(end)}",
             "SEQUENCE:1", f"SUMMARY:{_escape(reminder.title)}", f"DESCRIPTION:{_escape(description)}"]
    if reminder.location:
        lines.append(f"LOCATION:{_escape(reminder.location)}")
    if reminder.travel_minutes:
        lines.append(f"X-APPLE-TRAVEL-DURATION;VALUE=DURATION:PT{reminder.travel_minutes}M")
    lines.extend(["STATUS:CONFIRMED"])
    for minutes in reminder.alarm_minutes_before:
        if minutes > 0:
            lines.extend(["BEGIN:VALARM", f"TRIGGER:-PT{minutes}M", "ACTION:DISPLAY", f"DESCRIPTION:{_escape(reminder.title)}", "END:VALARM"])
    lines.extend(["END:VEVENT", "END:VCALENDAR"])
    return ("\r\n".join(lines) + "\r\n").encode()


def sync_reminder(reminder: Reminder, lead: Lead, user: User | None = None) -> tuple[str, str] | None:
    if not configured(user):
        return None
    config = config_for_user(user)
    uid = reminder.caldav_uid or f"zcrm-{reminder.id}@zcrm"
    event_url = reminder.caldav_url or urljoin(calendar_url(user), f"{uid}.ics")
    _request(event_url, "PUT", config, _event_payload(reminder, lead, uid), "text/calendar; charset=utf-8")
    return uid, event_url


def delete_event(reminder: Reminder, user: User | None = None) -> None:
    if configured(user) and reminder.caldav_url:
        _request(reminder.caldav_url, "DELETE", config_for_user(user))
