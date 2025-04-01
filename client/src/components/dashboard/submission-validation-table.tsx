import React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, Eye } from "lucide-react";

interface SubmissionValidationTableProps {
  classId: number;
  onViewSubmission?: (submissionId: number) => void;
}

const SubmissionValidationTable: React.FC<SubmissionValidationTableProps> = ({
  classId,
  onViewSubmission,
}) => {
  const { toast } = useToast();
  const [viewSubmissionId, setViewSubmissionId] = React.useState<number | null>(null);
  const [viewSubmissionDialogOpen, setViewSubmissionDialogOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("pending");

  // Fetch pending submissions for this class
  const {
    data: pendingSubmissions = [],
    isLoading: isPendingLoading,
    refetch: refetchPendingSubmissions,
  } = useQuery<any[]>({
    queryKey: ["/api/submissions", { classId, pending: true }],
    enabled: classId > 0 && activeTab === "pending",
  });

  // Fetch validated submissions for this class
  const {
    data: validatedSubmissions = [],
    isLoading: isValidatedLoading,
    refetch: refetchValidatedSubmissions,
  } = useQuery<any[]>({
    queryKey: ["/api/submissions", { classId, validated: true }],
    enabled: classId > 0 && activeTab === "validated",
  });

  // Get single submission details
  const { data: viewedSubmission, isLoading: isViewLoading } = useQuery<any>({
    queryKey: ["/api/submissions", viewSubmissionId],
    enabled: !!viewSubmissionId,
  });

  // Validate submission mutation
  const validateSubmissionMutation = useMutation({
    mutationFn: async ({ submissionId, validated }: { submissionId: number; validated: boolean }) => {
      return apiRequest("POST", `/api/submissions/${submissionId}/validate`, { validated });
    },
    onSuccess: () => {
      // Refetch both lists after validation
      refetchPendingSubmissions();
      refetchValidatedSubmissions();
      toast({
        title: "Success",
        description: "Submission validation status updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to update submission: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleApprove = (submissionId: number) => {
    validateSubmissionMutation.mutate({ submissionId, validated: true });
  };

  const handleReject = (submissionId: number) => {
    validateSubmissionMutation.mutate({ submissionId, validated: false });
  };

  const handleView = (submissionId: number) => {
    if (onViewSubmission) {
      onViewSubmission(submissionId);
    } else {
      setViewSubmissionId(submissionId);
      setViewSubmissionDialogOpen(true);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="pending" value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending" className="relative">
            Pending Validation
            {pendingSubmissions.length > 0 && (
              <Badge className="ml-2 bg-yellow-500">{pendingSubmissions.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="validated">
            Validated Submissions
            {validatedSubmissions.length > 0 && (
              <Badge className="ml-2 bg-green-500">{validatedSubmissions.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Submissions Awaiting Validation</CardTitle>
              <CardDescription>
                Review and approve student submissions before they become visible to classmates
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isPendingLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : pendingSubmissions.length === 0 ? (
                <div className="text-center py-8 bg-muted/30 rounded-lg">
                  <p className="text-muted-foreground">No submissions await validation</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingSubmissions.map((submission) => (
                      <TableRow key={submission.id}>
                        <TableCell className="font-medium">{submission.title}</TableCell>
                        <TableCell>{submission.userFullName}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              submission.contentType === "text"
                                ? "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
                                : "bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200"
                            }
                          >
                            {submission.contentType === "text" ? "Poem" : "Image"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(submission.submittedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleView(submission.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
                            onClick={() => handleApprove(submission.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                            onClick={() => handleReject(submission.id)}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validated">
          <Card>
            <CardHeader>
              <CardTitle>Validated Submissions</CardTitle>
              <CardDescription>
                These submissions have been reviewed and are visible to students for voting
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isValidatedLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : validatedSubmissions.length === 0 ? (
                <div className="text-center py-8 bg-muted/30 rounded-lg">
                  <p className="text-muted-foreground">No validated submissions yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Validated</TableHead>
                      <TableHead>Votes</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validatedSubmissions.map((submission) => (
                      <TableRow key={submission.id}>
                        <TableCell className="font-medium">{submission.title}</TableCell>
                        <TableCell>{submission.userFullName}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              submission.contentType === "text"
                                ? "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
                                : "bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200"
                            }
                          >
                            {submission.contentType === "text" ? "Poem" : "Image"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Approved
                          </Badge>
                        </TableCell>
                        <TableCell>{submission.voteCount}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleView(submission.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Submission View Dialog */}
      <Dialog open={viewSubmissionDialogOpen} onOpenChange={setViewSubmissionDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Submission Details</DialogTitle>
            <DialogDescription>
              Review the submission content
            </DialogDescription>
          </DialogHeader>

          {isViewLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : viewedSubmission ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">{viewedSubmission.title}</h3>
                <p className="text-sm text-muted-foreground">By {viewedSubmission.userFullName}</p>
              </div>

              {viewedSubmission.contentType === "text" ? (
                <div className="bg-muted/30 p-4 rounded-lg whitespace-pre-wrap">
                  {viewedSubmission.content}
                </div>
              ) : (
                <div className="flex justify-center">
                  <img
                    src={viewedSubmission.content}
                    alt={viewedSubmission.title}
                    className="max-h-[400px] object-contain rounded-lg"
                  />
                </div>
              )}

              {viewedSubmission.description && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Description</h4>
                  <p className="text-sm">{viewedSubmission.description}</p>
                </div>
              )}
            </div>
          ) : (
            <p>Submission not found</p>
          )}

          <DialogFooter className="gap-2">
            {viewedSubmission && !viewedSubmission.validated && (
              <>
                <Button
                  variant="outline"
                  className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                  onClick={() => {
                    handleReject(viewedSubmission.id);
                    setViewSubmissionDialogOpen(false);
                  }}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    handleApprove(viewedSubmission.id);
                    setViewSubmissionDialogOpen(false);
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setViewSubmissionDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SubmissionValidationTable;