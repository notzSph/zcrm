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
    window.location.hash = "workspace-form";
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

  const cancelEdit = () => {
    setEditing(null);
    setForm(emptyForm);
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>
            <Building2 size={15} aria-hidden="true" /> Workspace directory
          </span>
          <h1>Your businesses</h1>
          <p>Set up distinct CRM spaces for every company you work with.</p>
        </div>
        <div className={styles.headerMeta}>
          <div className={styles.count} aria-label={`${businesses.length} workspaces`}>
            <strong>{businesses.length}</strong>
            <span>{businesses.length === 1 ? "workspace" : "workspaces"}</span>
          </div>
          <a className={styles.createLink} href="#workspace-form">
            <Plus size={15} aria-hidden="true" /> New business
          </a>
        </div>
      </header>

      {error && <p className={styles.error} role="alert">{error}</p>}

      <div className={styles.layout}>
        <section className={styles.listCard} aria-busy={loading} aria-labelledby="workspace-list-title">
          <div className={styles.cardHead}>
            <div>
              <span className={styles.kicker}>Your workspaces</span>
              <h2 id="workspace-list-title">Choose where to work</h2>
            </div>
            {!loading && businesses.length > 0 && (
              <span className={styles.listCount}>{businesses.length} total</span>
            )}
          </div>

          <div className={styles.list}>
            {businesses.map((business) => (
              <article className={styles.business} key={business.id}>
                <button className={styles.open} onClick={() => manage(business.id)}>
                  {business.logo_url ? (
                    <img src={business.logo_url} alt="" />
                  ) : (
                    <span className={styles.logo} aria-hidden="true">
                      <Building2 size={18} />
                    </span>
                  )}
                  <span className={styles.businessDetails}>
                    <strong>{business.name}</strong>
                    <small>{business.industry || "Business workspace"}</small>
                    {business.description && <em>{business.description}</em>}
                  </span>
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
                <div className={styles.actions} aria-label={`${business.name} actions`}>
                  <button aria-label={`Edit ${business.name}`} onClick={() => startEdit(business)}>
                    <Pencil size={15} aria-hidden="true" />
                  </button>
                  <button aria-label={`Delete ${business.name}`} onClick={() => remove(business)}>
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>

          {loading && <p className={styles.empty}>Loading workspaces…</p>}
          {!loading && !businesses.length && (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}><Building2 size={20} aria-hidden="true" /></span>
              <strong>Create your first workspace</strong>
              <p>Businesses keep their leads, settings, and team context separate.</p>
              <a href="#workspace-form"><Plus size={15} aria-hidden="true" /> Add a business</a>
            </div>
          )}
        </section>

        <section className={styles.formCard} id="workspace-form" aria-labelledby="workspace-form-title">
          <div className={styles.formTitle}>
            <span className={styles.eyebrow}>
              {editing ? <Pencil size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
              {editing ? "Workspace settings" : "New workspace"}
            </span>
            <h2 id="workspace-form-title">{editing ? "Edit business details" : "Create a business"}</h2>
            <p>{editing ? "Update the information your team uses to identify this workspace." : "Start with the essentials. You can refine these details at any time."}</p>
          </div>

          <form onSubmit={save} aria-busy={saving}>
            <label>
              Business name
              <input value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Acme Inc." autoComplete="organization" required />
            </label>
            <label>
              Industry <small>Optional</small>
              <input value={form.industry} onChange={(event) => update("industry", event.target.value)} placeholder="Sports, design, technology…" />
            </label>
            <div className={styles.fieldGrid}>
              <label>
                Website <small>Optional</small>
                <span className={styles.inputIcon}>
                  <Globe2 size={15} aria-hidden="true" />
                  <input type="url" value={form.website} onChange={(event) => update("website", event.target.value)} placeholder="company.com" />
                </span>
              </label>
              <label>
                Logo URL <small>Optional</small>
                <span className={styles.inputIcon}>
                  <ImageIcon size={15} aria-hidden="true" />
                  <input type="url" value={form.logo_url} onChange={(event) => update("logo_url", event.target.value)} placeholder="logo.png" />
                </span>
              </label>
            </div>
            <label>
              About the business <small>Optional</small>
              <textarea value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="What does this workspace focus on?" rows={4} />
            </label>
            <div className={styles.formActions}>
              {editing && <button type="button" className={styles.cancel} onClick={cancelEdit}><X size={15} aria-hidden="true" /> Cancel</button>}
              <button className={styles.primary} disabled={saving}>
                {saving ? "Saving…" : <><Check size={15} aria-hidden="true" /> {editing ? "Save changes" : "Create workspace"}</>}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
