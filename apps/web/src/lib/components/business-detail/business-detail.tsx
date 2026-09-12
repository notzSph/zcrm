"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Check,
  Globe2,
  Mail,
  Pencil,
  Trash2,
  UsersRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import styles from "./business-detail.module.scss";

type Business = {
  id: string;
  name: string;
  owner_id: string | null;
  logo_url: string | null;
  website: string | null;
  industry: string | null;
  description: string | null;
  created_at: string;
};
type Member = {
  id: string;
  email: string;
  display_name: string;
  is_admin: boolean;
};

export default function BusinessDetail({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    const [businessRes, membersRes, meRes] = await Promise.all([
      fetch(`/api/businesses/${businessId}`, { cache: "no-store" }),
      fetch(`/api/businesses/${businessId}/members`, { cache: "no-store" }),
      fetch("/api/auth/me", { cache: "no-store" }),
    ]);
    if (!businessRes.ok) {
      setError("Business not found or unavailable.");
      return;
    }
    setBusiness(await businessRes.json());
    if (membersRes.ok) setMembers(await membersRes.json());
    if (meRes.ok) setCurrentUserId((await meRes.json()).id);
  };
  useEffect(() => {
    load();
  }, [businessId]);
  const openWorkspace = async () => {
    const response = await fetch("/api/auth/active-business", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ business_id: businessId }),
    });
    if (!response.ok) {
      setError("Could not open this workspace.");
      return;
    }
    router.replace("/");
    router.refresh();
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/businesses/${businessId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        logo_url: business?.logo_url,
        website: business?.website,
        industry: business?.industry,
        description: business?.description,
      }),
    });
    if (!response.ok) {
      setError("Could not rename the business.");
      return;
    }
    setEditing(false);
    await load();
  };
  const addMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/businesses/${businessId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email") }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(
        data.detail || "Could not add member. They must register first.",
      );
      return;
    }
    event.currentTarget.reset();
    await load();
  };
  const changeRole = async (memberId: string, isAdmin: boolean) => {
    const response = await fetch(
      `/api/businesses/${businessId}/members/${memberId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_admin: isAdmin }),
      },
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.detail || "Could not change role.");
      return;
    }
    await load();
  };
  const transferOwnership = async (userId: string) => {
    const response = await fetch(`/api/businesses/${businessId}/owner`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.detail || "Could not transfer ownership.");
      return;
    }
    await load();
  };
  const remove = async () => {
    if (
      !business ||
      !window.confirm(
        `Delete “${business.name}” and all leads inside it? This cannot be undone.`,
      )
    )
      return;
    const response = await fetch(`/api/businesses/${businessId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setError("Could not delete the business.");
      return;
    }
    router.replace("/businesses");
    router.refresh();
  };
  if (!business)
    return (
      <main className={styles.page}>
        <p className={styles.loading}>{error || "Loading business…"}</p>
      </main>
    );
  const isAdmin = members.some(
    (member) => member.id === currentUserId && member.is_admin,
  );
  return (
    <main className={styles.page}>
      <Link className={styles.back} href="/businesses">
        <ArrowLeft size={15} /> All businesses
      </Link>
      <header>
        <div className={styles.icon}>
          {business.logo_url ? (
            <img src={business.logo_url} alt="" />
          ) : (
            <Building2 size={24} />
          )}
        </div>
        <div>
          {editing ? (
            <form className={styles.rename} onSubmit={save}>
              <input
                name="name"
                defaultValue={business.name}
                required
                autoFocus
              />
              <button>
                <Check size={15} /> Save
              </button>
            </form>
          ) : (
            <>
              <span>Business workspace</span>
              <h1>{business.name}</h1>
            </>
          )}
          <p>
            {business.description ||
              "Shared pipeline, follow-ups, and history for every member."}
          </p>
        </div>
        <div className={styles.headerActions}>
          {isAdmin && (
            <button
              className={styles.secondary}
              onClick={() => setEditing(!editing)}
            >
              <Pencil size={15} /> Rename
            </button>
          )}
          <button className={styles.primary} onClick={openWorkspace}>
            Open CRM
          </button>
        </div>
      </header>
      {error && <p className={styles.error}>{error}</p>}
      <section className={styles.about}>
        <div>
          <span>Industry</span>
          <strong>{business.industry || "Not set"}</strong>
        </div>
        <div>
          <span>Website</span>
          {business.website ? (
            <a href={business.website} target="_blank" rel="noreferrer">
              {business.website.replace(/^https?:\/\//, "")}
              <Globe2 size={13} />
            </a>
          ) : (
            <strong>Not set</strong>
          )}
        </div>
        <div>
          <span>Workspace ID</span>
          <strong>{business.id.slice(0, 8)}…</strong>
        </div>
      </section>
      <section className={styles.members}>
        <div className={styles.sectionHead}>
          <div>
            <span>
              <UsersRound size={15} /> Members
            </span>
            <h2>
              {members.length} user{members.length === 1 ? "" : "s"}
            </h2>
          </div>
        </div>
        <div className={styles.memberList}>
          {members.map((member) => (
            <div key={member.id}>
              <span>{member.display_name.slice(0, 1).toUpperCase()}</span>
              <strong>{member.display_name}</strong>
              <small>
                <Mail size={12} /> {member.email}
              </small>
              {isAdmin && (
                <select
                  value={member.is_admin ? "admin" : "member"}
                  onChange={(event) =>
                    changeRole(member.id, event.target.value === "admin")
                  }
                  aria-label={`Role for ${member.display_name}`}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              )}
            </div>
          ))}
        </div>
        {isAdmin && (
          <form className={styles.addMember} onSubmit={addMember}>
            <input
              name="email"
              type="email"
              placeholder="registered.user@company.com"
              required
            />
            <button>Add member</button>
          </form>
        )}
        {isAdmin && members.length > 1 && (
          <label>
            Business owner
            <select
              value={business.owner_id ?? ""}
              onChange={(event) => transferOwnership(event.target.value)}
            >
              <option value="" disabled>
                Select owner
              </option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.display_name}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className={styles.hint}>
          Admins manage business settings and member roles. Members manage CRM
          data.
        </p>
      </section>
      {isAdmin && (
        <button className={styles.delete} onClick={remove}>
          <Trash2 size={15} /> Delete business and all data
        </button>
      )}
    </main>
  );
}
