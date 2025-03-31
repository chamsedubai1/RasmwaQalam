import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import ImageUpload from '@/components/ui/image-upload';

const UploadTestPage: React.FC = () => {
  const [imageUrl, setImageUrl] = useState<string>('');

  const handleImageUploaded = (url: string) => {
    setImageUrl(url);
    console.log("Image uploaded:", url);
  };

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Image Upload Test</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Upload Image</CardTitle>
            <CardDescription>
              Test the image upload functionality. You can upload JPG, PNG, or GIF files up to 5MB.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImageUpload onImageUploaded={handleImageUploaded} />
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="w-full"
            >
              Refresh Page
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Image Preview</CardTitle>
            <CardDescription>
              This shows the uploaded image with its URL for reference.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {imageUrl ? (
              <>
                <div className="aspect-video relative border rounded-md mb-4">
                  <img 
                    src={imageUrl} 
                    alt="Uploaded image" 
                    className="object-contain w-full h-full rounded-md"
                  />
                </div>
                <div className="text-sm font-mono bg-muted p-2 rounded break-all">
                  {imageUrl}
                </div>
              </>
            ) : (
              <div className="aspect-video flex items-center justify-center border border-dashed rounded-md text-muted-foreground">
                No image uploaded yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UploadTestPage;