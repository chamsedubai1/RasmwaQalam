import React, { useState, useEffect } from "react";
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
import { CloudUpload, Sparkles, PenLine, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  const [aiImageService, setAiImageService] = useState<string>("huggingface");
  const [aiTextService, setAiTextService] = useState<string>("ollama");
  const [aiTextModel, setAiTextModel] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  interface ModelInfo {
    id: string;
    displayName: string;
    description: string;
    capabilities: Array<'text' | 'vision' | 'reasoning'>;
    sizeMB: number;
    speedHint: 'fast' | 'medium' | 'slow';
  }

  // Fetch the model catalog (only models actually installed on the server)
  const { data: modelsData } = useQuery<{ models: ModelInfo[] }>({
    queryKey: ['/api/ai/models'],
    enabled: isOpen,
    staleTime: 60_000,
  });
  const installedModels = modelsData?.models ?? [];
  const textModels = installedModels.filter((m) => m.capabilities.includes('text') && !m.capabilities.includes('vision'));

  // Once models load, pick the first one as default if nothing is selected
  useEffect(() => {
    if (!aiTextModel && textModels.length > 0) {
      setAiTextModel(textModels[0].id);
    }
  }, [textModels, aiTextModel]);
  const { toast } = useToast();
  const { user } = useUser();
  const queryClient = useQueryClient();
  
  // Define event interface
  interface EventData {
    id: number;
    name: string;
    type: string;
    stage: string;
    status: string;
    mode?: string;  // Add mode property to check if AI is allowed
    description?: string;
  }
  
  // Fetch event details to determine allowed content type
  const { data: eventData, isLoading: isLoadingEvent } = useQuery<EventData>({
    queryKey: [`/api/events/${eventId}`],
    enabled: !!eventId && isOpen
  });
  
  // Set content type when event data changes
  useEffect(() => {
    if (eventData && eventData.type) {
      const evType = eventData.type.toLowerCase();
      if (evType === "poetry") {
        setContentType("text");
      } else if (evType === "painting") {
        setContentType("image");
      }
    }
  }, [eventData]);
  
  // Extract event type for UI display
  const eventType = eventData?.type?.toLowerCase() || null;

  interface PoemResponse {
    content: string;
    service?: string;
    usedFallback?: boolean;
  }

  interface ImageResponse {
    imageUrl: string;
    service?: string;
    usedFallback?: boolean;
  }

  // Generate poem using AI
  const generatePoemMutation = useMutation({
    mutationFn: async () => {
      return apiRequest<PoemResponse>('POST', '/api/ai/generate-poem', {
        prompt: aiPrompt,
        style: poetryStyle,
        service: aiTextService,
        model: aiTextService === 'ollama' ? aiTextModel : undefined,
      });
    },
    onSuccess: (data: PoemResponse) => {
      setContent(data.content);
      const serviceName = data.service === 'openai' ? 'OpenAI' :
                         data.service === 'huggingface' ? 'Hugging Face' :
                         data.service === 'ollama' ? 'Local AI (Qwen)' :
                         'AI';

      if (data.usedFallback) {
        toast({
          title: "Poetry Generated with Fallback",
          description: `Local AI unavailable — your poem was generated using ${serviceName} instead`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Poetry Generated",
          description: `Your ${serviceName}-generated poem is ready for review`,
        });
      }
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
        prompt: aiPrompt,
        service: aiImageService
      });
    },
    onSuccess: (data: ImageResponse) => {
      setContent(data.imageUrl);
      const serviceName = data.service === 'openai' ? 'OpenAI' : 
                         data.service === 'huggingface' ? 'Hugging Face' : 
                         data.service === 'stability' ? 'Stability AI' : 
                         'AI';
      
      if (data.usedFallback) {
        toast({
          title: "Artwork Generated with Fallback",
          description: `${aiImageService === 'openai' ? 'OpenAI' : 
                                   aiImageService === 'stability' ? 'Stability AI' : 
                                   'Selected service'} quota exceeded - your artwork was generated using ${serviceName} instead`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Artwork Generated",
          description: `Your ${serviceName}-generated artwork is ready for review`,
        });
      }
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
    setAiImageService("huggingface");
    setAiTextService("ollama");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-xl font-heading">
            {isLoadingEvent 
              ? "Submit Your Work" 
              : eventType === "poetry" 
                ? "Submit Your Poetry" 
                : eventType === "painting" 
                  ? "Submit Your Artwork" 
                  : "Submit Your Work"}
          </DialogTitle>
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
            
            {/* Content Type selection - disabled when event type is specific */}
            <div className="grid gap-2 w-full">
              <Label htmlFor="submission-type">Content Type</Label>
              {isLoadingEvent ? (
                <div className="flex items-center justify-center h-10 bg-blue-50 rounded-md">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500 mr-2" />
                  <span className="text-sm text-blue-600">Loading event details...</span>
                </div>
              ) : eventType === "poetry" || eventType === "painting" ? (
                <>
                  <div className="flex items-center border rounded-md p-2 bg-blue-50 border-blue-200">
                    <div className="h-9 flex items-center px-3 text-blue-800">
                      {eventType === "poetry" ? "Text/Poetry" : "Image/Artwork"}
                    </div>
                  </div>
                  <Alert className="mt-2 bg-blue-50 border-blue-200">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-sm text-blue-700">
                      {eventType === "poetry" 
                        ? "This poetry event only accepts text submissions." 
                        : "This painting event only accepts image submissions."}
                    </AlertDescription>
                  </Alert>
                </>
              ) : (
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
              )}
            </div>

            {/* AI Generation Section - Only shown if event mode allows AI */}
            {(!eventData || eventData.mode !== 'noAI') && (
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
                    <>
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
                      
                      <div className="w-full">
                        <Label htmlFor="text-ai-service">AI Service</Label>
                        <Select
                          value={aiTextService}
                          onValueChange={setAiTextService}
                        >
                          <SelectTrigger id="text-ai-service" className="w-full">
                            <SelectValue placeholder="Select AI service" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ollama">Local AI (self-hosted)</SelectItem>
                            <SelectItem value="huggingface">Hugging Face (Open Source)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {aiTextService === 'ollama' && textModels.length > 0 && (
                        <div className="w-full">
                          <Label htmlFor="ai-model">Model</Label>
                          <Select
                            value={aiTextModel}
                            onValueChange={setAiTextModel}
                          >
                            <SelectTrigger id="ai-model" className="w-full">
                              <SelectValue placeholder="Select a model" />
                            </SelectTrigger>
                            <SelectContent>
                              {textModels.map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.displayName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {aiTextModel && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {textModels.find((m) => m.id === aiTextModel)?.description}
                            </p>
                          )}
                        </div>
                      )}

                      {aiTextService === 'ollama' && textModels.length === 0 && (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            No local AI models are installed on the server. Ask an admin to pull models with `ollama pull`.
                          </AlertDescription>
                        </Alert>
                      )}
                    </>
                  )}
                  
                  {contentType === "image" && (
                    <div className="w-full">
                      <Label htmlFor="image-ai-service">AI Service</Label>
                      <Select
                        value={aiImageService}
                        onValueChange={setAiImageService}
                      >
                        <SelectTrigger id="image-ai-service" className="w-full">
                          <SelectValue placeholder="Select AI service" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="huggingface">Hugging Face (Open Source)</SelectItem>
                          <SelectItem value="stability">Stability AI</SelectItem>
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
            )}
            
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
                    {content 
                      ? (content.startsWith("data:") || !eventData?.mode) 
                        ? "Image is shown above" 
                        : "AI-generated image is shown above"
                      : eventData?.mode === 'noAI'
                        ? "Upload your drawing or painting masterpiece" 
                        : "Use AI to generate artwork or enter an image URL below"
                    }
                  </p>
                  {eventData?.mode === 'noAI' ? (
                    <div 
                      className="flex flex-col items-center w-full px-3 py-4 border-2 border-dashed border-blue-300 rounded-md transition-colors"
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const dropArea = e.currentTarget;
                        dropArea.classList.add('bg-blue-100', 'border-blue-400');
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const dropArea = e.currentTarget;
                        dropArea.classList.remove('bg-blue-100', 'border-blue-400');
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        const dropArea = e.currentTarget;
                        dropArea.classList.remove('bg-blue-100', 'border-blue-400');
                        
                        // Get the dropped files
                        const files = e.dataTransfer.files;
                        if (files.length > 0) {
                          const file = files[0];
                          if (file.type.startsWith('image/')) {
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                              if (evt.target?.result) {
                                setContent(evt.target.result as string);
                              }
                            };
                            reader.readAsDataURL(file);
                          } else {
                            toast({
                              title: "Invalid File Type",
                              description: "Please upload an image file only",
                              variant: "destructive"
                            });
                          }
                        }
                      }}
                    >
                      <CloudUpload className="h-12 w-12 text-blue-400 mb-2" />
                      <p className="text-sm text-blue-700 mb-3">Drag and drop your image here</p>
                      <label 
                        htmlFor="file-upload" 
                        className="cursor-pointer bg-blue-100 hover:bg-blue-200 border border-blue-300 text-blue-700 py-2 px-6 rounded-md flex items-center justify-center"
                      >
                        <CloudUpload className="h-4 w-4 mr-2" />
                        Browse Files
                      </label>
                      <input 
                        id="file-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                              if (evt.target?.result) {
                                setContent(evt.target.result as string);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <p className="text-xs text-gray-500 mt-3">Upload your drawing or painting masterpiece</p>
                    </div>
                  ) : (
                    <Input
                      type="text"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Paste an image URL here"
                      className="mt-2 w-full"
                    />
                  )}
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
