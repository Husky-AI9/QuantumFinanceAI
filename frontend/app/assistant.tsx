"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { FinancialToolkit } from "@/components/assistant-ui/feature-list";
import { Button } from "@/components/ui/button";
import React from "react";
import {StockResearch} from "@/components/assistant-ui/research";
import { NarrativeMomentumHeatmap } from  "@/components/assistant-ui/dashboard";

import { StrategyGenerator } from  "@/components/assistant-ui/strategy";

const researchOptions = ["Stock Momentum", "Stock Research","Stock Strategy"] as const;
type ResearchOption = typeof researchOptions[number];
export const Assistant = () => {
  const [selectedOption, setSelectedOption] = React.useState<ResearchOption>("Stock Momentum"); // Default selection
  console.log(researchOptions)
  const runtime = useChatRuntime({
    api: "/api/chat",
  });

  

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {/* Three-column grid with clear vertical dividers */}
      <div className="grid h-dvh grid-cols-[1fr_4fr] divide-x-2 divide-gray-300 px-4 py-4">

         <div className="px-2">
          <FinancialToolkit />
        </div>
        <div className="flex flex-col overflow-hidden px-2"> 
          <div className="flex-grow overflow-y-auto"> 
          {selectedOption === "Stock Momentum" && <NarrativeMomentumHeatmap />}
          {selectedOption === "Stock Research" && <StockResearch />}
          {selectedOption === "Stock Strategy" && <StrategyGenerator />}

          </div>
          <div className="flex w-1/3 space-x-1 py-4 mx-auto"> 
        
          <Button
            className="w-1/3" // Apply width or other layout styles
            variant={selectedOption === "Stock Momentum" ? "default" : "outline"} // Apply 'default' variant if selected, 'outline' otherwise
            onClick={() => setSelectedOption("Stock Momentum")} // Set state on click
          >
            Stock Momentum
          </Button>

          <Button
            className="w-1/3" // Apply width or other layout styles
            variant={selectedOption === "Stock Research" ? "default" : "outline"} // Apply 'default' variant if selected, 'outline' otherwise
            onClick={() => setSelectedOption("Stock Research")} // Set state on click
          >
            Stock Research
          </Button>

          
          <Button
            className="w-1/3" // Apply width or other layout styles
            variant={selectedOption === "Stock Strategy" ? "default" : "outline"} // Apply 'default' variant if selected, 'outline' otherwise
            onClick={() => setSelectedOption("Stock Strategy")} // Set state on click
          >
            Stock Strategy
          </Button>
          </div>
        </div>

        
       
      </div>
    </AssistantRuntimeProvider>
  );
};
