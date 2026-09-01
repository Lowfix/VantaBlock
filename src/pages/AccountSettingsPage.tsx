import { useState } from "react";
import type { FormEvent } from "react";
import { ShieldCheck, KeyRound, AlertTriangle } from "lucide-react";
import { DashboardShell } from "../components/layout/DashboardShell";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/Card";
import { Input, Label, FieldError } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Toggle } from "../components/ui/Toggle";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/Tabs";
import { Badge } from "../components/ui/Badge";
import { Avatar } from "../components/ui/Avatar";
import { useUser } from "../context/UserContext";
import type { AppUser } from "../context/UserContext";
import { useToast } from "../components/ui/Toast";
import { DeleteAccountModal } from "../components/account/DeleteAccountModal";

export function AccountSettingsPage() {
  const { user: currentUser, updateProfile, updateSettings, changePassword, deleteAccount } = useUser();
  const { push } = useToast();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const [profile, setProfile] = useState({
    firstName: currentUser?.firstName ?? "",
    lastName: currentUser?.lastName ?? "",
    username: currentUser?.username ?? "",
    email: currentUser?.email ?? "",
  });
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [savingPassword, setSavingPassword] = useState(false);

  if (!currentUser) return null;

  async function handleProfileSave(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateProfile(profile);
      push("Profile updated successfully.", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to update profile.", "warn");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSave(e: FormEvent) {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!passwords.current) errors.current = "Enter your current password";
    if (!passwords.next) errors.next = "Enter a new password";
    else if (passwords.next.length < 8) errors.next = "Must be at least 8 characters";
    if (passwords.confirm !== passwords.next) errors.confirm = "Passwords do not match";
    setPasswordErrors(errors);
    if (Object.keys(errors).length) return;

    setSavingPassword(true);
    try {
      await changePassword(passwords.current, passwords.next);
      setPasswords({ current: "", next: "", confirm: "" });
      push("Password changed successfully.", "success");
    } catch (err) {
      setPasswordErrors({ current: err instanceof Error ? err.message : "Failed to update password." });
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleDeleteAccount(password?: string) {
    await deleteAccount(password);
    push("Your account has been deleted.", "success");
  }

  async function handleTwoFactorToggle(checked: boolean) {
    try {
      await updateSettings({ twoFactorEnabled: checked });
      push(checked ? "Two-factor authentication enabled." : "Two-factor authentication disabled.", checked ? "success" : "warn");
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to update setting.", "warn");
    }
  }

  async function handlePrefToggle(key: keyof AppUser["notificationPrefs"]) {
    try {
      await updateSettings({ notificationPrefs: { [key]: !currentUser!.notificationPrefs[key] } });
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to update preference.", "warn");
    }
  }

  return (
    <DashboardShell title="Account Settings">
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6 max-w-2xl">
          <Card>
            <form onSubmit={handleProfileSave}>
              <CardHeader>
                <div>
                  <CardTitle>Profile information</CardTitle>
                  <CardDescription>Update your name, username, and contact email.</CardDescription>
                </div>
                <Avatar initials={currentUser.avatarInitials} src={currentUser.avatarUrl} className="h-12 w-12 text-[14px]" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="first-name">First name</Label>
                    <Input
                      id="first-name"
                      value={profile.firstName}
                      onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="last-name">Last name</Label>
                    <Input
                      id="last-name"
                      value={profile.lastName}
                      onChange={(e) => setProfile((p) => ({ ...p, lastName: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={profile.username}
                    onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
                <p className="text-xs text-text-lo">Member since {currentUser.memberSince}</p>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={savingProfile}>
                  {savingProfile ? "Saving..." : "Save changes"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-6 max-w-2xl space-y-6">
          <Card>
            <form onSubmit={handlePasswordSave}>
              <CardHeader>
                <div>
                  <CardTitle>Change password</CardTitle>
                  <CardDescription>Choose a strong password you're not using elsewhere.</CardDescription>
                </div>
                <KeyRound size={18} className="text-accent-400" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="current-password">Current password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={passwords.current}
                    error={passwordErrors.current}
                    onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))}
                  />
                  <FieldError>{passwordErrors.current}</FieldError>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="new-password">New password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={passwords.next}
                      error={passwordErrors.next}
                      onChange={(e) => setPasswords((p) => ({ ...p, next: e.target.value }))}
                    />
                    <FieldError>{passwordErrors.next}</FieldError>
                  </div>
                  <div>
                    <Label htmlFor="confirm-password">Confirm password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={passwords.confirm}
                      error={passwordErrors.confirm}
                      onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
                    />
                    <FieldError>{passwordErrors.confirm}</FieldError>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={savingPassword}>
                  {savingPassword ? "Updating..." : "Update password"}
                </Button>
              </CardFooter>
            </form>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Two-factor authentication</CardTitle>
                <CardDescription>Add an extra layer of security to your account.</CardDescription>
              </div>
              <ShieldCheck size={18} className="text-accent-400" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg border border-line bg-panel-2 px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-[13.5px] font-medium text-text-hi">Authenticator app</p>
                    <p className="text-xs text-text-lo">Use an app like Authy or Google Authenticator</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {currentUser.twoFactorEnabled && <Badge tone="good">Enabled</Badge>}
                  <Toggle checked={currentUser.twoFactorEnabled} onChange={handleTwoFactorToggle} label="Two-factor authentication" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="!border-bad/25">
            <CardHeader>
              <div>
                <CardTitle>Danger zone</CardTitle>
                <CardDescription>Permanently delete your account and any servers you own.</CardDescription>
              </div>
              <AlertTriangle size={18} className="text-bad" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg border border-bad/25 bg-bad/5 px-4 py-3.5">
                <div>
                  <p className="text-[13.5px] font-medium text-text-hi">Delete account</p>
                  <p className="text-xs text-text-lo">This can't be undone.</p>
                </div>
                <Button variant="danger" onClick={() => setDeleteModalOpen(true)}>
                  Delete account
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-6 max-w-2xl">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Notification preferences</CardTitle>
                <CardDescription>Choose what Vantablock emails you about.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <PrefRow
                title="Server alerts"
                description="Crashes, restarts, and resource limit warnings"
                checked={currentUser.notificationPrefs.serverAlerts}
                onChange={() => handlePrefToggle("serverAlerts")}
              />
              <PrefRow
                title="Product updates"
                description="New features and platform changes"
                checked={currentUser.notificationPrefs.productUpdates}
                onChange={() => handlePrefToggle("productUpdates")}
              />
              <PrefRow
                title="Marketing emails"
                description="Promotions, discounts, and newsletters"
                checked={currentUser.notificationPrefs.marketingEmails}
                onChange={() => handlePrefToggle("marketingEmails")}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DeleteAccountModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        hasPassword={currentUser.hasPassword}
        onConfirm={handleDeleteAccount}
      />
    </DashboardShell>
  );
}

function PrefRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-line-soft py-3.5 last:border-b-0">
      <div>
        <p className="text-[13.5px] font-medium text-text-hi">{title}</p>
        <p className="text-xs text-text-lo">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} label={title} />
    </div>
  );
}
