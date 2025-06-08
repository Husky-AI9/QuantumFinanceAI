import React, { useState, FormEvent, memo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button"; // Adjust path if needed
import { Input } from "@/components/ui/input"; // Adjust path if needed
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Adjust path if needed
import { ReloadIcon } from "@radix-ui/react-icons";
import {
  TrendingUp,
  TrendingDown,
  Smile,
  Frown,
  Meh,
  AlertTriangle,
  CheckCircle2,
  Briefcase,
  LineChart,
  MessageSquare,
  BarChart3,
  DollarSign,
  Info,
  LucideIcon,
} from "lucide-react";

//======================================================================
// 1. TYPESCRIPT INTERFACES
//======================================================================

export interface NarrativeThemeItem {
  id: string;
  title: string;
  description: string;
  icon?: LucideIcon; // Icon for the theme
}

export interface SentimentData {
  overall:
    | "Predominantly Positive"
    | "Predominantly Negative"
    | "Neutral"
    | "Mixed"
    | string; // Allow string for flexibility
  icon?: LucideIcon; // Overall sentiment icon
  positiveFactors: string[];
  cautionaryFactors: string[];
}

export interface DiscussionMetric {
  id: string;
  label: string;
  value: string;
  icon?: LucideIcon;
}

export interface DiscussionProminenceData {
  summary: string;
  metrics: DiscussionMetric[];
}

export interface FinancialContextData {
  recentPrices: Array<{ date: string; close: string }>;
  forecasts?: {
    optimistic: string;
    pessimistic: string;
  };
  otherMetrics: Array<{ label: string; value: string }>;
}

export interface ParsedStockReport {
  companyName: string;
  ticker: string;
  reportDate: string; // e.g., "May 13, 2025"
  narrativeSummary: string; // Overall summary for the "Narrative Analysis Report" section
  executiveSummaryThemes: NarrativeThemeItem[];
  sentimentSnapshot: SentimentData;
  discussionProminence: DiscussionProminenceData;
  keyFinancialContext: FinancialContextData;
}

// Component State
export interface ResearchState {
  isLoading: boolean;
  error: string | null;
  reportData: ParsedStockReport | null; // Will hold the parsed structured data
}

// API Raw Response Structure (Optional)
interface RawSonarApiResponse {
  summary: string;
  sources?: string[];
}

interface TradingViewWidgetProps {
  symbol: string;
  height?: string | number;
  width?: string | number;
}

const MemoizedTradingViewWidget: React.FC<TradingViewWidgetProps> = memo(
  ({ symbol, height = "100%", width = "100%" }) => {
    const container = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!symbol || !container.current) {
        // If no symbol or container isn't rendered yet, do nothing or clear
        if (container.current) container.current.innerHTML = "";
        return;
      }

      // Clear previous widget before appending a new one
      container.current.innerHTML = "";

      const script = document.createElement("script");
      script.src =
        "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js";
      script.type = "text/javascript";
      script.async = true;
      script.innerHTML = JSON.stringify({
        symbols: [
          [
            symbol, // Use the ticker for the description part
            `${symbol.toUpperCase()}|1D`, // Dynamically set the symbol, ensure it's uppercase
          ],
        ],
        chartOnly: false,
        width: width,
        height: height,
        locale: "en",
        colorTheme: "light",
        autosize: true,
        showVolume: false,
        showMA: false,
        hideDateRanges: false,
        hideMarketStatus: false,
        hideSymbolLogo: false,
        scalePosition: "right",
        scaleMode: "Normal",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, Trebuchet MS, Roboto, Ubuntu, sans-serif",
        fontSize: "10",
        noTimeScale: false,
        valuesTracking: "1",
        changeMode: "price-and-percent",
        chartType: "area",
        maLineColor: "#2962FF",
        maLineWidth: 1,
        maLength: 9,
        headerFontSize: "medium",
        lineWidth: 2,
        lineType: 0,
        dateRanges: ["1d|1", "1m|30", "3m|60", "12m|1D", "60m|1W", "all|1M"],
      });

      container.current.appendChild(script);

      // No explicit cleanup function for removing the script needed here
      // because container.current.innerHTML = '' handles clearing the old widget.
      // The script itself manages its lifecycle within the container.
    }, [symbol, width, height]); // Re-run effect if symbol, width, or height changes

    // The outer div needs a specific height for "100%" height of the widget to work.
    // This will be controlled by the parent component (e.g., CardContent).
    return (
      <div
        className="tradingview-widget-container"
        ref={container}
        style={{ height: "100%", width: "100%" }}
      >
        {/* The script will populate this div or its children */}
        <div
          className="tradingview-widget-container__widget"
          style={{ height: "100%", width: "100%" }}
        ></div>
      </div>
    );
  }
);

