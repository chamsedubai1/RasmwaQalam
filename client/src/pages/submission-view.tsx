import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Clock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Submission } from "@shared/schema";

// Extended submission type with additional properties from API
interface ExtendedSubmission extends Submission {
  voteCount: number;
  userFullName: string;
  eventName: string;
  imageUrl?: string;
  type?: string;
  createdAt?: Date | string;
}

export default function SubmissionView() {
  const [, params] = useRoute<{ id: string }>("/submission/:id");
  const submissionId = params?.id ? parseInt(params.id, 10) : null;
  const [error, setError] = useState<string | null>(null);

  const { data: submission, isLoading, isError } = useQuery<ExtendedSubmission>({
    queryKey: ["/api/submissions", submissionId],
    queryFn: async () => {
      if (!submissionId) {
        throw new Error("No submission ID provided");
      }
      const response = await fetch(`/api/submissions/${submissionId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch submission");
      }
      return response.json();
    },
    enabled: !!submissionId
  });

  useEffect(() => {
    if (isError) {
      setError("Failed to load submission. It may have been deleted or you don't have permission to view it.");
    } else {
      setError(null);
    }
  }, [isError]);

  if (!submissionId) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          No submission ID provided. Please go back and try again.
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !submission) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          {error || "Failed to load submission. Please try again later."}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{submission.title}</h1>
        <div className="flex items-center gap-2 text-muted-foreground mt-2">
          <Clock className="h-4 w-4" />
          <span>Submitted {new Date(submission.submittedAt || Date.now()).toLocaleDateString()}</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submission Details</CardTitle>
          <CardDescription>
            Created by {submission.userFullName} for {submission.eventName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {submission.description && (
            <div>
              <h3 className="text-lg font-medium">Description</h3>
              <p className="mt-1">{submission.description}</p>
            </div>
          )}

          <div>
            <h3 className="text-lg font-medium">Content</h3>
            <div className="mt-2 border rounded-md p-4 bg-muted/50">
              {submission.type === "poetry" ? (
                <div className="whitespace-pre-wrap font-serif">{submission.content}</div>
              ) : (
                <div className="flex justify-center">
                  <img 
                    src={submission.imageUrl || submission.content} 
                    alt={submission.title} 
                    className="max-w-full object-contain max-h-[500px]" 
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <span className="text-sm font-medium">Votes received: </span>
              <span className="text-sm">{submission.voteCount}</span>
            </div>

            <div className="space-x-2">
              {submission.classWinner && (
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                  Class Winner
                </span>
              )}
              {submission.schoolWinner && (
                <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
                  School Winner
                </span>
              )}
              {submission.countryWinner && (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                  Country Winner
                </span>
              )}
              {submission.globalWinner && (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                  Global Winner
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}