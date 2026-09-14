"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  AtSign,
  Check,
  Image as ImageIcon,
  LockKeyhole,
  Save,
  UserRound,
} from "lucide-react";
import styles from "./profile.module.scss";

type User = {
  id: string;
  display_name: string;
  email: string;
  profile_pic?: string | null;
};

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [profilePic, setProfilePic] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data: User) => {
        setUser(data);
        setName(data.display_name);
        setProfilePic(data.profile_pic ?? "");
      })
      .catch(() => setError("Could not load your profile."));
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: name,
          profile_pic: profilePic || null,
        }),
      });
      if (!response.ok) throw new Error();

      const updatedUser = (await response.json()) as User;
      setUser(updatedUser);
      setName(updatedUser.display_name);
      setProfilePic(updatedUser.profile_pic ?? "");
      setMessage("Your changes have been saved.");
    } catch {
      setError("Could not save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <main className={styles.page}>
        <p className={styles.loading} role={error ? "alert" : "status"}>
          {error || "Loading profile…"}
        </p>
      </main>
    );
  }

  const initials = name.trim().slice(0, 2).toUpperCase() || "Z";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>
          <UserRound size={14} aria-hidden="true" /> Account
        </span>
        <h1>Your profile</h1>
        <p>Manage the details your teammates see across zCRM.</p>
      </header>

      <div className={styles.content}>
        <section className={styles.profileCard} aria-labelledby="profile-details">
          <div className={styles.identity}>
            <div className={styles.avatar} aria-hidden="true">
              {user.profile_pic ? <img src={user.profile_pic} alt="" /> : initials}
            </div>
            <div>
              <span className={styles.kicker}>Personal details</span>
              <h2 id="profile-details">Account identity</h2>
              <p>Keep your name and profile image up to date.</p>
            </div>
          </div>

          <form onSubmit={save} aria-busy={saving}>
            <label>
              Display name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                required
              />
            </label>
            <label>
              Email address
              <span className={styles.readonly}>
                <AtSign size={15} aria-hidden="true" />
                <span>{user.email}</span>
                <em>Verified</em>
              </span>
            </label>
            <label>
              Profile image URL <small>Optional</small>
              <span className={styles.inputIcon}>
                <ImageIcon size={15} aria-hidden="true" />
                <input
                  type="url"
                  value={profilePic}
                  onChange={(event) => setProfilePic(event.target.value)}
                  placeholder="https://example.com/photo.jpg"
                />
              </span>
            </label>
            {error && <p className={styles.error} role="alert">{error}</p>}
            {message && (
              <p className={styles.success} role="status">
                <Check size={15} aria-hidden="true" /> {message}
              </p>
            )}
            <div className={styles.formFooter}>
              <p>Changes are visible to teammates immediately.</p>
              <button className={styles.primary} disabled={saving}>
                <Save size={16} aria-hidden="true" />
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </section>

        <aside className={styles.security} aria-labelledby="security-heading">
          <span className={styles.securityIcon}>
            <LockKeyhole size={18} aria-hidden="true" />
          </span>
          <div>
            <span className={styles.kicker}>Security</span>
            <h2 id="security-heading">Password and sign-in</h2>
            <p>Use account recovery if you need to reset your password.</p>
            <a href="/reset-password">Reset password</a>
          </div>
        </aside>
      </div>
    </main>
  );
}
