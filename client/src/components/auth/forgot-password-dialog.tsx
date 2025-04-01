import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ForgotPasswordDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ForgotPasswordDialog({
  isOpen,
  onClose,
}: ForgotPasswordDialogProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast({
        title: "Error",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    setStatus("submitting");

    try {
      const response = await apiRequest("POST", "/api/auth/forgot-password", {
        email,
      });

      setStatus("success");
      
      // For demo purposes, we're using the token returned from the API
      // In a real app, this would be sent to the user's email
      if (response.debug) {
        setResetToken(response.debug.token);
        setUserId(response.debug.userId);
      }
      
      toast({
        title: "Success",
        description: response.message,
      });
    } catch (error) {
      console.error("Password reset request error:", error);
      setStatus("error");
      toast({
        title: "Error",
        description: "There was an error processing your request. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    // Password validation pattern: at least 8 characters, 1 uppercase, 1 number, 2 special characters
    const passwordPattern = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
    if (!passwordPattern.test(newPassword)) {
      toast({
        title: "Error",
        description: "Password must contain at least 8 characters, 1 uppercase letter, 1 number, and 2 special characters",
        variant: "destructive",
      });
      return;
    }

    setStatus("submitting");

    try {
      const response = await apiRequest("POST", "/api/auth/reset-password", {
        token: resetToken,
        userId: userId,
        newPassword,
      });

      setStatus("success");
      toast({
        title: "Success",
        description: "Your password has been reset successfully. You can now login with your new password.",
      });
      
      // Close the dialog after successful password reset
      onClose();
    } catch (error) {
      console.error("Password reset error:", error);
      setStatus("error");
      toast({
        title: "Error",
        description: "There was an error resetting your password. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setEmail("");
    setStatus("idle");
    setResetToken(null);
    setUserId(null);
    setNewPassword("");
    setConfirmPassword("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            {!resetToken
              ? "Enter your email address and we'll send you a password reset link."
              : "Enter your new password."}
          </DialogDescription>
        </DialogHeader>

        {!resetToken ? (
          <form onSubmit={handleResetRequest} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === "submitting" || status === "success"}
              />
            </div>

            {status === "error" && (
              <div className="flex items-center gap-2 text-red-500 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>
                  An error occurred. Please check your email and try again.
                </span>
              </div>
            )}

            {status === "success" && !resetToken && (
              <div className="flex items-center gap-2 text-green-500 text-sm">
                <CheckCircle className="h-4 w-4" />
                <span>
                  If your email is registered, you will receive password reset instructions.
                </span>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="mt-2 sm:mt-0"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="mt-2 sm:mt-0"
                disabled={status === "submitting" || status === "success"}
              >
                {status === "submitting" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={status === "submitting"}
              />
              <p className="text-xs text-gray-500">
                Password must contain at least 8 characters, 1 uppercase letter, 1 number, and 2 special characters.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={status === "submitting"}
              />
            </div>

            {status === "error" && (
              <div className="flex items-center gap-2 text-red-500 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>
                  An error occurred. Please try again.
                </span>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="mt-2 sm:mt-0"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="mt-2 sm:mt-0"
                disabled={status === "submitting"}
              >
                {status === "submitting" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}