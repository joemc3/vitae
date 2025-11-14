import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import './App.css';
import FileIngestion from './components/FileIngestion';
import Settings from './components/Settings';
import MainEditor from './components/MainEditor';
import ThemeSelection from './components/ThemeSelection';
import GenerationSuccess from './components/GenerationSuccess';
import Login from './components/Login';
import Register from './components/Register';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PortfolioData, ProcessingTier } from './types/portfolio';

function AppContent() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);

  // Application state
  const [selectedTier, setSelectedTier] = useState<ProcessingTier>('manual');
  const [ingestedFiles, setIngestedFiles] = useState<File[]>([]);
  const [downloadUrl, setDownloadUrl] = useState<string>('');
  const [portfolioData, setPortfolioData] = useState<PortfolioData>({
    profile: {
      fullName: '',
      title: '',
      summary: '',
    },
    contact: {
      email: '',
      phone: '',
      website: '',
      socialLinks: [],
    },
    workExperience: [],
    projects: [],
    education: [],
    skills: [],
    theme: {
      name: 'onyx',
    },
  });

  // Auto-hide toast after 5 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info'
  ) => {
    setToast({ message, type });
  };

  const showLoading = (message: string) => {
    setLoadingMessage(message);
    setLoading(true);
  };

  const hideLoading = () => {
    setLoading(false);
    setLoadingMessage('');
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      showToast('Error logging out', 'error');
    }
  };

  return (
    <div className="app-container">
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Routes */}
        <Route
          path="/app/*"
          element={
            <ProtectedRoute>
              <div className="flex flex-col h-screen">
                {/* Header */}
                <header className="app-header">
                  <h1 className="app-title">Professional Website Builder</h1>
                  <div className="flex items-center gap-4">
                    <button
                      className="settings-icon"
                      onClick={() => setShowSettings(true)}
                      aria-label="Settings"
                    >
                      ⚙️
                    </button>
                    <button
                      onClick={handleLogout}
                      className="btn-secondary text-sm"
                    >
                      Logout
                    </button>
                  </div>
                </header>

                {/* Main Content */}
                <main className="app-content">
                  <Routes>
                    <Route
                      path="/"
                      element={
                        <FileIngestion
                          selectedTier={selectedTier}
                          onTierChange={setSelectedTier}
                          ingestedFiles={ingestedFiles}
                          onFilesIngested={setIngestedFiles}
                          onNext={() => navigate('/app/editor')}
                          showLoading={showLoading}
                          hideLoading={hideLoading}
                          showToast={showToast}
                          portfolioData={portfolioData}
                          setPortfolioData={setPortfolioData}
                        />
                      }
                    />
                    <Route
                      path="/editor"
                      element={
                        <MainEditor
                          portfolioData={portfolioData}
                          onUpdate={setPortfolioData}
                          onNext={() => navigate('/app/themes')}
                          onBack={() => navigate('/app')}
                        />
                      }
                    />
                    <Route
                      path="/themes"
                      element={
                        <ThemeSelection
                          portfolioData={portfolioData}
                          onThemeSelect={(themeName) =>
                            setPortfolioData({
                              ...portfolioData,
                              theme: { name: themeName },
                            })
                          }
                          onGenerate={(url) => {
                            setDownloadUrl(url);
                            navigate('/app/success');
                          }}
                          onBack={() => navigate('/app/editor')}
                          showLoading={showLoading}
                          hideLoading={hideLoading}
                          showToast={showToast}
                        />
                      }
                    />
                    <Route
                      path="/success"
                      element={
                        <GenerationSuccess
                          onBackToEditor={() => navigate('/app/editor')}
                          showToast={showToast}
                          downloadUrl={downloadUrl}
                        />
                      }
                    />
                  </Routes>
                </main>

                {/* Settings Modal */}
                {showSettings && (
                  <Settings
                    onClose={() => setShowSettings(false)}
                    showToast={showToast}
                  />
                )}

                {/* Loading Overlay */}
                {loading && (
                  <div className="loading-overlay">
                    <div className="loading-content">
                      <div className="spinner"></div>
                      <p className="text-gray-700 font-medium">
                        {loadingMessage}
                      </p>
                    </div>
                  </div>
                )}

                {/* Toast Notification */}
                {toast && (
                  <div className={`toast ${toast.type}`}>
                    <p>{toast.message}</p>
                  </div>
                )}
              </div>
            </ProtectedRoute>
          }
        />

        {/* Default Redirect */}
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
