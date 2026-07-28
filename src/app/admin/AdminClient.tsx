"use client";

import { useState, useEffect, useCallback } from "react";
import Nav from "@/components/Nav";

interface Member {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  photoUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AdminClient() {
  // Auth state
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Data state
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Member>>({});
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!password.trim()) {
      setAuthError("Enter the admin password.");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setAuthError("Wrong password.");
        setAuthLoading(false);
        return;
      }
      setAuthenticated(true);
    } catch {
      setAuthError("Could not connect. Try again.");
    }
    setAuthLoading(false);
  };

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch("/api/members");
      setMembers(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authenticated) fetchMembers();
  }, [authenticated, fetchMembers]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const startEdit = (m: Member) => {
    setEditingId(m.id);
    setEditForm({ name: m.name, email: m.email, phone: m.phone, role: m.role, isActive: m.isActive });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      const res = await fetch("/api/members", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...editForm }),
      });
      if (!res.ok) throw new Error();
      flash("Saved.");
      cancelEdit();
      fetchMembers();
    } catch {
      flash("Save failed.");
    }
  };

  const deleteMember = async (id: string) => {
    try {
      await fetch(`/api/members?id=${id}`, { method: "DELETE" });
      flash("Deleted.");
      setDeleteConfirm(null);
      fetchMembers();
    } catch {
      flash("Delete failed.");
    }
  };

  const exportCSV = async () => {
    try {
      const data = await fetch("/api/attendance?limit=10000").then((r) => r.json());
      const csv = [
        "Name,Role,Check In,Check Out,Duration (mins),Confidence",
        ...data.map(
          (r: any) =>
            `"${r.memberName}","${r.memberRole}","${r.checkIn}","${r.checkOut || ""}","${r.durationMinutes || ""}","${r.confidence || ""}"`
        ),
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `attendance-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      flash("Downloaded.");
    } catch {
      flash("Export failed.");
    }
  };

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email?.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase())
  );

  // ── Login gate ──
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <Nav />
        <div className="max-w-xs mx-auto px-5 py-20">
          <div className="bg-white rounded-lg border border-zinc-200 p-6">
            <div className="flex items-center gap-2 mb-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <h1 className="text-base font-bold text-zinc-900">Admin access</h1>
            </div>
            <p className="text-xs text-zinc-500 mb-5">
              Enter the admin password to manage members and attendance.
            </p>

            {authError && (
              <div className="mb-4 p-2.5 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
                {authError}
              </div>
            )}

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="Password"
              className="w-full px-3 py-2 rounded-md border border-zinc-300 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 mb-3"
              autoFocus
            />

            <button
              onClick={handleLogin}
              disabled={authLoading}
              className="w-full py-2 text-sm font-medium bg-zinc-900 text-white rounded-md hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              {authLoading ? "Checking…" : "Sign in"}
            </button>

            <p className="text-[10px] text-zinc-400 mt-4 text-center leading-relaxed">
              Default password: <code className="bg-zinc-100 px-1 py-0.5 rounded text-zinc-600">buildclub2025</code>
              <br />
              Change it by setting <code className="bg-zinc-100 px-1 py-0.5 rounded text-zinc-600">ADMIN_PASSWORD</code> env variable.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main admin panel ──
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <Nav />
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-sm text-zinc-400">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <Nav />

      {/* Toast */}
      {toast && (
        <div className="fixed top-16 right-4 z-50 px-4 py-2 rounded-md bg-zinc-900 text-white text-sm font-medium shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      {/* Delete modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-5 max-w-xs w-full shadow-xl animate-fade-in">
            <h3 className="text-sm font-bold text-zinc-900 mb-1">Delete this member?</h3>
            <p className="text-xs text-zinc-500 mb-5 leading-relaxed">
              Their attendance records will also be removed. This can&apos;t be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 text-xs font-medium rounded-md border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMember(deleteConfirm)}
                className="flex-1 py-2 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-5 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Admin</h1>
              <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                Authenticated
              </span>
            </div>
            <p className="text-sm text-zinc-500 mt-0.5">
              {members.length} member{members.length !== 1 ? "s" : ""} ·{" "}
              {members.filter((m) => m.isActive).length} active
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-1.5 rounded-md border border-zinc-300 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 w-48"
            />
            <button
              onClick={exportCSV}
              className="text-xs font-medium text-zinc-500 px-3 py-1.5 rounded-md border border-zinc-300 hover:bg-white transition-colors shrink-0"
            >
              Export CSV
            </button>
            <button
              onClick={() => { setAuthenticated(false); setPassword(""); }}
              className="text-xs font-medium text-zinc-400 px-3 py-1.5 rounded-md border border-zinc-200 hover:bg-zinc-100 transition-colors shrink-0"
            >
              Lock
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="bg-white rounded-lg border border-zinc-200 p-4 mb-6 flex gap-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400 shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Click <strong className="text-zinc-700">Edit</strong> to change a member&apos;s name, contact info, or role.
            Toggle <strong className="text-zinc-700">Active</strong> off to block check-ins without deleting history.
            Only admins with the password can access this page.
          </p>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left">
                <th className="px-4 py-2.5 font-medium text-zinc-400 text-xs">Name</th>
                <th className="px-4 py-2.5 font-medium text-zinc-400 text-xs">Email</th>
                <th className="px-4 py-2.5 font-medium text-zinc-400 text-xs">Phone</th>
                <th className="px-4 py-2.5 font-medium text-zinc-400 text-xs">Role</th>
                <th className="px-4 py-2.5 font-medium text-zinc-400 text-xs">Status</th>
                <th className="px-4 py-2.5 font-medium text-zinc-400 text-xs">Joined</th>
                <th className="px-4 py-2.5 font-medium text-zinc-400 text-xs text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filtered.map((m) => (
                <tr
                  key={m.id}
                  className={`hover:bg-zinc-50/50 ${!m.isActive ? "opacity-40" : ""}`}
                >
                  {editingId === m.id ? (
                    <>
                      <td className="px-4 py-2">
                        <input
                          value={editForm.name || ""}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="px-2 py-1 rounded border border-zinc-300 text-sm w-32 focus:outline-none focus:border-zinc-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={editForm.email || ""}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          className="px-2 py-1 rounded border border-zinc-300 text-sm w-40 focus:outline-none focus:border-zinc-500"
                          placeholder="—"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={editForm.phone || ""}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          className="px-2 py-1 rounded border border-zinc-300 text-sm w-32 focus:outline-none focus:border-zinc-500"
                          placeholder="—"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={editForm.role || "member"}
                          onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                          className="px-2 py-1 rounded border border-zinc-300 text-sm focus:outline-none focus:border-zinc-500 bg-white"
                        >
                          <option value="guest">guest</option>
                          <option value="member">member</option>
                          <option value="admin">admin</option>
                          <option value="mentor">mentor</option>
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editForm.isActive ?? true}
                            onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                            className="w-3.5 h-3.5 rounded border-zinc-300"
                          />
                          <span className="text-xs text-zinc-500">Active</span>
                        </label>
                      </td>
                      <td className="px-4 py-2 text-xs text-zinc-400">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={saveEdit}
                            className="px-2.5 py-1 text-xs font-medium rounded bg-zinc-900 text-white hover:bg-zinc-800"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-2.5 py-1 text-xs font-medium rounded border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2.5 font-medium text-zinc-900">{m.name}</td>
                      <td className="px-4 py-2.5 text-zinc-500">{m.email || <span className="text-zinc-300">—</span>}</td>
                      <td className="px-4 py-2.5 text-zinc-500">{m.phone || <span className="text-zinc-300">—</span>}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-medium capitalize ${m.role === "admin" ? "text-indigo-600" : m.role === "mentor" ? "text-amber-600" : "text-zinc-500"}`}>
                          {m.role}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 text-xs ${m.isActive ? "text-emerald-600" : "text-zinc-400"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${m.isActive ? "bg-emerald-400" : "bg-zinc-300"}`} />
                          {m.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-zinc-400">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => startEdit(m)}
                            className="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-900 rounded hover:bg-zinc-100 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(m.id)}
                            className="px-2 py-1 text-xs text-zinc-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-sm text-zinc-400 py-10 text-center">
              {search ? "No results." : "No members yet."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
