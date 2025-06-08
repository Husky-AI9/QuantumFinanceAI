import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, Lightbulb } from 'lucide-react';
import { marked } from 'marked'; // Import the marked library

// Note: You'll need to install marked: npm install marked
// And optionally its types: npm install @types/marked --save-dev

const timeframes = [
  { value: 'intraday', label: 'Intraday' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export function StrategyGenerator() {
  const [tickerInput, setTickerInput] = useState<string>('');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('intraday');
  // strategyData will now hold the raw Markdown string from the API
  const [strategyData, setStrategyData] = useState<string | null>(null); 
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetchStrategy = async () => {
    if (!tickerInput.trim()) {
      setError('Please enter a stock ticker.');
      return;
    }
    if (!selectedTimeframe) {
      setError('Please select a timeframe.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setStrategyData(null);

    try {


      const mlflowPort = process.env.NEXT_PUBLIC_MLFLOW_PORT; 
      const API_URL = `https://localhost:${mlflowPort}/invocations`;
      const mlflowRequestBody = {
        inputs: {
          action: "strategy",
          stock_name:tickerInput, 
          timeframe: selectedTimeframe
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


      let data = await response.json();
      data = data.predictions[0][0]
      if (!response.ok) {
        const errorMsg =  `API Error: ${response.status}`;
        throw new Error(errorMsg);
      }
      
      // If response is OK, expect data.predictions[0][0] to be the markdown string
      if (data && typeof data === 'string') {
        setStrategyData(data);
      }
      else { 
        // Response is OK, but data.predictions[0][0] is not a string or the expected error structure
        console.warn("Unexpected API response structure. Expected data.predictions[0][0] to be a markdown string.", data);
        setError("Received an unexpected response format (expected markdown string).");
        setStrategyData(null);
      }

    } catch (err) {
      console.error('Error fetching strategy:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred.');
      }
      setStrategyData(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Trading Strategy Generator</CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Enter a stock ticker and select a timeframe to generate a potential trading strategy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="ticker-input" className="font-semibold">Stock Ticker</Label>
              <Input
                id="ticker-input"
                placeholder="e.g., AAPL, MSFT"
                value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value)}
                className="text-base"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timeframe-select" className="font-semibold">Timeframe</Label>
              <Select
                value={selectedTimeframe}
                onValueChange={setSelectedTimeframe}
                disabled={isLoading}
              >
                <SelectTrigger id="timeframe-select" className="text-base">
                  <SelectValue placeholder="Select timeframe" />
                </SelectTrigger>
                <SelectContent>
                  {timeframes.map((tf) => (
                    <SelectItem key={tf.value} value={tf.value} className="text-base">
                      {tf.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={handleFetchStrategy}
            disabled={isLoading || !tickerInput.trim()}
            className="w-full text-lg py-3 mt-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Generating Strategy...
              </>
            ) : (
              'Generate Strategy'
            )}
          </Button>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {isLoading && !strategyData && (
        <div className="text-center mt-8">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground mt-2">Fetching strategy details...</p>
        </div>
      )}

      {strategyData && !error && (
        <Card className="mt-8 shadow-xl">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-xl flex items-center">
              {/* Using tickerInput and selectedTimeframe from state for the title */}
              Strategy for: {tickerInput.toUpperCase() || 'N/A'} (Timeframe: {selectedTimeframe || 'N/A'})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-2">Generated Strategy:</h3>
            {/* Render the HTML from Markdown. 
                Consider adding Tailwind Typography plugin classes like "prose dark:prose-invert max-w-none" 
                to the div below for better default styling of the generated HTML.
            */}
            <div 
              className="markdown-content bg-gray-50 dark:bg-gray-800 p-4 rounded-md"
              dangerouslySetInnerHTML={{ __html: marked(strategyData) }} 
            />
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground p-4 bg-muted/30">
            Disclaimer: This information is for educational purposes only and not financial advice.
          </CardFooter>
        </Card>
      )}
       {!isLoading && !strategyData && !error && (
            <div className="text-center mt-8 p-6 border rounded-lg bg-gray-50 dark:bg-gray-800/30">
                <Lightbulb className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                    Enter a stock ticker and select a timeframe, then click &quot;Generate Strategy&quot; to see results.
                </p>
            </div>
        )}
    </div>
  );
}

export default StrategyGenerator;
