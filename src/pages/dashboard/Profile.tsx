import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  User,
  Mail,
  Calendar,
  Shield,
  LogOut,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export default function Profile() {
  const { user, signOut } = useAuth();

  const meta = user?.user_metadata ?? {};
  const [displayName, setDisplayName] = useState(meta.full_name ?? "");
  const [saving, setSaving] = useState(false);

  const provider = user?.app_metadata?.provider ?? "email";
  const createdAt = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: displayName },
    });
    if (error) {
      toast.error("Failed to update profile: " + error.message);
    } else {
      toast.success("Profile updated.");
    }
    setSaving(false);
  };

  const hasChanges = displayName !== (meta.full_name ?? "");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Profile</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Avatar & identity card */}
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col items-center gap-4 py-8">
            {meta.avatar_url ? (
              <img
                src={meta.avatar_url}
                alt=""
                className="h-20 w-20 rounded-full border-2 border-muted"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="text-center">
              <p className="text-lg font-medium">
                {meta.full_name || user?.email || "User"}
              </p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <Badge variant="secondary" className="capitalize">
              {provider}
            </Badge>
          </CardContent>
        </Card>

        {/* Edit form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Account Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="display-name">Display Name</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={user?.email ?? ""}
                disabled
                className="cursor-not-allowed opacity-60"
              />
              <p className="text-xs text-muted-foreground">
                Email is managed by your auth provider and cannot be changed here.
              </p>
            </div>

            <Button onClick={handleSave} disabled={saving || !hasChanges}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Account info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-blue-500/10 p-2">
                <Mail className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium">{user?.email ?? "—"}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-md bg-green-500/10 p-2">
                <Shield className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Auth Provider</p>
                <p className="text-sm font-medium capitalize">{provider}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-md bg-purple-500/10 p-2">
                <Calendar className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Member Since</p>
                <p className="text-sm font-medium">{createdAt}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Sign out */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Sign Out</p>
          <p className="text-xs text-muted-foreground">
            Sign out of your OpenEye account on this device.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => signOut()}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
