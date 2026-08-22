import { useState } from "react";
import type { FormEvent } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input, Label, FieldError } from "../ui/Input";

interface DeleteAccountModalProps {
  open: boolean;
  onClose: () => void;
  hasPassword: boolean;
  onConfirm: (password?: string) => Promise<void>;
}

export function DeleteAccountModal({ open, onClose, hasPassword, onConfirm }: DeleteAccountModalProps) {
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  function handleClose() {
    setPassword("");
    setConfirmText("");
    setError("");
    onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (confirmText !== "DELETE") {
      setError('Type "DELETE" to confirm.');
      return;
    }
    setDeleting(true);
    setError("");
    try {
      await onConfirm(hasPassword ? password : undefined);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Delete account"
      description="This permanently deletes your account and any servers you own. This can't be undone."
      className="!max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {hasPassword && (
          <div>
            <Label htmlFor="delete-password">Confirm your password</Label>
            <Input
              id="delete-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>
        )}
        <div>
          <Label htmlFor="delete-confirm">
            Type <span className="font-semibold text-text-hi">DELETE</span> to confirm
          </Label>
          <Input
            id="delete-confirm"
            value={confirmText}
            error={error}
            onChange={(e) => setConfirmText(e.target.value)}
            autoFocus={!hasPassword}
          />
          <FieldError>{error}</FieldError>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" disabled={deleting}>
            {deleting ? "Deleting..." : "Delete my account"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
