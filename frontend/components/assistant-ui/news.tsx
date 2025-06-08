import React, { useState } from 'react';
import { Button } from '@/components/ui/button'; // Adjust path as needed
import { Card, CardContent, CardTitle } from '@/components/ui/card'; // Adjust path as needed
import { ReloadIcon } from '@radix-ui/react-icons'; // Or another suitable loading icon
import { Input } from '../ui/input';

// Data structure for results
interface NewsResult {
  ticker: string;
  title: string;
  summary: string;
  sources: string[]; // Expecting sources to be an array of URLs
}

const initialResults: NewsResult[] = [];

export function NewsSynthesizer() {
  const [inputTickers, setInputTickers] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<NewsResult[]>(initialResults);

  async function fetchNewsFromBackend(
    companyName: string
  ): Promise<{ summary: string; sources: string[] }> { // sources will be empty from /news

    try {
      const mlflowPort = process.env.NEXT_PUBLIC_MLFLOW_PORT; 
      const API_URL = `https://localhost:${mlflowPort}/invocations`;
      const mlflowRequestBody = {
        inputs: {
          action: "news",
          company_name: companyName
        },
        params: {} 
      };

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mlflowRequestBody),
      });

      if (!response.ok) {
        // Try to parse FastAPI error response, which often has a 'detail' field
        const errorData = await response.json().catch(() => ({ detail: `Request failed with status: ${response.status} ${response.statusText}` }));
        console.error(`Backend API request failed for ${companyName} with status ${response.status}:`, errorData);
        const errorMessage = errorData.detail || `API request failed for ${companyName}.`;
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // The Python /news endpoint currently does not return sources.
      // We return an empty array for sources to match the NewsResult interface.
      // The UI will gracefully handle an empty sources array.
      return {
        summary: data.predictions[0][0],
        sources: [] 
      };

    } catch (error) {
      console.error(`Error calling Backend API for ${companyName}:`, error);
      if (error instanceof Error) {
        // Append which company failed to the error message for better context if not already there
        const message = error.message.includes(companyName) ? error.message : `Error for ${companyName}: ${error.message}`;
        throw new Error(message);
      }
      throw new Error(`An unknown error occurred while fetching data for ${companyName} from the backend.`);
    }
  }

  const handleSynthesize = async () => {
    setIsLoading(true);
    setResults([]); // Clear previous results

    const companies = inputTickers
      .split(/[\n,]+/) // Split by newlines or commas
      .map(ticker => ticker.trim())
      .filter(ticker => ticker); // Remove empty strings

    const newAggregatedResults: NewsResult[] = [];

    for (const company_name of companies) {
      if (!company_name) continue;

      // The user_prompt is no longer constructed here for the API call,
      // as the backend's /news endpoint only needs the company_name.

      try {
        console.log(`Requesting news synthesis from backend for: ${company_name}`);

        // Call the new function that fetches from your Python backend
        const apiResponse = await fetchNewsFromBackend(company_name);

        newAggregatedResults.push({
          ticker: company_name.toUpperCase(),
          title: `Significant Development for ${company_name}`, // This title is generic
          summary: apiResponse.summary,
          sources: apiResponse.sources, // This will be an empty array
        });

      } catch (error) {
        console.error(`Failed to process news for ${company_name}:`, error);
        newAggregatedResults.push({
          ticker: company_name.toUpperCase(),
          title: `Error Processing News for ${company_name}`,
          summary: error instanceof Error ? error.message : "An unknown error occurred.",
          sources: [], // No sources in case of an error
        });
      }
    }

    setResults(newAggregatedResults);
    setIsLoading(false);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="space-y-2">
      <CardTitle className="mb-4">Personalized News Synthesis</CardTitle>
        <Input
                  id="ticker-input"
                  placeholder="Enter tickers (e.g. GOOG, AAPL)"
                  value={inputTickers}
                  onChange={(e) => setInputTickers(e.target.value)}
                  className="flex-grow"
                  disabled={isLoading}
                />
        <Button
          onClick={handleSynthesize}
          disabled={isLoading || !inputTickers.trim()}
          className="w-full mt-2"
        >
          {isLoading ? (
            <>
              <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
              Synthesizing...
            </>
          ) : (
            'Synthesize News'
          )}
        </Button>

        <div className="space-y-2 pt-2">
          {results.length > 0 ? (
            results.map((result, index) => (
              <Card key={index} className="bg-muted/40">
                <CardContent>
                  <CardTitle className="pb-1">{result.ticker}</CardTitle>
                  <p className="text-sm text-muted-foreground pb-2">{result.title}</p>

                  <p className="text-sm mb-3 whitespace-pre-wrap ">{result.summary}</p>
                  {/* This section will not render if sources array is empty, which is intended here */}
                  {result.sources && result.sources.length > 0 && (
                     <div>
                        <h4 className="text-sm font-medium mb-1">Sources:</h4>
                        <ul className="list-disc pl-5 space-y-1">
                        {result.sources.map((source, idx) => (
                            <li key={idx} className="text-sm">
                            <a
                                href={source}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline break-all"
                            >
                                {/* Ensure source is a string before rendering as URL */}
                                {typeof source === 'string' ? source : JSON.stringify(source)}
                            </a>
                            </li>
                        ))}
                        </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
             !isLoading && <p className="text-sm text-center text-muted-foreground">Enter tickers above and click &quot;Synthesize News&quot; to see results.</p>
          )}
           {isLoading && results.length === 0 && (
             <p className="text-sm text-center text-muted-foreground">Fetching synthesized news...</p>
           )}
        </div>
      </CardContent>
    </Card>
  );
}

export default NewsSynthesizer;