"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  Globe2,
  Image as ImageIcon,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Business } from "@/lib/types";
import styles from "./businesses-page.module.scss";

const emptyForm = {
  name: "",
  logo_url: "",
  website: "",
  industry: "",
  description: "",
};

export default function BusinessesPage() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Business | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    try {
      const response = await fetch("/api/businesses", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setBusinesses(await response.json());
      setError("");
    } catch {
      setError("Could not load your businesses.");
    }
  };
  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);
  const update = (key: keyof typeof emptyForm, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const manage = (id: string) => router.push(`/businesses/${id}`);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const url = editing ? `/api/businesses/${editing.id}` : "/api/businesses";
      const response = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          logo_url: form.logo_url || null,
          website: form.website || null,
          industry: form.industry || null,
          description: form.description || null,
        }),
      });
      if (!response.ok) throw new Error();
      const business = (await response.json()) as Business;
      const wasEditing = Boolean(editing);
      setForm(emptyForm);
      setEditing(null);
      await load();
      if (!wasEditing) manage(business.id);
    } catch {
      setError(
        editing
          ? "Could not update the business."
          : "Could not create the business.",
      );
    } finally {
      setSaving(false);
    }
  };
  const startEdit = (business: Business) => {
    setEditing(business);
    setForm({
      name: business.name,
      logo_url: business.logo_url || "",
      website: business.website || "",
      industry: business.industry || "",
      description: business.description || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const remove = async (business: Business) => {
    if (
      !window.confirm(
        `Delete “${business.name}” and all its CRM data? This cannot be undone.`,
      )
    )
      return;
    const response = await fetch(`/api/businesses/${business.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setError("Could not delete the business.");
      return;
    }
    await load();
  };
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>
            <Building2 size={15}  aria-hidden="true" /> Workspace directory
          </span>
          <h1>Your businesses</h1>
          <p>
            Each business has its own pipeline, team, and operating context.
          </p>
        </div>
        <div className={styles.count}>
          <strong>{businesses.length}</strong>
          <span>workspaces</span>
        </div>
      </header>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.layout}>
        <section className={styles.listCard} aria-busy={loading}>
          <div className={styles.cardHead}>
            <div>
              <span className={styles.kicker}>Connected workspaces</span>
              <h2>Pick a workspace</h2>
            </div>
          </div>
          <div className={styles.list}>
            {businesses.map((business) => (
              <article className={styles.business} key={business.id}>
                <button
                  className={styles.open}
                  onClick={() => manage(business.id)}
                >
                  {business.logo_url ? (
                    <img src={business.logo_url} alt="" />
                  ) : (
                    <span className={styles.logo}>
                      <Building2 size={17}  aria-hidden="true" />
                    </span>
                  )}
                  <div>
                    <strong>{business.name}</strong>
                    <small>{business.industry || "Business workspace"}</small>
                    {business.description && <p>{business.description}</p>}
                  </div>
                  <ArrowRight size={17}  aria-hidden="true" />
                </button>
                <div className={styles.actions}>
                  <button
                    aria-label={`Edit ${business.name}`}
                    onClick={() => startEdit(business)}
                  >
                    <Pencil size={14}  aria-hidden="true" />
                  </button>
                  <button
                    aria-label={`Delete ${business.name}`}
                    onClick={() => remove(business)}
                  >
                    <Trash2 size={14}  aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>
          {loading && <p className={styles.empty}>Loading workspaces…</p>}
          {!loading && !businesses.length && (
            <p className={styles.empty}>
              No businesses yet. Create your first workspace.
            </p>
          )}
        </section>
        <section className={styles.formCard}>
          <div className={styles.formTitle}>
            <span className={styles.eyebrow}>
              {editing ? <Pencil size={14}  aria-hidden="true" /> : <Plus size={14}  aria-hidden="true" />}{" "}
              {editing ? "Workspace settings" : "New workspace"}
            </span>
            <h2>{editing ? "Edit business details" : "Create a business"}</h2>
            <p>
              {editing
                ? "Keep the profile current for your team and leads."
                : "Set up the context your CRM will use across the workspace."}
            </p>
          </div>
          <form onSubmit={save} aria-busy={saving}>
            <label>
              Business name
              <input
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Acme Inc."
                required
              />
            </label>
            <label>
              Industry
              <input
                value={form.industry}
                onChange={(e) => update("industry", e.target.value)}
                placeholder="Sports, design, technology…"
              />
            </label>
            <label>
              Website
              <div className={styles.inputIcon}>
                <Globe2 size={14}  aria-hidden="true" />
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => update("website", e.target.value)}
                  placeholder="https://company.com"
                />
              </div>
            </label>
            <label>
              Logo URL
              <div className={styles.inputIcon}>
                <ImageIcon size={14}  aria-hidden="true" />
                <input
                  type="url"
                  value={form.logo_url}
                  onChange={(e) => update("logo_url", e.target.value)}
                  placeholder="https://…/logo.png"
                />
              </div>
            </label>
            <label>
              About the business
              <textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="What does this workspace focus on?"
                rows={4}
              />
            </label>
            <div className={styles.formActions}>
              {editing && (
                <button
                  type="button"
                  className={styles.cancel}
                  onClick={() => {
                    setEditing(null);
                    setForm(emptyForm);
                  }}
                >
                  <X size={14}  aria-hidden="true" /> Cancel
                </button>
              )}
              <button className={styles.primary} disabled={saving}>
                {saving ? (
                  "Saving…"
                ) : (
                  <>
                    <Check size={14}  aria-hidden="true" />{" "}
                    {editing ? "Save details" : "Create workspace"}
                  </>
                )}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
