/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button'; // Adjust path as needed
import { Card, CardContent, CardTitle } from '@/components/ui/card'; // Adjust path as needed
import { Input } from '@/components/ui/input'; // Adjust path as needed
import { Separator } from '@/components/ui/separator'; // Adjust path as needed
import { Loader2 } from 'lucide-react'; // Example loading icon

// Define the structure for a sentiment driver
interface SentimentDriver {
  id: string;
  text: string;
  source: string;
}

export function SentimentAnalyzer() {
  const [tickerInput, setTickerInput] = useState('');
  const [sentimentDrivers, setSentimentDrivers] = useState<SentimentDriver[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGetSentiment = async () => {
    if (!tickerInput.trim()) {
      setError("Please enter a stock ticker.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSentimentDrivers([]); // Clear previous drivers

    const stock_name = tickerInput.trim().toUpperCase();

    try {
      const mlflowPort = process.env.NEXT_PUBLIC_MLFLOW_PORT; 
      const API_URL = `https://localhost:${mlflowPort}/invocations`;
      const mlflowRequestBody = {
        inputs: {
          action: "sentiment",
          stock_name: stock_name
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
        const errorData = await response.json().catch(() => ({ detail: "Unknown API error from backend" }));
        // FastAPI errors often come in errorData.detail
        throw new Error(`API Error: ${response.status} ${response.statusText}. ${errorData.detail || errorData.message || 'Failed to fetch from backend.'}`);
      }

      const data = await response.json(); // Expects {"result": "string_with_drivers"}

      const rawDriversText = data.predictions[0][0];
    
      const parsedDrivers = rawDriversText
        .split('\n')
        .map((text: string) => text.trim())
        .filter((text: string | any[]) => text.length > 0)
        .slice(0, 3) // Ensure up to 3 drivers
        .map((text: any, index: number) => ({
          id: `${stock_name}-driver-${index + 1}`,
          text: text,
          source: `QuantumFinance API (${stock_name})`, // Updated source
        }));

      if (parsedDrivers.length === 0 && rawDriversText.length > 0) {
        // This case might occur if the backend returns a single string that isn't meant to be split
        // or if the string is valid but doesn't contain newlines.
        setSentimentDrivers([{
            id: `${stock_name}-driver-1`,
            text: rawDriversText,
            source: `QuantumFinance API (${stock_name}) - Check Format`,
        }]);
      } else if (parsedDrivers.length === 0) {
        setError(`No sentiment drivers returned for ${stock_name}. The API might have provided an empty or unparseable response.`);
      } else {
        setSentimentDrivers(parsedDrivers);
      }

    } catch (err) {
      console.error("Error fetching sentiment:", err);
      if (err instanceof Error) {
        setError(`Failed to fetch sentiment: ${err.message}`);
      } else {
        setError("An unknown error occurred while fetching sentiment.");
      }
      setSentimentDrivers([]); // Clear drivers on error
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardContent className="space-y-4">
      <CardTitle>Sentiment Analysis</CardTitle>
        <div className="space-y-4">
          <div className="grid gap-4 items-end">
            <div className="space-y-1.5">
              <div className="flex items-center space-x-2 w-full">
                <Input
                  id="ticker-input"
                  placeholder="Enter stock ticker (e.g., AAPL)"
                  value={tickerInput}
                  onChange={(e) => setTickerInput(e.target.value)}
                  className="flex-grow"
                  disabled={isLoading}
                />
              </div>
            </div>
            <Button
              onClick={handleGetSentiment}
              disabled={!tickerInput.trim() || isLoading}
              className="w-full md:w-auto"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Getting Sentiment...
                </>
              ) : (
                'Get Sentiment'
              )}
            </Button>
          </div>
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Sentiment Drivers</h3>
          {isLoading && sentimentDrivers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center">Loading drivers...</p>
          )}
          {!isLoading && !error && sentimentDrivers.length === 0 && tickerInput && (
             <p className="text-sm text-muted-foreground text-center">
              No sentiment drivers found for the entered ticker, or the API returned an empty response.
            </p>
          )}
           {!isLoading && !error && sentimentDrivers.length === 0 && !tickerInput && (
             <p className="text-sm text-muted-foreground text-center">
              Enter a ticker and click &quot;Get Sentiment&quot; to see drivers.
            </p>
          )}
          {sentimentDrivers.length > 0 && (
            <ul className="space-y-4 list-disc pl-5">
              {sentimentDrivers.map((driver) => (
                <li key={driver.id}>
                  <p className="text-sm">{driver.text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default SentimentAnalyzer;