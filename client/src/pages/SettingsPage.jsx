import { useState } from "react";
import AppShell from "../components/AppShell.jsx";
import { userAPI } from "../api/client.js";
import { useAppStore } from "../store/useAppStore.js";
import { usePageTitle } from "../hooks/usePageTitle.js";

export default function SettingsPage() {
  usePageTitle("Settings");
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);

  const [fullName, setFullName] = useState(user?.full_name || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg("");
    try {
      const res = await userAPI.updateProfile({ full_name: fullName });
      setUser(res.data);
      setProfileMsg("Saved.");
    } catch (err) {
      setProfileMsg(err.response?.data?.detail || "Couldn't save.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordError("");
    setPasswordMsg("");
    try {
      await userAPI.changePassword({ current_password: currentPassword, new_password: newPassword });
      setPasswordMsg("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPasswordError(err.response?.data?.detail || "Couldn't update password.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-lg mx-auto px-4 sm:px-8 py-10 space-y-8">
        <h1 className="font-display text-2xl font-bold text-ink-900">Settings</h1>

        <form onSubmit={handleProfileSave} className="bg-white border border-primary-100 rounded-3xl p-6 space-y-4">
          <h2 className="font-display font-semibold text-ink-900">Profile</h2>
          {profileMsg && <p className="text-sm text-primary-600">{profileMsg}</p>}
          <div>
            <label className="block text-sm font-medium text-ink-600 mb-1">Email</label>
            <input value={user?.email || ""} disabled className="w-full px-4 py-3 rounded-2xl border border-primary-100 bg-primary-50/50 text-ink-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-600 mb-1">Full name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <button
            type="submit"
            disabled={savingProfile}
            className="px-6 py-2.5 rounded-2xl bg-primary-500 hover:bg-primary-600 text-white font-semibold transition disabled:opacity-50"
          >
            {savingProfile ? "Saving…" : "Save"}
          </button>
        </form>

        <form onSubmit={handlePasswordChange} className="bg-white border border-primary-100 rounded-3xl p-6 space-y-4">
          <h2 className="font-display font-semibold text-ink-900">Change password</h2>
          {passwordError && <div className="px-4 py-3 rounded-2xl bg-red-50 text-red-700 text-sm">{passwordError}</div>}
          {passwordMsg && <p className="text-sm text-primary-600">{passwordMsg}</p>}
          <div>
            <label className="block text-sm font-medium text-ink-600 mb-1">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-600 mb-1">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              className="w-full px-4 py-3 rounded-2xl border border-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <button
            type="submit"
            disabled={savingPassword}
            className="px-6 py-2.5 rounded-2xl bg-primary-500 hover:bg-primary-600 text-white font-semibold transition disabled:opacity-50"
          >
            {savingPassword ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
