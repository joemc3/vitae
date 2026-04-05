import { useState } from 'react';
import {
  useResumesPolling,
  useGenerateGeneralResume,
  useGenerateTargetedResume,
  useDeleteResume,
} from '@/hooks/use-resumes';
import { useJobPostings } from '@/hooks/use-job-postings';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileText,
  Plus,
  Trash2,
  Download,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { downloadResume } from '@/services/api';
import type { ResumeResponse } from '@/types/resume';

const THEMES = [
  { value: 'plain', label: 'Plain (B&W)' },
  { value: 'onyx', label: 'Onyx' },
  { value: 'coral', label: 'Coral' },
  { value: 'serene', label: 'Serene' },
  { value: 'jade', label: 'Jade' },
  { value: 'quartz', label: 'Quartz' },
];

const PAGE_OPTIONS = [1, 2, 3, 4];

function statusBadge(status: string) {
  switch (status) {
    case 'ready':
      return <Badge>Ready</Badge>;
    case 'queued':
      return <Badge variant="secondary">Queued</Badge>;
    case 'tailoring':
      return (
        <Badge variant="secondary">
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          Tailoring
        </Badge>
      );
    case 'rendering':
      return (
        <Badge variant="secondary">
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          Rendering
        </Badge>
      );
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ResumesPage() {
  const { data: resumes, isLoading, error } = useResumesPolling();
  const { data: jobPostings } = useJobPostings();
  const genGeneral = useGenerateGeneralResume();
  const genTargeted = useGenerateTargetedResume();
  const deleteMut = useDeleteResume();

  const [showGeneralDialog, setShowGeneralDialog] = useState(false);
  const [showTargetedDialog, setShowTargetedDialog] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState('plain');
  const [selectedPages, setSelectedPages] = useState('2');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ResumeResponse | null>(null);
  const [genError, setGenError] = useState('');

  const handleGenerateGeneral = async () => {
    setGenError('');
    try {
      await genGeneral.mutateAsync({
        theme: selectedTheme,
        page_target: parseInt(selectedPages, 10),
      });
      setShowGeneralDialog(false);
    } catch (err) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '';
      setGenError(detail || 'Generation failed');
    }
  };

  const handleGenerateTargeted = async () => {
    setGenError('');
    try {
      await genTargeted.mutateAsync({
        job_posting_id: selectedJobId,
        theme: selectedTheme,
        page_target: parseInt(selectedPages, 10),
      });
      setShowTargetedDialog(false);
    } catch (err) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || '';
      setGenError(detail || 'Generation failed');
    }
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteMut.mutate(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Resumes</h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setGenError('');
                setSelectedPages('2');
                setShowGeneralDialog(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              General Resume
            </Button>
            <Button
              onClick={() => {
                setGenError('');
                setSelectedPages('1');
                setShowTargetedDialog(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Targeted Resume
            </Button>
          </div>
        </div>

        {genError && (
          <Alert variant="destructive">
            <AlertDescription>{genError}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>Failed to load resumes.</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {resumes && resumes.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center py-12 text-center">
              <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
              <h3 className="mb-1 text-lg font-medium">No resumes generated yet</h3>
              <p className="mb-2 text-sm text-muted-foreground">
                Generate a <strong>general resume</strong> from your full profile, or a{' '}
                <strong>targeted resume</strong> tailored to a specific job posting.
              </p>
            </CardContent>
          </Card>
        )}

        {resumes && resumes.length > 0 && (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Theme</TableHead>
                  <TableHead>Pages</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumes.map((resume) => (
                  <TableRow key={resume.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={resume.type === 'general' ? 'default' : 'secondary'}>
                          {resume.type}
                        </Badge>
                        {resume.stale && (
                          <Tooltip>
                            <TooltipTrigger>
                              <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                              Profile updated since generation. Consider regenerating.
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {resume.job_posting_title && (
                          <span className="text-sm text-muted-foreground">
                            {resume.job_posting_title}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{resume.theme}</TableCell>
                    <TableCell>
                      {resume.actual_pages ?? resume.page_target}
                      {resume.actual_pages && resume.actual_pages !== resume.page_target && (
                        <span className="text-muted-foreground text-xs ml-1">
                          (target: {resume.page_target})
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{statusBadge(resume.status)}</TableCell>
                    <TableCell>{formatDate(resume.generated_at)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {resume.status === 'ready' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => downloadResume(resume.id)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Download PDF</TooltipContent>
                          </Tooltip>
                        )}
                        {resume.status === 'failed' && resume.error_message && (
                          <Tooltip>
                            <TooltipTrigger>
                              <AlertTriangle className="h-4 w-4 text-destructive" />
                            </TooltipTrigger>
                            <TooltipContent>{resume.error_message}</TooltipContent>
                          </Tooltip>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(resume)}
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

        {/* General Resume Dialog */}
        <Dialog open={showGeneralDialog} onOpenChange={setShowGeneralDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate General Resume</DialogTitle>
              <DialogDescription>
                Create a resume from your full synthesized profile.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Theme</label>
                <Select value={selectedTheme} onValueChange={setSelectedTheme}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THEMES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Pages</label>
                <Select value={selectedPages} onValueChange={setSelectedPages}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} page{n > 1 ? 's' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowGeneralDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleGenerateGeneral} disabled={genGeneral.isPending}>
                {genGeneral.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Targeted Resume Dialog */}
        <Dialog open={showTargetedDialog} onOpenChange={setShowTargetedDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Targeted Resume</DialogTitle>
              <DialogDescription>
                Create a resume tailored to a specific job posting.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Job Posting</label>
                <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a job posting" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobPostings?.map((jp) => (
                      <SelectItem key={jp.id} value={jp.id}>
                        {jp.title} — {jp.company}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(!jobPostings || jobPostings.length === 0) && (
                  <p className="text-sm text-muted-foreground">
                    No job postings yet. Add one in Job Postings first.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Theme</label>
                <Select value={selectedTheme} onValueChange={setSelectedTheme}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THEMES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Pages</label>
                <Select value={selectedPages} onValueChange={setSelectedPages}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} page{n > 1 ? 's' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTargetedDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleGenerateTargeted}
                disabled={!selectedJobId || genTargeted.isPending}
              >
                {genTargeted.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete resume?</DialogTitle>
              <DialogDescription>
                This will permanently remove the resume and its PDF file.
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
    </TooltipProvider>
  );
}
