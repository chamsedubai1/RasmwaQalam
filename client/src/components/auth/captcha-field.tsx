import React, { useState, useEffect, useCallback } from 'react';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { Control } from 'react-hook-form';

// Extend this interface based on your form structure
interface CaptchaFieldProps {
  control: Control<any>;
  name: string;
  label?: string;
  description?: string;
}

export function CaptchaField({ control, name, label = "CAPTCHA", description }: CaptchaFieldProps) {
  const [captchaImage, setCaptchaImage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCaptcha = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/captcha');
      
      if (!response.ok) {
        throw new Error('Failed to load CAPTCHA');
      }
      
      const data = await response.json();
      setCaptchaImage(data.image);
      
      // When in development, log the CAPTCHA text if available
      if (data.text) {
        console.log('CAPTCHA text for testing:', data.text);
      }
    } catch (err) {
      setError('Failed to load CAPTCHA. Please try again.');
      console.error('CAPTCHA fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load CAPTCHA on component mount
  useEffect(() => {
    fetchCaptcha();
  }, [fetchCaptcha]);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <div className="space-y-2">
            <div className="relative mb-2 flex items-center justify-center bg-white rounded-md border">
              {isLoading ? (
                <div className="flex h-20 w-full items-center justify-center">
                  <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : error ? (
                <div className="flex h-20 w-full items-center justify-center text-destructive">
                  {error}
                </div>
              ) : (
                <div 
                  dangerouslySetInnerHTML={{ __html: captchaImage }} 
                  className="flex items-center justify-center my-2 w-full"
                />
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-2"
                onClick={fetchCaptcha}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <FormControl>
              <Input
                {...field}
                placeholder="Enter the text from the image"
                disabled={isLoading || !!error}
                className="uppercase"
              />
            </FormControl>
            {description && <FormDescription>{description}</FormDescription>}
            <FormMessage />
          </div>
        </FormItem>
      )}
    />
  );
}