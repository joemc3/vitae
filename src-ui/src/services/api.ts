/**
 * API client for web application
 * Replaces Tauri invoke calls with HTTP requests to backend API
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { PortfolioData, ProcessingTier } from '../types/portfolio';

// Get API URL from environment variables
const API_BASE_URL =
  (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ||
  'http://localhost:3001';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable cookies for session management
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ============================================================================
// Authentication API
// ============================================================================

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
  };
}

/**
 * Register a new user
 */
export async function register(
  email: string,
  password: string
): Promise<AuthResponse> {
  try {
    const response = await apiClient.post<AuthResponse>('/api/auth/register', {
      email,
      password,
    });
    // Store token
    localStorage.setItem('authToken', response.data.token);
    return response.data;
  } catch (error) {
    throw new Error(
      `Registration failed: ${
        error instanceof AxiosError
          ? error.response?.data?.message || error.message
          : 'Unknown error'
      }`
    );
  }
}

/**
 * Login user
 */
export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  try {
    const response = await apiClient.post<AuthResponse>('/api/auth/login', {
      email,
      password,
    });
    // Store token
    localStorage.setItem('authToken', response.data.token);
    return response.data;
  } catch (error) {
    throw new Error(
      `Login failed: ${
        error instanceof AxiosError
          ? error.response?.data?.message || error.message
          : 'Unknown error'
      }`
    );
  }
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  try {
    await apiClient.post('/api/auth/logout');
  } finally {
    // Always clear token, even if API call fails
    localStorage.removeItem('authToken');
  }
}

/**
 * Get current user
 */
export async function getCurrentUser(): Promise<{
  id: string;
  email: string;
} | null> {
  try {
    const response = await apiClient.get('/api/auth/me');
    return response.data;
  } catch (error) {
    return null;
  }
}

// ============================================================================
// File Ingestion API
// ============================================================================

/**
 * Ingest files - upload files to server
 */
export async function ingestFiles(files: File[]): Promise<void> {
  try {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    await apiClient.post('/api/files/ingest', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  } catch (error) {
    throw new Error(
      `Failed to ingest files: ${
        error instanceof AxiosError
          ? error.response?.data?.message || error.message
          : 'Unknown error'
      }`
    );
  }
}

/**
 * Get aggregated text from all ingested files
 */
export async function getAggregatedText(): Promise<string> {
  try {
    const response = await apiClient.get<{ text: string }>(
      '/api/files/aggregated-text'
    );
    return response.data.text;
  } catch (error) {
    throw new Error(
      `Failed to get aggregated text: ${
        error instanceof AxiosError
          ? error.response?.data?.message || error.message
          : 'Unknown error'
      }`
    );
  }
}

// ============================================================================
// AI Processing API
// ============================================================================

/**
 * Get JSON portfolio data from AI based on the selected tier
 */
export async function getJsonFromAI(
  tier: ProcessingTier,
  aggregatedText?: string,
  provider?: string
): Promise<PortfolioData> {
  try {
    const response = await apiClient.post<PortfolioData>('/api/ai/process', {
      tier,
      aggregatedText,
      provider,
    });
    return response.data;
  } catch (error) {
    throw new Error(
      `Failed to get JSON from AI: ${
        error instanceof AxiosError
          ? error.response?.data?.message || error.message
          : 'Unknown error'
      }`
    );
  }
}

// ============================================================================
// Website Generation API
// ============================================================================

/**
 * Generate the website with the provided portfolio data and theme
 */
export async function generateWebsite(
  portfolioData: PortfolioData,
  themeName: string
): Promise<{ downloadUrl: string }> {
  try {
    const response = await apiClient.post<{ downloadUrl: string }>(
      '/api/website/generate',
      {
        portfolioData,
        theme: themeName,
      }
    );
    return response.data;
  } catch (error) {
    throw new Error(
      `Failed to generate website: ${
        error instanceof AxiosError
          ? error.response?.data?.message || error.message
          : 'Unknown error'
      }`
    );
  }
}

// ============================================================================
// API Key Management API
// ============================================================================

/**
 * Save an API key for a specific provider
 */
export async function saveApiKey(
  provider: string,
  apiKey: string
): Promise<void> {
  try {
    await apiClient.post('/api/settings/api-key', {
      provider,
      apiKey,
    });
  } catch (error) {
    throw new Error(
      `Failed to save API key: ${
        error instanceof AxiosError
          ? error.response?.data?.message || error.message
          : 'Unknown error'
      }`
    );
  }
}

/**
 * Get an API key for a specific provider
 */
export async function getApiKey(provider: string): Promise<string | null> {
  try {
    const response = await apiClient.get<{ apiKey: string | null }>(
      `/api/settings/api-key/${provider}`
    );
    return response.data.apiKey;
  } catch (error) {
    console.error(`Failed to get API key for ${provider}:`, error);
    return null;
  }
}

/**
 * Delete an API key for a specific provider
 */
export async function deleteApiKey(provider: string): Promise<void> {
  try {
    await apiClient.delete(`/api/settings/api-key/${provider}`);
  } catch (error) {
    throw new Error(
      `Failed to delete API key: ${
        error instanceof AxiosError
          ? error.response?.data?.message || error.message
          : 'Unknown error'
      }`
    );
  }
}

/**
 * Test the connection to an AI provider
 */
export async function testApiConnection(
  provider: string,
  apiKey?: string
): Promise<boolean> {
  try {
    const response = await apiClient.post<{ success: boolean }>(
      '/api/settings/test-connection',
      {
        provider,
        apiKey,
      }
    );
    return response.data.success;
  } catch (error) {
    console.error(`API connection test failed: ${error}`);
    return false;
  }
}

/**
 * Save the local AI endpoint URL
 */
export async function saveLocalEndpoint(endpoint: string): Promise<void> {
  try {
    await apiClient.post('/api/settings/local-endpoint', {
      endpoint,
    });
  } catch (error) {
    throw new Error(
      `Failed to save local endpoint: ${
        error instanceof AxiosError
          ? error.response?.data?.message || error.message
          : 'Unknown error'
      }`
    );
  }
}

/**
 * Get the local AI endpoint URL
 */
export async function getLocalEndpoint(): Promise<string | null> {
  try {
    const response = await apiClient.get<{ endpoint: string | null }>(
      '/api/settings/local-endpoint'
    );
    return response.data.endpoint;
  } catch (error) {
    console.error('Failed to get local endpoint:', error);
    return null;
  }
}

// ============================================================================
// Theme API
// ============================================================================

/**
 * Get the list of available themes
 */
export async function getAvailableThemes(): Promise<
  Array<{ name: string; displayName: string; thumbnailPath: string }>
> {
  try {
    const response = await apiClient.get<
      Array<{ name: string; displayName: string; thumbnailPath: string }>
    >('/api/themes');
    return response.data;
  } catch (error) {
    console.error('Failed to get available themes:', error);
    // Return default themes if backend call fails
    return [
      {
        name: 'onyx',
        displayName: 'Onyx',
        thumbnailPath: '/themes/onyx/thumbnail.png',
      },
      {
        name: 'quartz',
        displayName: 'Quartz',
        thumbnailPath: '/themes/quartz/thumbnail.png',
      },
      {
        name: 'serene',
        displayName: 'Serene',
        thumbnailPath: '/themes/serene/thumbnail.png',
      },
      {
        name: 'jade',
        displayName: 'Jade',
        thumbnailPath: '/themes/jade/thumbnail.png',
      },
      {
        name: 'coral',
        displayName: 'Coral',
        thumbnailPath: '/themes/coral/thumbnail.png',
      },
    ];
  }
}

export default apiClient;