MemoizedTradingViewWidget.displayName = "TradingViewWidget";

const TradingViewChartSection: React.FC<{ ticker: string }> = ({ ticker }) => (
  <Card className="mb-6 shadow-sm">
    <CardHeader>
      <CardTitle className="text-xl text-gray-700">
        {ticker.toUpperCase()} Interactive Chart
      </CardTitle>
    </CardHeader>
    <CardContent style={{ height: "500px" }}>
      {" "}
      {/* Set a specific height for the chart container */}
      <MemoizedTradingViewWidget symbol={ticker} />
    </CardContent>
  </Card>
);

function parseMarkdownToStructuredReport(
  markdown: string,
  ticker: string
): ParsedStockReport | null {
  if (!markdown || markdown.length < 100) {
    // Basic check if markdown is too short
    console.error("Markdown input is null or too short for parsing.");
    return null;
  }

  try {
    // --- Basic Information ---
    const companyNameMatch = markdown.match(
      /^([A-Za-z\s.&,'-]+?)\s+\(([A-Z.]+)\)/
    );
    const companyName = companyNameMatch
      ? companyNameMatch[1].trim()
      : ticker.toUpperCase();
    const guessedTicker = companyNameMatch
      ? companyNameMatch[2]
      : ticker.toUpperCase();
    const reportDate = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    // --- Narrative Summary ---
    const narrativeSummaryMatch = markdown.match(
      /## Description\s*([\s\S]*?)\s*## Narrative Themes/
    );
    const narrativeSummary = narrativeSummaryMatch
      ? narrativeSummaryMatch[1].trim().split("\n\n")[0]
      : "Could not parse narrative summary."; // Take first paragraph after description

    // --- Narrative Themes ---
    const themes: NarrativeThemeItem[] = [];
    const themeSectionMatch = markdown.match(
      /## Narrative Themes\s*([\s\S]*?)\s*## Sentiment Analysis/
    );
    if (themeSectionMatch) {
      const themeRegex = /\*\*(.*?)\*\*\s*([\s\S]*?)(?=\n\n\*\*|\n$)/g;
      let themeMatch;
      let themeId = 0;
      while ((themeMatch = themeRegex.exec(themeSectionMatch[1])) !== null) {
        themeId++;
        let icon: LucideIcon | undefined = Briefcase; // Default icon
        const titleLower = themeMatch[1].toLowerCase();
        if (titleLower.includes("financial performance")) icon = BarChart3;
        else if (
          titleLower.includes("shareholder") ||
          titleLower.includes("return")
        )
          icon = DollarSign;
        else if (
          titleLower.includes("growth") ||
          titleLower.includes("outlook") ||
          titleLower.includes("innovation")
        )
          icon = TrendingUp;

        themes.push({
          id: `theme-${themeId}`,
          title: themeMatch[1].trim(),
          description: themeMatch[2].trim().split("\n\n")[0], // Take first paragraph
          icon: icon,
        });
      }
    }
    // Fallback if parsing failed
    if (themes.length === 0) {
      themes.push(
        {
          id: "theme-1",
          title: "Financial Performance",
          description: "Parsed data unavailable.",
          icon: BarChart3,
        },
        {
          id: "theme-2",
          title: "Shareholder Returns",
          description: "Parsed data unavailable.",
          icon: DollarSign,
        },
        {
          id: "theme-3",
          title: "Growth Outlook",
          description: "Parsed data unavailable.",
          icon: TrendingUp,
        }
      );
    }

    // --- Sentiment Analysis ---
    const sentimentSectionMatch = markdown.match(
      /## Sentiment Analysis\s*([\s\S]*?)\s*## Discussion Prominence/
    );
    let overallSentimentText: SentimentData["overall"] = "Mixed"; // Default
    let sentimentIcon: LucideIcon | undefined = Meh; // Default
    let positiveFactors: string[] = ["Parsed data unavailable."];
    let cautionaryFactors: string[] = ["Parsed data unavailable."];

    if (sentimentSectionMatch) {
      const overallSentimentStr = sentimentSectionMatch[1]
        .split("\n\n")[0]
        .toLowerCase(); // First paragraph describes overall
      if (overallSentimentStr.includes("predominantly positive")) {
        overallSentimentText = "Predominantly Positive";
        sentimentIcon = Smile;
      } else if (overallSentimentStr.includes("predominantly negative")) {
        overallSentimentText = "Predominantly Negative";
        sentimentIcon = Frown;
      } else if (overallSentimentStr.includes("neutral")) {
        overallSentimentText = "Neutral";
        sentimentIcon = Meh;
      } else if (
        overallSentimentStr.includes("mixed") ||
        overallSentimentStr.includes("positive") ||
        overallSentimentStr.includes("caution")
      ) {
        overallSentimentText = "Mixed / Cautiously Optimistic"; // More specific default
        sentimentIcon = Meh;
      }

      const positiveFactorsMatch = sentimentSectionMatch[1].match(
        /\*\*Positive Sentiment Factors:\*\*\s*([\s\S]*?)(?=\n\n\*\*Cautionary|\n\nOverall|\n$)/
      );
      if (positiveFactorsMatch) {
        positiveFactors = positiveFactorsMatch[1]
          .split("\n- ")
          .map((s) => s.trim().replace(/\[.*?\]/g, ""))
          .filter((s) => s && s.length > 5);
        if (positiveFactors.length === 0)
          positiveFactors = ["No specific positive factors parsed."];
      }

      const cautionaryFactorsMatch = sentimentSectionMatch[1].match(
        /\*\*Cautionary Sentiment Elements:\*\*[ \t]*([\s\S]*?)(?=\n## Discussion Prominence|$)/
      );
      console.log("-----------------------------------");
      console.log(sentimentSectionMatch[1]);
      console.log(cautionaryFactorsMatch);
      if (cautionaryFactorsMatch) {
        cautionaryFactors = cautionaryFactorsMatch[1]
          .split("\n- ")
          .map((s) => s.trim().replace(/\[.*?\]/g, ""))
          .filter((s) => s && s.length > 5);
        if (cautionaryFactors.length === 0)
          cautionaryFactors = ["No specific cautionary factors parsed."];
      }
    }

    // --- Discussion Prominence ---
    const discussionSectionMatch = markdown.match(
      /## Discussion Prominence\s*([\s\S]*?)\s*(?:## Financial Data|$)/
    );
    let discussionSummary = "Could not parse discussion summary.";
    const discussionMetrics: DiscussionMetric[] = [
      { id: "dm-1", label: "Annual Revenue", value: "N/A", icon: Briefcase },
      { id: "dm-2", label: "Market Cap", value: "N/A", icon: LineChart },
      { id: "dm-3", label: "Sentiment", value: "N/A", icon: MessageSquare },
    ];

    if (discussionSectionMatch) {
      const discussionContent = discussionSectionMatch[1];
      discussionSummary = discussionContent.split("\n\n")[0].trim();

      const etfHoldingMatch = discussionContent.match(
        /\* \d+\.\s*Annual Revenue:\s*(.*?)(?:\n|$)/i
      );
      if (etfHoldingMatch && etfHoldingMatch[1]) {
        discussionMetrics[0].value = etfHoldingMatch[1].trim();
      }

      // 'etfWeightMatch' will now parse "Market Cap"
      // This regex aims to get the value before the parenthesis, like "~$1.07 trillion"
      const etfWeightMatch = discussionContent.match(
        /\* \d+\.\s*Market Cap:\s*(?:Calculated at )?(.*?)(?:\s*\(|\n|$)/i
      );
      if (etfWeightMatch && etfWeightMatch[1]) {
        discussionMetrics[1].value = etfWeightMatch[1].trim();
      }

      // 'socialMatch' will now parse "Sentiment"
      const socialMatch = discussionContent.match(
        /\* \d+\.\s*Sentiment:\s*(.*?)(?:\n|$)/i
      );
      if (socialMatch && socialMatch[1]) {
        discussionMetrics[2].value = socialMatch[1].trim();
      }
    }

    // --- Financial Data ---
    const financialSectionMatch = markdown.match(
      /## Financial Data\s*([\s\S]*?)(?=\n*$)/
    );
    let recentPrices: FinancialContextData["recentPrices"] = [
      { date: "N/A", close: "N/A" },
    ];
    let optimisticForecast: string | undefined = undefined;
    let pessimisticForecast: string | undefined = undefined;
    let otherMetrics: FinancialContextData["otherMetrics"] = [
      { label: "Data", value: "N/A" },
    ];

    if (financialSectionMatch) {
      const pricesMatch = financialSectionMatch[1].match(
        /\*\*Stock Price Data.*?:\*\*\s*([\s\S]*?)(?=\n\n\*\*|\n$)/
      );
      if (pricesMatch) {
        const priceRegex =
          /-\s*(.*? \d{1,2}, \d{4}):\s*\$?([0-9,]+\.[0-9]{2})/g;
        let priceItemMatch;
        const parsedPrices = [];
        while ((priceItemMatch = priceRegex.exec(pricesMatch[1])) !== null) {
          parsedPrices.push({
            date: priceItemMatch[1],
            close: priceItemMatch[2],
          });
        }
        if (parsedPrices.length > 0) recentPrices = parsedPrices.slice(0, 4); // Limit to 4
      }

      const optimisticForecastMatch = financialSectionMatch[1].match(
        /Optimistic forecast:.*?\$([0-9,]+)(?:.*?\$([0-9,]+))?/
      );
      optimisticForecast = optimisticForecastMatch
        ? `$${optimisticForecastMatch[1]}${
            optimisticForecastMatch[2]
              ? ` - $${optimisticForecastMatch[2]}`
              : ""
          }`
        : "N/A";
      const pessimisticForecastMatch = financialSectionMatch[1].match(
        /Pessimistic forecast:.*?\$([0-9,]+)(?:.*?\$([0-9,]+))?/
      );
      pessimisticForecast = pessimisticForecastMatch
        ? `$${pessimisticForecastMatch[1]}${
            pessimisticForecastMatch[2]
              ? ` - $${pessimisticForecastMatch[2]}`
              : ""
          }`
        : "N/A";

      otherMetrics = [];
      const revenueMatch = financialSectionMatch[1].match(
        /Quarterly Revenue.*?\$([0-9.]+) billion/
      );
      if (revenueMatch)
        otherMetrics.push({
          label: "Qtrly Revenue (Approx)",
          value: `$${revenueMatch[1]}B`,
        });
      const dividendMatch = financialSectionMatch[1].match(
        /Quarterly dividend:.*?\$([0-9.]+)/
      );
      if (dividendMatch)
        otherMetrics.push({
          label: "Quarterly Dividend",
          value: `$${dividendMatch[1]}/share`,
        });
      const buybackMatch = financialSectionMatch[1].match(
        /Share buyback program: \$([0-9]+) billion/
      );
      if (buybackMatch)
        otherMetrics.push({
          label: "Share Buyback",
          value: `$${buybackMatch[1]}B`,
        });
      const marginMatch = financialSectionMatch[1].match(
        /projected gross margin.*? (\d{1,2}\.\d+%) and (\d{1,2}\.\d+%)/
      );
      if (marginMatch)
        otherMetrics.push({
          label: "Proj. Gross Margin",
          value: `${marginMatch[1]} - ${marginMatch[2]}`,
        });

      if (otherMetrics.length === 0)
        otherMetrics = [{ label: "Other Metrics", value: "N/A" }];
    }

    // --- Construct Final Object ---
    return {
      companyName: companyName,
      ticker: guessedTicker,
      reportDate: reportDate,
      narrativeSummary: narrativeSummary,
      executiveSummaryThemes: themes,
      sentimentSnapshot: {
        overall: overallSentimentText,
        icon: sentimentIcon,
        positiveFactors: positiveFactors,
        cautionaryFactors: cautionaryFactors,
      },
      discussionProminence: {
        summary: discussionSummary,
        metrics: discussionMetrics,
      },
      keyFinancialContext: {
        recentPrices: recentPrices,
        forecasts: {
          optimistic: optimisticForecast || "N/A",
          pessimistic: pessimisticForecast || "N/A",
        },
        otherMetrics: otherMetrics,
      },
    };
  } catch (error) {
    console.error("Error parsing markdown report:", error);
    return null; // Return null or a default error structure if parsing fails catastrophically
  }
}

//======================================================================
// 3. UI DISPLAY SUB-COMPONENTS
//======================================================================

// --- Helper: Sentiment Icon ---
const SentimentIconDisplay: React.FC<{
  sentiment: SentimentData["overall"];
  icon?: LucideIcon;
}> = ({ sentiment, icon }) => {
  const sentimentLower = sentiment.toLowerCase();
  let IconToShow = icon;
  let colorClass = "text-yellow-500"; // Default (Mixed/Neutral)

  if (!IconToShow) {
    if (sentimentLower.includes("positive")) {
      IconToShow = Smile;
      colorClass = "text-green-500";
    } else if (sentimentLower.includes("negative")) {
      IconToShow = Frown;
      colorClass = "text-red-500";
    } else {
      IconToShow = Meh;
    }
  } else {
    if (sentimentLower.includes("positive")) {
      colorClass = "text-green-500";
    } else if (sentimentLower.includes("negative")) {
      colorClass = "text-red-500";
    }
  }

  return IconToShow ? (
    <IconToShow className={`h-16 w-16 mb-2 ${colorClass}`} />
  ) : null;
};

// --- Individual Section Components ---
const ReportHeader: React.FC<{
  companyName: string;
  ticker: string;
  reportDate: string;
}> = ({ companyName, ticker, reportDate }) => (
  <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
    <div>
      <h1 className="text-3xl font-bold text-gray-800">
        {companyName} ({ticker})
      </h1>
      <p className="text-sm text-gray-500">{reportDate}</p>
    </div>
  </div>
);

const NarrativeAnalysisSection: React.FC<{
  title: string;
  summary: string;
}> = ({ title, summary }) => (
  <Card className="mb-6 shadow-sm">
    <CardHeader>
      <CardTitle className="text-xl text-gray-700">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-gray-600 leading-relaxed">{summary}</p>
    </CardContent>
  </Card>
);

const ExecutiveSummaryItem: React.FC<{ item: NarrativeThemeItem }> = ({
  item,
}) => (
  <Card className="flex-1 min-w-[260px] shadow-sm hover:shadow-md transition-shadow">
    <CardHeader className="flex flex-row items-center space-x-3 pb-2">
      {item.icon ? (
        <item.icon className="h-6 w-6 text-blue-600 flex-shrink-0" />
      ) : (
        <Briefcase className="h-6 w-6 text-blue-600 flex-shrink-0" />
      )}
      <CardTitle className="text-base font-semibold">{item.title}</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-gray-600">{item.description}</p>
    </CardContent>
  </Card>
);

const ExecutiveSummarySection: React.FC<{ themes: NarrativeThemeItem[] }> = ({
  themes,
}) => (
  <Card className="mb-6 shadow-sm ">
    <CardHeader>
      <h2 className="text-xl font-semibold text-gray-700 mb-4">
        Executive Summary
      </h2>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
        {themes.map((theme) => (
          <ExecutiveSummaryItem key={theme.id} item={theme} />
        ))}
      </div>
    </CardContent>
  </Card>
);

const SentimentSnapshotSection: React.FC<{ sentiment: SentimentData }> = ({
  sentiment,
}) => (
<Card className="flex flex-grow mb-6 shadow-sm">
    <CardHeader>
      <CardTitle className="text-xl text-gray-700">
        Sentiment Snapshot
      </CardTitle>
    </CardHeader>
    <CardContent className="grid md:grid-cols-3 gap-6 items-start">
      <div className="flex flex-col items-center justify-center text-center md:col-span-1 p-4 border-r-0 md:border-r md:border-b-0 border-b border-gray-200 pb-4 md:pb-0">
        <SentimentIconDisplay
          sentiment={sentiment.overall}
          icon={sentiment.icon}
        />
        <p className="font-semibold text-lg capitalize">{sentiment.overall}</p>
      </div>
      <div className="md:col-span-1 pl-2">
        <h3 className="font-semibold text-md mb-2 flex items-center text-green-700">
          <CheckCircle2 className="h-5 w-5 mr-2 text-green-500 flex-shrink-0" />{" "}
          Positive Factors
        </h3>
        <ul className="list-none text-sm text-gray-600 space-y-1">
          {sentiment.positiveFactors.map((factor, i) => (
            <li key={`pos-${i}`} className="flex items-start">
              <span className="mr-2 text-green-500 mt-1">•</span>
              <span>{factor}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="md:col-span-1 pl-2">
        <h3 className="font-semibold text-md mb-2 flex items-center text-yellow-700">
          <AlertTriangle className="h-5 w-5 mr-2 text-yellow-500 flex-shrink-0" />{" "}
          Cautionary Elements
        </h3>
        <ul className="list-none text-sm text-gray-600 space-y-1">
          {sentiment.cautionaryFactors.map((factor, i) => (
            <li key={`caut-${i}`} className="flex items-start">
              <span className="mr-2 text-yellow-500 mt-1">•</span>
              <span>{factor}</span>
            </li>
          ))}
        </ul>
      </div>
    </CardContent>
  </Card>
);

const DiscussionProminenceSection: React.FC<{
  prominence: DiscussionProminenceData;
}> = ({ prominence }) => (
<Card className="flex flex-grow mb-6 shadow-sm">
    <CardHeader>
      <CardTitle className="text-xl text-gray-700">
        Discussion Prominence
      </CardTitle>
    </CardHeader>
    <CardContent className="h-full">
       <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">{prominence.summary}</p>
            
            {prominence.metrics && prominence.metrics.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-200">
                    <ul className="space-y-1.5">
                        {prominence.metrics.map((metric) => {
                            const IconComponent = metric.icon; // Assign to a capitalized variable for JSX
                            return (
                                <li key={metric.id} className="flex justify-between items-center text-sm">
                                    <span className="text-gray-700 flex items-center">
                                        {IconComponent && <IconComponent className="mr-2 h-4 w-4 text-gray-400" />}
                                        {metric.label}:
                                    </span>
                                    <span className="font-medium text-gray-900">{metric.value}</span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </CardContent>
    </CardContent>
  </Card>
);

const KeyFinancialContextSection: React.FC<{
  financials: FinancialContextData;
}> = ({ financials }) => (
  <Card className="shadow-sm">
    <CardHeader>
      <CardTitle className="text-xl text-gray-700">
        Key Financial Context
      </CardTitle>
    </CardHeader>
    <CardContent className="grid md:grid-cols-2 gap-x-6 gap-y-4">
      {/* Recent Prices Column */}
      <div>
        <h3 className="font-semibold text-md mb-2 border-b pb-1">
          Recent Stock Prices
        </h3>
        <ul className="space-y-1 text-sm">
          {financials.recentPrices.map((price, i) => (
            <li
              key={`price-${i}`}
              className="flex justify-between items-center py-0.5"
            >
              <span className="text-gray-600">{price.date}:</span>
              <span className="font-medium text-gray-800">${price.close}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Forecasts & Metrics Column */}
      <div>
        {financials.forecasts &&
          (financials.forecasts.optimistic !== "N/A" ||
            financials.forecasts.pessimistic !== "N/A") && (
            <div className="mb-4">
              <h3 className="font-semibold text-md mb-2 border-b pb-1">
                Analyst Forecasts
              </h3>
              {financials.forecasts.optimistic !== "N/A" && (
                <div className="flex items-center text-sm mb-1">
                  <TrendingUp className="h-4 w-4 mr-2 text-green-500 flex-shrink-0" />
                  <span className="text-gray-600 mr-1">Optimistic:</span>
                  <span className="font-medium text-green-700">
                    {financials.forecasts.optimistic}
                  </span>
                </div>
              )}
              {financials.forecasts.pessimistic !== "N/A" && (
                <div className="flex items-center text-sm">
                  <TrendingDown className="h-4 w-4 mr-2 text-red-500 flex-shrink-0" />
                  <span className="text-gray-600 mr-1">Pessimistic:</span>
                  <span className="font-medium text-red-700">
                    {financials.forecasts.pessimistic}
                  </span>
                </div>
              )}
            </div>
          )}

        {financials.otherMetrics &&
          financials.otherMetrics.length > 0 &&
          financials.otherMetrics[0]?.value !== "N/A" && (
            <div className="mt-3">
              <h3 className="font-semibold text-md mb-2 border-b pb-1">
                Other Key Metrics
              </h3>
              <ul className="space-y-1 text-sm">
                {financials.otherMetrics.map((metric, i) => (
                  <li
                    key={`metric-${i}`}
                    className="flex justify-between items-center py-0.5"
                  >
                    <span className="text-gray-600">{metric.label}:</span>
                    <span className="font-medium text-gray-800">
                      {metric.value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
      </div>
    </CardContent>
  </Card>
);

// --- Main Display Component Wrapper ---
const StockReportDisplay: React.FC<{ data: ParsedStockReport }> = ({
  data,
}) => {
  return (
    <div className="max-w-full ">
      {" "}
      {/* Wider max width */}
      <ReportHeader
        companyName={data.companyName}
        ticker={data.ticker}
        reportDate={data.reportDate}
      />
      {/* Existing two-column layout for other report sections */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 mb-6 xl:items-stretch">
        {/* Main Narrative & Executive Summary (Left Side - Wider) */}
        <div className="xl:col-span-3 space-y-6">
          <NarrativeAnalysisSection
            title="Narrative Analysis Report"
            summary={data.narrativeSummary}
          />
          <ExecutiveSummarySection themes={data.executiveSummaryThemes} />
          <KeyFinancialContextSection financials={data.keyFinancialContext} />
        </div>

        {/* Sentiment & Discussion (Right Side - Narrower) */}
        <div className="xl:col-span-2 space-y-6">
          <SentimentSnapshotSection sentiment={data.sentimentSnapshot} />
          <DiscussionProminenceSection prominence={data.discussionProminence} />
        </div>
      </div>{" "}
      {/* === End of the two-column grid === */}
      {/* === TradingView Chart Section - Placed AFTER and OUTSIDE the two-column grid === */}
      {data.ticker && (
        <div className="mb-6">
          {" "}
          {/* Optional: Add margin bottom for spacing */}
          <TradingViewChartSection ticker={data.ticker} />
        </div>
      )}
    </div>
  );
};

//======================================================================
// 4. MAIN STOCK RESEARCH COMPONENT
//======================================================================

export function StockResearch() {
  const [input1Value, setInput1Value] = useState(""); // Default for testing
  const [input2Value, setInput2Value] = useState(""); // Default for testing
  const [researchState, setResearchState] = useState<ResearchState>({
    isLoading: false,
    error: null,
    reportData: null,
  });

  // --- API Fetching Function ---
  async function fetchAPI(
    companyName: string // Ticker is used here
  ): Promise<RawSonarApiResponse> {
  
    try{
      const mlflowPort = process.env.NEXT_PUBLIC_MLFLOW_PORT; 
      const API_URL = `https://localhost:${mlflowPort}/invocations`;
      const mlflowRequestBody = {
        inputs: {
          action: "research",
          company_name : companyName,
          lookback: input2Value
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
        console.error(
          `API Error (${response.status}): ${errorText}`
        );
        throw new Error(
          `API Error (${response.status}): ${errorText || response.statusText}`
        );
      }
      const data = await response.json();
      console.log("Received response from API.");
      console.log(data.predictions[0][0])
      return { summary: data.predictions[0][0], sources: [] };
    } catch (error) {
      console.error(`Error calling API for ${companyName}:`, error);
      if (error instanceof Error)
        return { summary: `Failed to fetch data: ${error.message}` };
      return {
        summary: `An unknown error occurred while fetching data for ${companyName}.`,
      };
    }
  }

  const parseText = (inputText: string) => {
    if (typeof inputText !== "string") {
      return ""; // Or handle the error as you see fit
    }
    // Regular expression to find [n] where n is 1-9 or 10
    const regex = /\[([1-9]|10)\]/g;
    return inputText.replace(regex, "");
  };

  // --- Synthesis and Parsing Handler ---
  const handleSynthesize = async () => {
    const ticker = input1Value.trim().toUpperCase();
    if (!ticker) {
      setResearchState({
        isLoading: false,
        error: "Please enter a stock symbol.",
        reportData: null,
      });
      return;
    }
    setResearchState({ isLoading: true, error: null, reportData: null });

    try {
      const apiResponse = await fetchAPI(
        ticker
      );

  
      console.log("Attempting to parse Markdown response...");
      console.log(apiResponse.summary)
      console.log("Attempting to parse Markdown response...");

      const filterText = parseText(apiResponse.summary);
      console.log(filterText);

      const parsedData = parseMarkdownToStructuredReport(filterText, ticker); // Use the parser

      if (parsedData) {
        console.log("Parsing successful.");
        setResearchState({
          isLoading: false,
          error: null,
          reportData: parsedData,
        });
      } else {
        console.error("Parsing failed. Raw summary:", apiResponse.summary); // Log raw summary on parse failure
        // Attempt to show raw markdown if parsing fails completely? Or just error.
        setResearchState({
          isLoading: false,
          error:
            "Failed to parse the report structure from the API response. The format might have changed.",
          reportData: null,
        });
        // Optional: Provide raw summary in error state?
        // setResearchState({ isLoading: false, error: `Failed to parse report structure. Raw data: ${apiResponse.summary}`, reportData: null });
      }
      
    } catch (error) {
      console.error("Error during synthesis/parsing:", error);
      setResearchState({
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred during analysis.",
        reportData: null,
      });
    }
  };

  // --- Form Submission ---
  const onSubmitForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleSynthesize();
  };

  // --- Render Logic ---
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-10 p-4 border-b bg-white/80 backdrop-blur-sm shadow-sm">
        <h2 className="text-xl font-semibold text-gray-800 text-center">
          AI Stock Narrative Analysis
        </h2>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow overflow-y-auto p-4 md:p-6 lg:p-8">
        {/* Loading State */}
        {researchState.isLoading && (
          <div className="flex flex-col items-center justify-center h-full py-20 text-center">
            <ReloadIcon className="h-10 w-10 text-blue-600 animate-spin mb-4" />
            <p className="text-xl text-gray-700 font-semibold">
              Generating Report...
            </p>
            <p className="text-base text-gray-500 mt-1">
              Analyzing latest data for {input1Value.trim().toUpperCase()}...
            </p>
          </div>
        )}
        {/* Error State */}
        {researchState.error && !researchState.isLoading && (
          <Card className="max-w-lg mx-auto mt-10 shadow-lg border-red-200">
            <CardHeader className="text-center">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-3" />
              <CardTitle className="text-red-700">Analysis Failed</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-red-600 mb-5">{researchState.error}</p>
              <Button onClick={handleSynthesize} variant="destructive">
                <ReloadIcon className="mr-2 h-4 w-4" /> Try Again
              </Button>
            </CardContent>
          </Card>
        )}
        {/* Initial State */}
        {!researchState.isLoading &&
          !researchState.error &&
          !researchState.reportData && (
            <div className="text-center py-20 px-4 max-w-xl mx-auto">
              <Info className="h-16 w-16 text-gray-400 mx-auto mb-5" />
              <h3 className="text-2xl font-semibold text-gray-700 mb-3">
                Ready to Analyze Your Stock
              </h3>
              <p className="text-gray-500 text-lg leading-relaxed">
                Enter a stock symbol (e.g., AAPL, MSFT, GOOG) and an optional
                lookback period below, then click &quot;Submit&quot; for an
                AI-powered narrative analysis.
              </p>
            </div>
          )}
        {/* Success State - Display Report */}
        {researchState.reportData &&
          !researchState.isLoading &&
          !researchState.error && (
            <StockReportDisplay data={researchState.reportData} />
          )}
      </main>

      {/* Footer / Input Bar */}
      <footer className="sticky bottom-0 p-3 border-t bg-white/90 backdrop-blur-sm shadow-inner z-10">
        <form
          className="flex flex-wrap items-center justify-center w-full gap-2 max-w-2xl mx-auto"
          onSubmit={onSubmitForm}
        >
          <Input
            type="text"
            placeholder="Stock Symbol (e.g., AAPL)"
            className="flex-grow min-w-[150px]" // Allow shrinking but have min width
            value={input1Value}
            onChange={(e) => setInput1Value(e.target.value)}
            aria-label="Stock symbol input"
            disabled={researchState.isLoading}
            required // Make symbol required
          />
          <Input
            type="text"
            placeholder="30 (e.g., 30 days)"
            className="flex-grow min-w-[150px]" // Allow shrinking
            value={input2Value}
            onChange={(e) => setInput2Value(e.target.value)}
            aria-label="Lookback period input"
            disabled={researchState.isLoading}
          />
          <Button
            type="submit"
            className="px-5 py-2 h-10" // Ensure button height matches input
            disabled={researchState.isLoading || !input1Value.trim()}
          >
            {researchState.isLoading ? (
              <>
                <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />{" "}
                Analyzing...
              </>
            ) : (
              "Submit"
            )}
          </Button>
        </form>
      </footer>
    </div>
  );
}

// If this is the main file for this feature, you might export it as default
// export default StockResearch;
