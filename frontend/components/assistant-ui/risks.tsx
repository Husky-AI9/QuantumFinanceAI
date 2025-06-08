import React, { useState } from 'react';
import { Button } from '@/components/ui/button'; // Adjust path as needed
import {
  Card,
  CardContent,
  CardTitle,
} from '@/components/ui/card'; // Adjust path as needed
import { Input } from '@/components/ui/input'; // Adjust path as needed
import { ReloadIcon } from '@radix-ui/react-icons';

// Interface for a single parsed risk factor
interface ParsedRiskFactor {
  headline: string;
  summary: string;
}

// Interface for the component's results state
interface RiskAssessmentResult {
  entity: string; // The stock/company name analyzed
  risks: ParsedRiskFactor[];
}

// This function remains the same as it's responsible for parsing the string from the backend
const parseRiskAssessmentResponse = (responseText: string): ParsedRiskFactor[] => {
  if (!responseText.trim()) {
    return [];
  }
  // Split by one or more newlines forming a blank line (e.g., \n\n or \n \n)
  const riskBlocks = responseText.trim().split(/\n\s*\n/);
  const parsedRisks: ParsedRiskFactor[] = [];

  for (const block of riskBlocks) {
    const lines = block.trim().split('\n');
    if (lines.length >= 2) {
      const headline = lines[0].trim();
      const summary = lines.slice(1).join(' ').trim(); // Join remaining lines for summary
      if (headline && summary) {
        parsedRisks.push({ headline, summary });
      }
    }
  }
  return parsedRisks;
};

export function RiskIdentifier() {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState<RiskAssessmentResult | null>(null);

  // System and user prompts are now handled by the FastAPI backend, so they are removed from here.

  async function fetchBackendRiskAssessment(
    stockName: string
  ): Promise<ParsedRiskFactor[]> {

    try {
      const mlflowPort = process.env.NEXT_PUBLIC_MLFLOW_PORT; 
      const API_URL = `https://localhost:${mlflowPort}/invocations`;
      const mlflowRequestBody = {
        inputs: {
          action: "risk",
          stock_name: stockName
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
        const errorData = await response.json().catch(() => ({ detail: `Backend API request failed for ${stockName}` }));
        console.error(`Backend Risk API request failed for ${stockName} with status ${response.status}:`, errorData);
        throw new Error(`Risk API request failed for ${stockName}: ${response.statusText} - ${errorData.detail || JSON.stringify(errorData)}`);
      }

      const data = await response.json(); // Expects {"result": "string_with_risks"}
      const rawRiskText = data.predictions[0][0]      
      return parseRiskAssessmentResponse(rawRiskText);

    } catch (error) {
      console.error(`Error calling Backend Risk API for ${stockName}:`, error);
      if (error instanceof Error) {
        // Re-throw the original error or a new one with more context
        throw new Error(`Fetching risk assessment for ${stockName} from backend failed: ${error.message}`);
      }
      throw new Error(`An unknown error occurred while fetching risk assessment for ${stockName} from backend.`);
    }
  }

  const handleIdentifyRisks = async () => {
    if (!inputValue.trim()) return;

    setIsLoading(true);
    setAssessmentResult(null); // Clear previous results
    const stock_name = inputValue.trim().toUpperCase(); // Standardize to uppercase

    try {
      // Call the new function that fetches from your FastAPI backend
      const risks = await fetchBackendRiskAssessment(stock_name);
      
      if (risks.length === 0) {
        // Handle case where API returns successfully but with no specific risks identified
        setAssessmentResult({
            entity: stock_name,
            risks: [] // Explicitly set to empty array for "No risks identified" message
        });
      } else {
        setAssessmentResult({ entity: stock_name, risks });
      }

    } catch (error) {
      console.error(`Failed to fetch and parse risk assessment for ${stock_name}:`, error);
      setAssessmentResult({
        entity: stock_name,
        risks: [{
            headline: "Error Fetching Risks",
            summary: error instanceof Error ? error.message : "An unexpected error occurred."
        }]
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="space-y-4">
      <CardTitle>Risk Assessment</CardTitle>
        <div className="space-y-1.5">
          <Input
            id="entity-input-risk"
            placeholder={isLoading ? 'Identifying Risks...' : 'Enter stock ticker (e.g., AAPL)'}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isLoading}
            onKeyPress={(e) => { if (e.key === 'Enter') handleIdentifyRisks(); }}
          />
        </div>

        <Button
          onClick={handleIdentifyRisks}
          disabled={isLoading || !inputValue.trim()}
          className="w-full"
        >
          {isLoading ? (
            <>
              <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
              Identifying Risks...
            </>
          ) : (
            'Identify Risks'
          )}
        </Button>

        {!isLoading && assessmentResult && (
          <div className="border-t pt-4 mt-4 space-y-3">
             <div className="pb-2">
                 <h3 className="text-lg font-semibold">Risk Factors for: {assessmentResult.entity}</h3>
                 {assessmentResult.risks.length > 0 && assessmentResult.risks[0].headline !== "Error Fetching Risks" && (
                    <p className="text-sm text-muted-foreground">Key potential risks identified:</p>
                 )}
                  {assessmentResult.risks.length === 0 && (
                    <p className="text-sm text-center text-muted-foreground pt-2">No specific risk factors were identified for &quot;{assessmentResult.entity}&quot; by the analysis.</p>
                  )}
             </div>
            {assessmentResult.risks.length > 0 ? (
                assessmentResult.risks.map((risk, index) => (
                  risk.headline === "Error Fetching Risks" ? (
                    <div key={index} className="pt-2 pb-2 text-red-600">
                        <h4 className="font-semibold text-md">{risk.headline}</h4>
                        <p className="text-sm whitespace-pre-wrap">{risk.summary}</p>
                    </div>
                  ) : (
                    <div key={index} className="pt-2 pb-2">
                        <h4 className="font-semibold text-md">{risk.headline}</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {risk.summary}
                        </p>
                    </div>
                  )
                ))
            ) : null } {/* Message for no risks is handled above */}
          </div>
        )}
        {!isLoading && !assessmentResult && inputValue.trim() === '' && (
             <div className="text-center text-sm text-muted-foreground pt-2 border-t mt-2">
                 Enter an entity above and click &quot;Identify Risks&quot;.
             </div>
         )}
      </CardContent>
    </Card>
  );
}

export default RiskIdentifier;