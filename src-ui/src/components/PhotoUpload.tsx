import { useCallback, useRef, useState } from 'react';
import { useUploadPhoto, useDeletePhoto } from '@/hooks/use-profile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Trash2, Loader2, User } from 'lucide-react';

interface PhotoUploadProps {
  photoPath: string | null;
}

export function PhotoUpload({ photoPath }: PhotoUploadProps) {
  const uploadMut = useUploadPhoto();
  const deleteMut = useDeletePhoto();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  const photoUrl = photoPath
    ? `${import.meta.env.VITE_API_URL || ''}/api/profile/photo/file`
    : null;

  const handleFile = useCallback(
    (file: File) => {
      setError('');
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setError('Please use a JPEG, PNG, or WebP image.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be under 5 MB.');
        return;
      }
      uploadMut.mutate(file);
    },
    [uploadMut]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Profile Photo</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-6">
          <div
            className={`relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 ${
              dragOver ? 'border-primary bg-primary/5' : 'border-muted'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="Profile photo"
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="h-12 w-12 text-muted-foreground" />
            )}
          </div>

          <div className="space-y-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = '';
              }}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={uploadMut.isPending}
              >
                {uploadMut.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Upload Photo
              </Button>
              {photoPath && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteMut.mutate()}
                  disabled={deleteMut.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              JPEG, PNG, or WebP. Max 5 MB. Drag and drop or click to upload.
            </p>
            {error && (
              <Alert variant="destructive" className="py-2">
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
