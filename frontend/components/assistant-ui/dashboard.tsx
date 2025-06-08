/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, FC, useCallback } from 'react';
import { motion } from 'framer-motion';

// --- shadcn/ui Component Imports ---
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
// Dialog components are now imported
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
// Sheet imports are removed
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

// --- 1. Types ---
export interface Narrative {
  id: string;
  title: string;
  category: string;
  summary: string;
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed' | 'emerging';
  volume: number;
  momentumScore: number;
  details: string;
  keyDevelopments?: string[];
}

interface NarrativeMapDataResponse {
  narratives: Narrative[];
}

// --- Component for Port Configuration Message ---
const PortConfigurationMessage: FC = () => (
  <div className="flex flex-col items-center justify-center text-center p-4 h-full absolute inset-0 bg-background">
    <h3 className="text-orange-500 text-xl font-semibold mb-3">
      ⚠️ Action Required: Configure API Port
    </h3>
    <h2 className="text-muted-foreground text-sm max-w-md space-y-2">
      <p>
        The application cannot connect to the QuantumFinance AI API because the MLflow port
        (<code>NEXT_PUBLIC_MLFLOW_PORT</code>) is not correctly set.
      </p>
      <p>
        Please create or update your <code>.env.local</code> file in the project root
        with the correct port number. For example:
      </p>
     
    
      <p className="text-xs mt-1">
        The current value appears to be missing or is set to "PUT_YOUR_PORT_NUMBER_HERE".
      </p>
    </h2>
    <Button variant="outline" size="sm" className="mt-6" onClick={() => window.location.reload()}>
        Reload Application
    </Button>
  </div>
);

const fetchNarrativeHeatmapData = async (): Promise<NarrativeMapDataResponse> => {
  
  const sectors = ["Technology", "Energy", "Financials", "Consumer Discretionary", "Healthcare", "Industrials", "Real Estate", "Cybersecurity"];
  
  try {
    const mlflowPort = process.env.NEXT_PUBLIC_MLFLOW_PORT; 
    const API_URL = `https://localhost:${mlflowPort}/invocations`;
    const mlflowRequestBody = {
      inputs: {
        action: "dashboard"
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
      const errorText = await response.text();
      throw new Error(`API Error (${response.status}): ${errorText || response.statusText}`);
    }

    const data = await response.json();
    console.log(data.predictions[0][0])
    const content = data.predictions[0][0];


    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;
      const parsedData = JSON.parse(jsonString);

      if (parsedData.narratives && Array.isArray(parsedData.narratives)) {
        const isValid = parsedData.narratives.every((narr: any) =>
            typeof narr.id === 'string' &&
            typeof narr.title === 'string' &&
            sectors.includes(narr.category) &&
            typeof narr.summary === 'string' &&
            typeof narr.sentiment === 'string' &&
            typeof narr.volume === 'number' &&
            typeof narr.momentumScore === 'number' &&
            typeof narr.details === 'string' &&
            Array.isArray(narr.keyDevelopments)
        );
        if (isValid && parsedData.narratives.length === sectors.length) {
          console.log("Successfully parsed narratives from API.");
          return { narratives: parsedData.narratives as Narrative[] };
        } else {
          console.warn("Parsed narratives have incorrect structure or missing/extra categories:", parsedData.narratives);
          throw new Error(`Parsed narratives have an incorrect structure or count. Expected ${sectors.length}, got ${parsedData.narratives.length}.`);
        }
      } else {
        throw new Error("Invalid data structure in API response: 'narratives' array missing.");
      }
    } catch (parseError) {
      console.error("API: Failed to parse JSON content. Content received:", content, parseError);
      throw new Error("Failed to parse JSON from API response.");
    }

  } catch (error) {
    console.error("Failed to fetch or process data from Sonar API:", error);
    throw error;
  }
};

const getMomentumColor = (momentumScore: number): string => {
    if (momentumScore > 85) return 'bg-red-600/80 hover:bg-red-500/90';
    if (momentumScore > 70) return 'bg-orange-500/80 hover:bg-orange-400/90';
    if (momentumScore > 50) return 'bg-yellow-500/80 hover:bg-yellow-400/90';
    if (momentumScore > 30) return 'bg-sky-500/80 hover:bg-sky-400/90';
    return 'bg-slate-600/80 hover:bg-slate-500/90';
};


