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
import { CloudUpload, Sparkles, PenLine, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";
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
  const [aiPrompt, setAiPrompt] = useState("");
  const [poetryStyle, setPoetryStyle] = useState<string>("free");
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();
  const queryClient = useQueryClient();

  interface PoemResponse {
    content: string;
  }

  interface ImageResponse {
    imageUrl: string;
  }

  // Generate poem using AI
  const generatePoemMutation = useMutation({
    mutationFn: async () => {
      return apiRequest<PoemResponse>('POST', '/api/ai/generate-poem', {
        prompt: aiPrompt,
        style: poetryStyle
      });
    },
    onSuccess: (data: PoemResponse) => {
      setContent(data.content);
      toast({
        title: "Poetry Generated",
        description: "Your AI-generated poem is ready for review",
      });
      setIsGenerating(false);
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: `Failed to generate poem: ${error.message}`,
        variant: "destructive"
      });
      setIsGenerating(false);
    }
  });

  // Generate image using AI
  const generateImageMutation = useMutation({
    mutationFn: async () => {
      return apiRequest<ImageResponse>('POST', '/api/ai/generate-image', {
        prompt: aiPrompt
      });
    },
    onSuccess: (data: ImageResponse) => {
      setContent(data.imageUrl);
      toast({
        title: "Artwork Generated",
        description: "Your AI-generated artwork is ready for review",
      });
      setIsGenerating(false);
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: `Failed to generate artwork: ${error.message}`,
        variant: "destructive"
      });
      setIsGenerating(false);
    }
  });

  interface SubmissionResponse {
    id: number;
  }

  // Submission
  const submitMutation = useMutation({
    mutationFn: async () => {
      // Get the authenticated user's ID
      const userId = user?.id;
      
      if (!userId) {
        throw new Error("You must be logged in to submit");
      }
      
      return apiRequest<SubmissionResponse>('POST', '/api/submissions', {
        title,
        description,
        contentType,
        content,
        userId,
        eventId,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Your submission has been received",
      });
      // Invalidate all submissions queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/submissions'] });
      // Also specifically invalidate user submissions
      queryClient.invalidateQueries({ queryKey: [`/api/submissions?userId=${user?.id}`] });
      handleClose();
    },
    onError: (error: any) => {
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

  const handleGenerateContent = () => {
    if (!aiPrompt) {
      toast({
        title: "Error",
        description: "Please enter a prompt for AI generation",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);

    if (contentType === "text") {
      generatePoemMutation.mutate();
    } else {
      generateImageMutation.mutate();
    }
  };

  const handleClose = () => {
    setTitle("");
    setContentType("text");
    setContent("");
    setDescription("");
    setAiPrompt("");
    setPoetryStyle("free");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-xl font-heading">Submit Your Artwork</DialogTitle>
        </DialogHeader>
        
        <div className="overflow-y-auto pr-2 flex-grow">
          <div className="grid gap-4 py-4">
            <div className="grid gap-2 w-full">
              <Label htmlFor="submission-title">Title</Label>
              <Input
                id="submission-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a title for your submission"
                className="w-full"
              />
            </div>
            
            <div className="grid gap-2 w-full">
              <Label htmlFor="submission-type">Content Type</Label>
              <Select
                value={contentType}
                onValueChange={(value: "text" | "image") => setContentType(value)}
              >
                <SelectTrigger id="submission-type" className="w-full">
                  <SelectValue placeholder="Select content type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text/Poetry</SelectItem>
                  <SelectItem value="image">Image/Artwork</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* AI Generation Section */}
            <div className="border border-blue-200 rounded-md p-4 bg-blue-50">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="text-blue-600 h-5 w-5" />
                <h3 className="text-md font-medium text-blue-800">AI Creator</h3>
              </div>
              
              <div className="grid gap-3">
                <div className="w-full">
                  <Label htmlFor="ai-prompt">Your Prompt</Label>
                  <Textarea
                    id="ai-prompt"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder={contentType === "text" 
                      ? "Describe the poem you want AI to create..." 
                      : "Describe the image you want AI to create..."}
                    className="min-h-[60px] mt-1 w-full"
                  />
                </div>
                
                {contentType === "text" && (
                  <div className="w-full">
                    <Label htmlFor="poetry-style">Poetry Style</Label>
                    <Select
                      value={poetryStyle}
                      onValueChange={setPoetryStyle}
                    >
                      <SelectTrigger id="poetry-style" className="w-full">
                        <SelectValue placeholder="Select style" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free Verse</SelectItem>
                        <SelectItem value="haiku">Haiku</SelectItem>
                        <SelectItem value="sonnet">Sonnet</SelectItem>
                        <SelectItem value="limerick">Limerick</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <Button 
                  type="button" 
                  className="mt-1 w-full bg-gradient-to-r from-primary to-indigo-600"
                  onClick={handleGenerateContent}
                  disabled={isGenerating || !aiPrompt}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate with AI
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            {contentType === "text" ? (
              <div className="grid gap-2 w-full">
                <Label htmlFor="submission-text">Your Poetry</Label>
                <Textarea
                  id="submission-text"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter your poem or text here, or use AI to generate it"
                  className="min-h-[120px] w-full"
                />
              </div>
            ) : (
              <div className="grid gap-2 w-full">
                <Label htmlFor="submission-image">Your Artwork</Label>
                <div className="border-2 border-dashed border-blue-300 rounded-md p-4 text-center bg-blue-50/50 w-full">
                  {content ? (
                    <div className="mb-4">
                      <img 
                        src={content} 
                        alt="Generated artwork" 
                        className="max-h-[150px] mx-auto object-contain rounded shadow-sm"
                      />
                    </div>
                  ) : (
                    <div className="mb-4">
                      <CloudUpload className="h-10 w-10 text-blue-400 mx-auto" />
                    </div>
                  )}
                  <p className="text-sm text-blue-700 mb-2">
                    {content ? "AI-generated image is shown above" : "Use AI to generate artwork or enter an image URL below"}
                  </p>
                  <Input
                    type="text"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Paste an image URL here"
                    className="mt-2 w-full"
                  />
                </div>
              </div>
            )}
            
            <div className="grid gap-2 w-full">
              <Label htmlFor="submission-description">Description/Artist Statement</Label>
              <Textarea
                id="submission-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your submission or provide an artist statement"
                className="min-h-[60px] w-full"
              />
            </div>
          </div>
        </div>
        
        <DialogFooter className="flex-shrink-0 mt-4 border-t pt-4">
          <Button variant="outline" onClick={handleClose} className="border-blue-300 text-blue-700 hover:bg-blue-50">
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SubmissionModal;
