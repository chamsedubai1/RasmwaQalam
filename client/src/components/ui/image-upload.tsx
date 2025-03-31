import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, X, AlertCircle, Check } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  onImageUploaded: (imageUrl: string) => void;
  existingImageUrl?: string;
  className?: string;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  onImageUploaded,
  existingImageUrl,
  className
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(existingImageUrl || null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset states
    setError(null);
    setIsUploading(true);
    setUploadSuccess(false);

    // Create FormData
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload image');
      }

      const data = await response.json();
      setImageUrl(data.file.url);
      onImageUploaded(data.file.url);
      setUploadSuccess(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(message);
    } finally {
      setIsUploading(false);
      
      // Clear success message after 3 seconds
      if (uploadSuccess) {
        setTimeout(() => {
          setUploadSuccess(false);
        }, 3000);
      }
    }
  };

  const handleRemoveImage = () => {
    setImageUrl(null);
    onImageUploaded('');
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col space-y-2">
        <Label htmlFor="image-upload">Image</Label>
        
        {!imageUrl ? (
          <div className="relative">
            <Input
              id="image-upload"
              type="file"
              accept="image/*"
              onChange={handleUpload}
              disabled={isUploading}
              className="hidden"
            />
            <Label
              htmlFor="image-upload"
              className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed p-4 text-center hover:bg-muted/25"
            >
              {isUploading ? (
                <div className="flex flex-col items-center space-y-2 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span>Uploading...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-2 text-muted-foreground">
                  <Upload className="h-8 w-8" />
                  <span>Click to upload an image</span>
                  <span className="text-xs">
                    JPG, PNG or GIF, max 5MB
                  </span>
                </div>
              )}
            </Label>
          </div>
        ) : (
          <div className="relative rounded-md border p-2">
            <div className="absolute -right-2 -top-2 z-10">
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="h-6 w-6 rounded-full"
                onClick={handleRemoveImage}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <img
              src={imageUrl}
              alt="Uploaded image"
              className="max-h-64 mx-auto rounded-md object-contain"
            />
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {uploadSuccess && !error && (
        <Alert className="bg-green-50 text-green-800 border-green-200">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription>Image uploaded successfully</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default ImageUpload;