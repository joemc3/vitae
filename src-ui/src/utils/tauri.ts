/**
 * API command wrappers
 * Provides type-safe functions to call backend API
 * (Replaces Tauri invoke calls with HTTP API calls)
 */

import {
  ingestFiles as apiIngestFiles,
  getAggregatedText as apiGetAggregatedText,
  getJsonFromAI as apiGetJsonFromAI,
  generateWebsite as apiGenerateWebsite,
  saveApiKey as apiSaveApiKey,
  getApiKey as apiGetApiKey,
  deleteApiKey as apiDeleteApiKey,
  testApiConnection as apiTestApiConnection,
  saveLocalEndpoint as apiSaveLocalEndpoint,
  getLocalEndpoint as apiGetLocalEndpoint,
  getAvailableThemes as apiGetAvailableThemes,
} from '../services/api';
import { PortfolioData, ProcessingTier } from '../types/portfolio';

/**
 * Ingest files from File objects
 */
export async function ingestFiles(files: File[]): Promise<void> {
  try {
    await apiIngestFiles(files);
  } catch (error) {
    throw new Error(`Failed to ingest files: ${error}`);
  }
}

/**
 * Get aggregated text from all ingested files
 */
export async function getAggregatedText(): Promise<string> {
  try {
    const text = await apiGetAggregatedText();
    return text;
  } catch (error) {
    throw new Error(`Failed to get aggregated text: ${error}`);
  }
}

/**
 * Get JSON portfolio data from AI based on the selected tier
 */
export async function getJsonFromAI(
  tier: ProcessingTier,
  aggregatedText: string,
  provider?: string
): Promise<PortfolioData> {
  try {
    const data = await apiGetJsonFromAI(tier, aggregatedText, provider);
    return data;
  } catch (error) {
    throw new Error(`Failed to get JSON from AI: ${error}`);
  }
}

/**
 * Generate the website with the provided portfolio data and theme
 */
export async function generateWebsite(
  portfolioData: PortfolioData,
  themeName: string
): Promise<string> {
  try {
    const result = await apiGenerateWebsite(portfolioData, themeName);
    return result.downloadUrl;
  } catch (error) {
    throw new Error(`Failed to generate website: ${error}`);
  }
}

/**
 * Save an API key for a specific provider
 */
export async function saveApiKey(
  provider: string,
  apiKey: string
): Promise<void> {
  try {
    await apiSaveApiKey(provider, apiKey);
  } catch (error) {
    throw new Error(`Failed to save API key: ${error}`);
  }
}

/**
 * Get an API key for a specific provider
 */
export async function getApiKey(provider: string): Promise<string | null> {
  try {
    const key = await apiGetApiKey(provider);
    return key;
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
    await apiDeleteApiKey(provider);
  } catch (error) {
    throw new Error(`Failed to delete API key: ${error}`);
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
    const result = await apiTestApiConnection(provider, apiKey);
    return result;
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
    await apiSaveLocalEndpoint(endpoint);
  } catch (error) {
    throw new Error(`Failed to save local endpoint: ${error}`);
  }
}

/**
 * Get the local AI endpoint URL
 */
export async function getLocalEndpoint(): Promise<string | null> {
  try {
    const endpoint = await apiGetLocalEndpoint();
    return endpoint;
  } catch (error) {
    console.error('Failed to get local endpoint:', error);
    return null;
  }
}

/**
 * Get the list of available themes
 */
export async function getAvailableThemes(): Promise<
  Array<{ name: string; displayName: string; thumbnailPath: string }>
> {
  try {
    const themes = await apiGetAvailableThemes();
    return themes;
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
