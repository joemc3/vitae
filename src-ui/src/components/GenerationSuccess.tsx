/**
 * Generation Success Component
 * Displays success message and download options after website generation
 */

import { useState, useEffect } from 'react';

interface GenerationSuccessProps {
  onBackToEditor: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
  downloadUrl?: string;
}

export default function GenerationSuccess({
  onBackToEditor,
  showToast,
  downloadUrl,
}: GenerationSuccessProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    // If download URL is provided, construct preview URL
    if (downloadUrl) {
      // Assume preview is at /preview endpoint
      const baseUrl = downloadUrl.replace('/download', '/preview');
      setPreviewUrl(baseUrl);
    }
  }, [downloadUrl]);

  const handleDownload = () => {
    if (downloadUrl) {
      // Open download in new tab
      window.open(downloadUrl, '_blank');
      showToast('Download started!', 'success');
    } else {
      showToast('Download URL not available', 'error');
    }
  };

  const handlePreview = () => {
    if (previewUrl) {
      // Open preview in new tab
      window.open(previewUrl, '_blank');
    } else {
      showToast('Preview not available', 'error');
    }
  };

  const handleCopyDownloadLink = () => {
    if (downloadUrl) {
      navigator.clipboard.writeText(downloadUrl);
      showToast('Download link copied to clipboard!', 'success');
    }
  };

  return (
    <div className="h-full flex items-center justify-center">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-lg shadow-lg p-12 text-center">
          {/* Success Icon */}
          <div className="mb-6">
            <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <svg
                className="w-12 h-12 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>

          {/* Success Message */}
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Success!</h1>
          <p className="text-xl text-gray-600 mb-8">
            Your professional website has been generated successfully.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4 justify-center mb-8">
            <button
              onClick={handleDownload}
              className="btn-primary flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download Website
            </button>

            {previewUrl && (
              <button
                onClick={handlePreview}
                className="btn-primary flex items-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                Preview in Browser
              </button>
            )}

            {downloadUrl && (
              <button
                onClick={handleCopyDownloadLink}
                className="btn-secondary flex items-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                  />
                </svg>
                Copy Download Link
              </button>
            )}
          </div>

          {/* Information Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold text-blue-900 mb-2">
              What's Next?
            </h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Download your website files as a ZIP archive</li>
              <li>Upload the files to any web hosting service</li>
              <li>Share your professional portfolio with the world</li>
            </ul>
          </div>

          {/* Secondary Action */}
          <button onClick={onBackToEditor} className="btn-secondary">
            Back to Editor
          </button>

          {/* Download Link Info */}
          {downloadUrl && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Your website is ready for download. The download link expires in
                24 hours.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
