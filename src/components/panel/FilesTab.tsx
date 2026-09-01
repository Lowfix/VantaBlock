import { useCallback, useEffect, useRef, useState } from "react";
import { Folder, File, Upload, Pencil, Trash2, MoreVertical, ChevronRight, Home, FolderPlus, Loader2 } from "lucide-react";
import { Menu, MenuItem, MenuSeparator } from "../ui/Menu";
import { Modal } from "../ui/Modal";
import { Input, Textarea } from "../ui/Input";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";
import { cn } from "../../lib/cn";
import { demoFetch } from "../../demo/api";

interface FileEntry {
  name: string;
  is_file: boolean;
  size: number;
  modified_at: string;
  mimetype: string;
}

const MAX_EDITABLE_SIZE = 2 * 1024 * 1024;

const EDITABLE_APPLICATION_MIMES = new Set([
  "application/json",
  "application/xml",
  "application/x-yaml",
  "application/yaml",
  "application/javascript",
  "application/x-sh",
  "application/toml",
  "application/x-toml",
  "application/x-httpd-php",
]);

function isEditableFile(entry: FileEntry): boolean {
  if (entry.size === 0) return true;
  return entry.mimetype.startsWith("text/") || EDITABLE_APPLICATION_MIMES.has(entry.mimetype);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function joinPath(root: string, name: string): string {
  return root === "/" ? `/${name}` : `${root}/${name}`;
}

export function FilesTab({ identifier }: { identifier: string }) {
  const [path, setPath] = useState("/");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [renaming, setRenaming] = useState<FileEntry | null>(null);
  const [newName, setNewName] = useState("");
  const [deleting, setDeleting] = useState<FileEntry | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [editing, setEditing] = useState<FileEntry | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { push } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await demoFetch(`/api/servers/${identifier}/files?directory=${encodeURIComponent(path)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { files: FileEntry[] };
      setEntries(data.files);
    } catch {
      push("Could not load files.", "warn");
    } finally {
      setLoading(false);
    }
  }, [identifier, path, push]);

  useEffect(() => {
    load();
  }, [load]);

  const crumbs = path === "/" ? [] : path.split("/").filter(Boolean);

  function goToCrumb(index: number) {
    setPath(index === 0 ? "/" : `/${crumbs.slice(0, index).join("/")}`);
  }

  function openFolder(entry: FileEntry) {
    if (entry.is_file) return;
    setPath(joinPath(path, entry.name));
  }

  async function openEditor(entry: FileEntry) {
    if (!isEditableFile(entry)) {
      push(`"${entry.name}" is a compiled/binary file and can't be edited here.`, "warn");
      return;
    }
    if (entry.size > MAX_EDITABLE_SIZE) {
      push(`"${entry.name}" is too large to edit here (${formatSize(entry.size)}).`, "warn");
      return;
    }
    setEditing(entry);
    setEditLoading(true);
    setEditContent("");
    try {
      const res = await demoFetch(`/api/servers/${identifier}/files/contents?file=${encodeURIComponent(joinPath(path, entry.name))}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { content: string };
      setEditContent(data.content);
    } catch {
      push(`Failed to load "${entry.name}".`, "warn");
      setEditing(null);
    } finally {
      setEditLoading(false);
    }
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setEditSaving(true);
    try {
      const res = await demoFetch(`/api/servers/${identifier}/files/contents`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: joinPath(path, editing.name), content: editContent }),
      });
      if (!res.ok) throw new Error();
      push(`Saved "${editing.name}"`, "success");
      setEditing(null);
      load();
    } catch {
      push(`Failed to save "${editing.name}".`, "warn");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleRename() {
    if (!renaming || !newName.trim()) return;
    try {
      const res = await demoFetch(`/api/servers/${identifier}/files/rename`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ root: path, from: renaming.name, to: newName.trim() }),
      });
      if (!res.ok) throw new Error();
      push(`Renamed to "${newName.trim()}"`, "success");
      setRenaming(null);
      setNewName("");
      load();
    } catch {
      push("Failed to rename.", "warn");
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      const res = await demoFetch(`/api/servers/${identifier}/files/delete`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ root: path, files: [deleting.name] }),
      });
      if (!res.ok) throw new Error();
      push(`Deleted "${deleting.name}"`, "warn");
      setDeleting(null);
      load();
    } catch {
      push("Failed to delete.", "warn");
    }
  }

  async function handleCreateFolder() {
    if (!folderName.trim()) return;
    try {
      const res = await demoFetch(`/api/servers/${identifier}/files/folder`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ root: path, name: folderName.trim() }),
      });
      if (!res.ok) throw new Error();
      push(`Created folder "${folderName.trim()}"`, "success");
      setCreatingFolder(false);
      setFolderName("");
      load();
    } catch {
      push("Failed to create folder.", "warn");
    }
  }

  async function handleUploadFile(file: globalThis.File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("directory", path);
      const res = await demoFetch(`/api/servers/${identifier}/files/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
        signal: AbortSignal.timeout(130_000),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error);
      }
      push(`Uploaded ${file.name}`, "success");
      setUploadOpen(false);
      load();
    } catch (err) {
      push(err instanceof Error && err.message ? err.message : `Failed to upload ${file.name}.`, "warn");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-panel/60">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
        <div className="flex items-center gap-1.5 text-[13px] text-text-lo">
          <button onClick={() => setPath("/")} className="flex items-center gap-1 hover:text-text-hi">
            <Home size={13} /> root
          </button>
          {crumbs.map((name, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <ChevronRight size={13} />
              <button onClick={() => goToCrumb(i + 1)} className="hover:text-text-hi">
                {name}
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setCreatingFolder(true)}>
            <FolderPlus size={14} /> New folder
          </Button>
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Upload size={14} /> Upload file
          </Button>
        </div>
      </div>

      <div className="divide-y divide-line-soft">
        {loading && (
          <div className="flex items-center justify-center gap-2 px-4 py-8 text-[13px] text-text-lo">
            <Loader2 size={15} className="animate-spin" /> Loading...
          </div>
        )}
        {!loading && entries.length === 0 && (
          <p className="px-4 py-8 text-center text-[13px] text-text-lo">This folder is empty.</p>
        )}
        {!loading &&
          entries.map((entry) => (
            <div
              key={entry.name}
              className="group flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-panel-2/60"
            >
              <button
                onClick={() => (entry.is_file ? openEditor(entry) : openFolder(entry))}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-3 text-left",
                  entry.is_file && !isEditableFile(entry) && "cursor-default"
                )}
              >
                {!entry.is_file ? (
                  <Folder size={16} className="shrink-0 text-accent-400" />
                ) : (
                  <File size={16} className="shrink-0 text-text-lo" />
                )}
                <span className="truncate text-[13.5px] text-text-hi">{entry.name}</span>
              </button>
              <span className="hidden w-20 shrink-0 text-right text-xs text-text-lo sm:block">
                {entry.is_file ? formatSize(entry.size) : "—"}
              </span>
              <span className="hidden w-40 shrink-0 text-right text-xs text-text-lo md:block">
                {new Date(entry.modified_at).toLocaleString()}
              </span>
              <Menu
                trigger={
                  <button
                    className="rounded-md p-1.5 text-text-lo opacity-0 transition-opacity hover:bg-panel-3 hover:text-text-hi group-hover:opacity-100"
                    aria-label={`More actions for ${entry.name}`}
                  >
                    <MoreVertical size={15} />
                  </button>
                }
              >
                {entry.is_file && isEditableFile(entry) && (
                  <MenuItem icon={<Pencil size={14} />} onClick={() => openEditor(entry)}>
                    Edit
                  </MenuItem>
                )}
                <MenuItem
                  icon={<Pencil size={14} />}
                  onClick={() => {
                    setRenaming(entry);
                    setNewName(entry.name);
                  }}
                >
                  Rename
                </MenuItem>
                <MenuSeparator />
                <MenuItem danger icon={<Trash2 size={14} />} onClick={() => setDeleting(entry)}>
                  Delete
                </MenuItem>
              </Menu>
            </div>
          ))}
      </div>

      <Modal open={!!renaming} onClose={() => setRenaming(null)} title="Rename item" description={`Renaming "${renaming?.name}"`}>
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRenaming(null)}>
            Cancel
          </Button>
          <Button onClick={handleRename}>Save</Button>
        </div>
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete item"
        description={`This will permanently delete "${deleting?.name}". This action cannot be undone.`}
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.name}
        description={joinPath(path, editing?.name ?? "")}
        className="!max-w-4xl"
      >
        {editLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-text-lo">
            <Loader2 size={16} className="animate-spin" /> Loading...
          </div>
        ) : (
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={28}
            className="font-mono text-[12.5px] resize-y"
            spellCheck={false}
          />
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setEditing(null)}>
            Cancel
          </Button>
          <Button onClick={handleSaveEdit} disabled={editLoading || editSaving}>
            {editSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </Modal>

      <Modal open={creatingFolder} onClose={() => setCreatingFolder(false)} title="New folder" description={`Creating a folder inside "${path}"`}>
        <Input value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="folder-name" autoFocus />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCreatingFolder(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreateFolder}>Create</Button>
        </div>
      </Modal>

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload file" description="Any file type, including .jar mods and plugins.">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full rounded-xl border-2 border-dashed border-line bg-panel-2/60 px-6 py-10 text-center transition-colors hover:border-accent-500/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 size={22} className="mx-auto animate-spin text-text-lo" />
          ) : (
            <Upload size={22} className="mx-auto text-text-lo" />
          )}
          <p className="mt-3 text-[13px] text-text-md">{uploading ? "Uploading..." : "Click to browse"}</p>
          <p className="mt-1 text-xs text-text-lo">Uploads into {path}</p>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUploadFile(file);
            e.target.value = "";
          }}
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setUploadOpen(false)} disabled={uploading}>
            Close
          </Button>
        </div>
      </Modal>
    </div>
  );
}