// --- NarrativeHeatmapCell ---
interface NarrativeHeatmapCellProps {
  narrative: Narrative;
  onClick: (narrative: Narrative) => void;
}

const NarrativeHeatmapCell: FC<NarrativeHeatmapCellProps> = ({ narrative, onClick }) => {
  const momentumColor = getMomentumColor(narrative.momentumScore);

  return (
    <motion.div
      title={narrative.title}
      className={`h-28 p-3 flex flex-col justify-between rounded-lg shadow-md cursor-pointer transition-all duration-300 ease-in-out text-white ${momentumColor}`}
      onClick={() => onClick(narrative)}
      whileHover={{ scale: 1.03, shadow: "lg" }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.random() * 0.2 }}
    >
      <div>
        <h4 className="text-lg font-semibold line-clamp-2">
          {narrative.title}
        </h4>
      </div>
      <div className="text-right mt-1">
        <span className="text-lg font-bold opacity-90">{narrative.momentumScore}</span>
        <span className="text-lg opacity-70 ml-0.5">momentum</span>
      </div>
    </motion.div>
  );
};

// --- NarrativeInfoPanel (Using Dialog) ---
interface NarrativeInfoPanelProps {
  narrative: Narrative | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}
const NarrativeInfoPanel: FC<NarrativeInfoPanelProps> = ({ narrative, isOpen, onOpenChange }) => {
  if (!narrative) return null;
  const sentimentTextColor = narrative.sentiment === 'positive' ? 'text-green-500' :
                             narrative.sentiment === 'negative' ? 'text-red-500' :
                             narrative.sentiment === 'mixed' ? 'text-yellow-500' :
                             narrative.sentiment === 'emerging' ? 'text-blue-500' : 'text-gray-500';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-background text-foreground"> {/* Adjust max-width as needed */}
        <DialogHeader className="pt-6 px-6"> {/* Added padding to header */}
          <DialogTitle className="text-2xl font-bold">{narrative.title}</DialogTitle>
          <DialogDescription className="text-sm pt-1"> {/* Added padding top */}
            <span className="font-semibold">Sector:</span> {narrative.category} <br/>
            <span className={`font-semibold ${sentimentTextColor}`}>Sentiment:</span> {narrative.sentiment.charAt(0).toUpperCase() + narrative.sentiment.slice(1)}
            {' | '} <span className="font-semibold">Momentum:</span> {narrative.momentumScore}/100
            {' | '} <span className="font-semibold">Volume:</span> {narrative.volume}/100
          </DialogDescription>
        </DialogHeader>
        {/* ScrollArea for content if it might overflow */}
        <ScrollArea className="max-h-[60vh] px-6 pb-6"> {/* Limit height and add padding */}
            <div className="space-y-6 py-4"> {/* Added py-4 for spacing within scroll area */}
                <div>
                <h4 className="text-lg font-semibold mb-1 text-foreground/90">Summary</h4>
                <p className="text-sm text-muted-foreground">{narrative.summary}</p>
                </div>
                {narrative.keyDevelopments && narrative.keyDevelopments.length > 0 && (
                <div>
                    <h4 className="text-lg font-semibold mb-2 text-foreground/90">Key Developments</h4>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    {narrative.keyDevelopments.map((dev, index) => <li key={index}>{dev}</li>)}
                    </ul>
                </div>
                )}
                <div>
                <h4 className="text-lg font-semibold mb-1 text-foreground/90">Sonar API Insights</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{narrative.details}</p>
                </div>
            </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export const NarrativeMomentumHeatmap: FC = () => {
  const [narratives, setNarratives] = useState<Narrative[]>([]);
  const [selectedNarrative, setSelectedNarrative] = useState<Narrative | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPortConfigured, setIsPortConfigured] = useState(true); // Assume configured, check in useEffect
  const loadData = useCallback(async () => {
  try {
      const data = await fetchNarrativeHeatmapData();
      setNarratives(data.narratives);
      setError(null);
    } catch (err) {
      console.error("Error loading narrative data in component:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      if (errorMessage.startsWith("ConfigurationError:")) {
        setError("Configuration Error: Please check your MLflow port settings.");
        setIsPortConfigured(false);
      } else {
        setError(errorMessage);
      }
      setNarratives([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
  const mlflowPort = process.env.NEXT_PUBLIC_MLFLOW_PORT;
  if (mlflowPort === "PUT_YOUR_PORT_NUMBER_HERE" || !mlflowPort) {
    console.warn("Port Configuration Issue: NEXT_PUBLIC_MLFLOW_PORT is not set correctly.");
    setIsPortConfigured(false);
    setIsLoading(false);
    setError(null);
  } else {
    setIsPortConfigured(true);
    setIsLoading(true);
    setError(null);
    loadData();
  }
}, [loadData]);

  const handleCellClick = (narrative: Narrative) => {
    setSelectedNarrative(narrative);
    setIsPanelOpen(true); // This will trigger the Dialog to open
  };

  const groupedNarratives = narratives.reduce((acc, narrative) => {
    (acc[narrative.category] = acc[narrative.category] || []).push(narrative);
    return acc;
  }, {} as Record<string, Narrative[]>);

  const preferredCategoryOrder = ["Technology", "Healthcare", "Financials", "Energy", "Industrials", "Consumer Discretionary", "Real Estate", "Cybersecurity"];
  const orderedCategories = Object.keys(groupedNarratives).sort((a,b) => {
      const indexA = preferredCategoryOrder.indexOf(a);
      const indexB = preferredCategoryOrder.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
  });

  const HeatmapDisplayArea: FC = () => {
    if (isLoading) {
      return (
        <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {preferredCategoryOrder.slice(0,6).map((_, i) => (
                    <div key={i} className="space-y-2">
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-28 rounded-lg" />
                    </div>
                ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                <p className="text-muted-foreground animate-pulse text-lg">Fetching Live Narratives via Sonar API...</p>
            </div>
        </div>
      );
    }
    if (error) {
        return (
          <div className="flex flex-col items-center justify-center text-center p-4 h-full">
            <p className="text-red-500 text-lg font-semibold mb-2">⚠️ Failed to Load Narratives</p>
            <p className="text-muted-foreground text-sm max-w-sm">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={loadData}>Retry</Button>
          </div>
        );
      }
      if (orderedCategories.length === 0 && !isLoading) {
        return (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-lg">No active narratives to display from Sonar API.</p>
          </div>
        );
      }

    return (
      <ScrollArea className="h-full p-1 sm:p-2 md:p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">
          {orderedCategories.map((category) => (
            <section key={category} aria-labelledby={`category-title-${category.replace(/\s+/g, '-').toLowerCase()}`} className="flex flex-col space-y-3">
              <h3 id={`category-title-${category.replace(/\s+/g, '-').toLowerCase()}`} className="text-xl font-semibold text-foreground/90 px-1">
                {category}
              </h3>
              {groupedNarratives[category]?.map((narrative) => (
                <NarrativeHeatmapCell
                  key={narrative.id}
                  narrative={narrative}
                  onClick={handleCellClick}
                />
              ))}
            </section>
          ))}
        </div>
      </ScrollArea>
    );
  };

  return (
    <Card className="w-full h-full min-h-[600px] md:min-h-[700px]  bg-background flex flex-col">
      <CardHeader className="text-center border-b border-border/20 pb-4 pt-6">
        <CardTitle className="text-2xl sm:text-3xl font-bold tracking-tight">
          Live Narrative Momentum Heatmap 🚀
        </CardTitle>
        <CardDescription className="text-sm sm:text-base text-muted-foreground mt-1">
          Sector narratives powered by QuantumFinance AI. Color intensity indicates momentum.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow relative mt-50">
        {!isPortConfigured ? (
    <PortConfigurationMessage />
      ) : (
        <HeatmapDisplayArea />
      )}
      </CardContent>
      {/* NarrativeInfoPanel is now a Dialog, its visibility is controlled by isPanelOpen */}
      <NarrativeInfoPanel
        narrative={selectedNarrative}
        isOpen={isPanelOpen}
        onOpenChange={setIsPanelOpen} // This prop is used by Dialog to handle open/close
      />
    </Card>
  );
};

export default NarrativeMomentumHeatmap;