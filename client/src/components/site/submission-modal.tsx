import React, { useState } from "react";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CloudUpload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface SubmissionModalProps {
  eventId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

const SubmissionModal: React.FC<SubmissionModalProps> = ({
  eventId,
  isOpen,
  onClose
}) => {
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState<"text" | "image">("text");
  const [content, setContent] = useState("");
  const [description, setDescription] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const submitMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/submissions', {
        title,
        description,
        contentType,
        content,
        userId: 1, // Using userId=1 for demo
        eventId,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Your submission has been received",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/submissions'] });
      handleClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to submit: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const handleSubmit = () => {
    if (!title) {
      toast({
        title: "Error",
        description: "Please provide a title for your submission",
        variant: "destructive"
      });
      return;
    }

    if (!content) {
      toast({
        title: "Error",
        description: contentType === "text" 
          ? "Please enter your poem or text" 
          : "Please upload or provide an image URL",
        variant: "destructive"
      });
      return;
    }

    submitMutation.mutate();
  };

  const handleClose = () => {
    setTitle("");
    setContentType("text");
    setContent("");
    setDescription("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading">Submit Your Artwork</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="submission-title">Title</Label>
            <Input
              id="submission-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title for your submission"
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="submission-type">Content Type</Label>
            <Select
              value={contentType}
              onValueChange={(value: "text" | "image") => setContentType(value)}
            >
              <SelectTrigger id="submission-type">
                <SelectValue placeholder="Select content type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text/Poetry</SelectItem>
                <SelectItem value="image">Image/Artwork</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {contentType === "text" ? (
            <div className="grid gap-2">
              <Label htmlFor="submission-text">Your Poetry</Label>
              <Textarea
                id="submission-text"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter your poem or text here"
                className="min-h-[150px]"
              />
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="submission-image">Your Artwork</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
                <div className="mb-4">
                  <CloudUpload className="h-10 w-10 text-gray-400 mx-auto" />
                </div>
                <p className="text-sm text-gray-500 mb-2">
                  Drag and drop your image here, or enter an image URL below
                </p>
                <Input
                  type="text"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste an image URL here"
                  className="mt-2"
                />
              </div>
            </div>
          )}
          
          <div className="grid gap-2">
            <Label htmlFor="submission-description">Description/Artist Statement</Label>
            <Textarea
              id="submission-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your submission or provide an artist statement"
              className="min-h-[80px]"
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending ? "Submitting..." : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SubmissionModal;
