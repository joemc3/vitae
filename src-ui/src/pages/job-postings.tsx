import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useJobPostings, useDeleteJobPosting } from '@/hooks/use-job-postings';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, Pencil, Briefcase } from 'lucide-react';
import type { JobPostingResponse } from '@/types/api';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function JobPostingsPage() {
  const { data: postings, isLoading, error } = useJobPostings();
  const deleteMut = useDeleteJobPosting();
  const [deleteTarget, setDeleteTarget] = useState<JobPostingResponse | null>(null);

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteMut.mutate(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Job Postings</h2>
        <Button asChild>
          <Link to="/app/job-postings/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Job Posting
          </Link>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>Failed to load job postings.</AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {postings && postings.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Briefcase className="mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="mb-1 text-lg font-medium">No job postings yet</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Add job postings to generate targeted sites tailored to specific positions.
              Paste a URL, paste the job text, or enter details manually.
            </p>
            <Button asChild>
              <Link to="/app/job-postings/new">
                <Plus className="mr-2 h-4 w-4" />
                Add your first job posting
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {postings && postings.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {postings.map((posting) => (
                <TableRow key={posting.id}>
                  <TableCell className="font-medium">{posting.title}</TableCell>
                  <TableCell>{posting.company}</TableCell>
                  <TableCell>{formatDate(posting.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/app/job-postings/${posting.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(posting)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete job posting?</DialogTitle>
            <DialogDescription>
              This will permanently delete &quot;{deleteTarget?.title}&quot; at{' '}
              {deleteTarget?.company}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
