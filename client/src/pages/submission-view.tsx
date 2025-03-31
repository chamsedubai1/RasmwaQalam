import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ArrowLeft, Award, Calendar, Clock, Eye, ThumbsUp, User } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Submission } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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
        const errorText = await response.text();
        console.error("Failed to fetch submission:", errorText);
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
        <div className="flex items-center space-x-2">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[200px]" />
            <Skeleton className="h-4 w-[150px]" />
          </div>
        </div>
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
        <div className="mt-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </Alert>
    );
  }

  const isPoetry = submission.type === "poetry";
  const winnerBadges = [];
  
  if (submission.classWinner) {
    winnerBadges.push({ label: "Class Winner", color: "bg-blue-100 text-blue-800" });
  }
  if (submission.schoolWinner) {
    winnerBadges.push({ label: "School Winner", color: "bg-purple-100 text-purple-800" });
  }
  if (submission.countryWinner) {
    winnerBadges.push({ label: "Country Winner", color: "bg-amber-100 text-amber-800" });
  }
  if (submission.globalWinner) {
    winnerBadges.push({ label: "Global Winner", color: "bg-emerald-100 text-emerald-800" });
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
        
        {winnerBadges.length > 0 && (
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" />
            <span className="font-medium">Award Status:</span>
            <div className="flex flex-wrap gap-2">
              {winnerBadges.map((badge, index) => (
                <Badge key={index} className={badge.color}>{badge.label}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="space-y-1">
            <CardTitle className="text-2xl">{submission.title}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>Event: {submission.eventName}</span>
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1.5">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>By <span className="font-medium">{submission.userFullName}</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Submitted {new Date(submission.submittedAt || Date.now()).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ThumbsUp className="h-4 w-4 text-muted-foreground" />
              <span>{submission.voteCount} votes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span>{isPoetry ? "Poetry" : "Artwork"}</span>
            </div>
          </div>

          {submission.description && (
            <div>
              <h3 className="text-lg font-medium mb-2">Description</h3>
              <p className="text-muted-foreground">{submission.description}</p>
              <Separator className="my-4" />
            </div>
          )}

          <div>
            <h3 className="text-lg font-medium mb-3">{isPoetry ? "Poem" : "Artwork"}</h3>
            <div className={`rounded-md p-6 ${isPoetry ? 'bg-slate-50 dark:bg-slate-900' : 'bg-white dark:bg-slate-950'}`}>
              {isPoetry ? (
                <div className="whitespace-pre-wrap font-serif text-lg leading-relaxed">{submission.content}</div>
              ) : (
                <div className="flex justify-center">
                  <img 
                    src={submission.imageUrl || submission.content} 
                    alt={submission.title} 
                    className="max-w-full rounded-md shadow-sm object-contain max-h-[500px]" 
                  />
                </div>
              )}
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="border-t bg-muted/30 px-6 py-4">
          <div className="flex justify-between items-center w-full">
            <div className="text-sm text-muted-foreground">
              Submission ID: {submission.id}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Dashboard
                </Link>
              </Button>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}