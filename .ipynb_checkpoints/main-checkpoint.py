import re
import sys
import httpx
import json
import os
import mlflow
import mlflow.pyfunc
import pandas as pd
from fastapi import FastAPI, HTTPException, Body, Depends
from pydantic import BaseModel, Field
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from strategy import TimeBasedStrategyGenerator
import platform # For conda_env python version
import yaml

api_key = yaml.safe_load(open('./secret.yml'))

def load_api_keys_from_file(filepath: str) -> dict:
    """Loads API keys from a specified text file."""
    keys = {"PERPLEXITY_API_KEY": f"{api_key['key']['perplexity']}",
            "ALPHA_ADVANTAGE_KEY":f"{api_key['key']['alphaadvantage']}"}
    return keys

class FinancialSonarAnalyzer:
    def __init__(self, perplexity_api_key: str, alpha_advantage_key: str):
        """
        Initializes the FinancialSonarAnalyzer with API keys.

        Args:
            perplexity_api_key (str): Your Perplexity AI API key.
            alpha_advantage_key (str): Your Alpha Vantage API key.
        """
        if not perplexity_api_key:
            raise ValueError("Perplexity AI API key is required.")
        if not alpha_advantage_key:
            raise ValueError("Alpha Vantage API key is required.")
            
        self.perplexity_api_key = perplexity_api_key
        self.alpha_advantage_key = alpha_advantage_key


    def news(self, company_name: str) -> str:
        if not isinstance(company_name, str) or not company_name.strip():
            return "Invalid company name. Please provide a valid company name."
        system_prompt = (
            "You are an expert financial analyst AI specializing in extremely concise summaries. "
            "Focus *only* on information reported or occurring within the last 30 days. "
            "Identify the *single most significant* development, "
            "event, or status update for the specified company during this period. "
            "Synthesize this key finding into a maximum of **two sentences**. "
            "The summary must be factual, impactful, and directly state or clearly imply the significance "
            "of this single development. Do not include introductory phrases like 'Based on the search results...'. "
            "Strictly adhere to the two-sentence maximum."
            "Make sure user input a valid stock name if it is not return invalid stock name."
            "Make sure not to include any citations or reference in the respond."
        )
        user_prompt = (
            f"Provide the hyper-concise (max 2 sentences) summary of the single most significant. "
            f"development for {company_name} within the last 30 days. Make sure not to include any citations or reference in the respond."
        )
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        return self.get_response(messages)

    def sentiment(self, stock_name: str) -> str:
        if not isinstance(stock_name, str) or not stock_name.strip():
            return "Invalid stock name. Please provide a valid company name."
        system_prompt = (
            "You are an AI assistant specialized in financial market analysis and identifying key sentiment drivers for company stocks. " +
            "Each sentiment driver you provide must be a single, concise sentence reflecting factors that could influence stock performance or investor perception."+
            "Make sure not to include any citations or reference in the respond."
        )
        user_prompt = (
        f"""Analyze the company stock "{stock_name}" and generate up to 3 distinct sentiment drivers.
            Each sentiment driver must be a single, concise sentence with no longer than 15 words that clearly states a specific factor influencing investor sentiment or stock valuation for "{stock_name}".
            These factors could relate to earnings reports, product announcements, market trends, regulatory news, economic indicators, or analyst ratings.
            Do not use any introductory phrases like "Here are the sentiment drivers:".
            Do not use bullet points or numbering.
            Provide each sentiment driver on a new line. This is important for parsing.
            Example sentiment drivers for a company stock:
            Strong quarterly earnings and positive forward guidance are currently boosting investor confidence.
            Concerns over increased competition in the sector are weighing negatively on the stock price.
            Anticipation of a new product launch later this year is generating speculative interest among traders.
            Recent analyst upgrades have provided a positive catalyst for the stock.
            Macroeconomic headwinds, such as rising interest rates, present a potential risk to valuation.
            Make sure this {stock_name} valid stock name if it is not return it not a valid stock name.
            Generate the sentiment drivers now for the stock {stock_name}:"""
            )
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        return self.get_response(messages)

    def risk(self, stock_name: str) -> str:
        if not isinstance(stock_name, str) or not stock_name.strip():
            return "Invalid stock name. Please provide a valid company name."
        system_prompt = (
            "You are an AI assistant specialized in risk analysis and assessment for companies, stocks, and sectors. " +
            "Your task is to identify key potential risks and summarize them concisely. " +
            "For each risk, you will provide a short headline and a brief explanatory sentence."
        )
        user_prompt = (
        f"""Make sure this "{stock_name}" valid stock name if it is not return it not a valid stock name.
                              Please identify and describe up to 3 key risk factors for "{stock_name}".
                              For each identified risk, provide the following in order:
                              1. A concise headline (2 to 4 words) on its own line.
                              2. A single summary sentence (explaining the risk) on the next line.
                              3.Make sure not to include any citations or reference in the respond.

                              Separate each complete risk (headline and summary pair) from the next with a blank line.
                              Do not use any introductory phrases like "Here are the risks:".
                              Do not use bullet points or numbering for the risks themselves.

                              Example format for one risk:
                              Regulatory Scrutiny
                              Increased regulatory oversight could impact operations.

                              Another example for a different risk:
                              Supply Chain Disruptions
                              Issues in the supply chain may affect production and deliveries.

                              Now, generate the risk assessment for "{stock_name}":"""
            )
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        return self.get_response(messages)

    def research(self, stock_name: str, lookback: int) -> str:
        if not isinstance(stock_name, str) or not stock_name.strip():
            return "Invalid stock name. Please provide a valid company name."
        if not isinstance(lookback, int) or lookback <=0:
            return "Invalid lookback period. Please provide a positive integer."

        system_prompt = ("""
            You are an expert financial analyst AI. Your task is to provide a comprehensive narrative analysis report for a given stock ticker based on recent data and discussions. 
            Structure your response clearly using Markdown with specific headings: 
            "## Description", 
            "## Narrative Themes", 
            "## Sentiment Analysis", 
            "## Discussion Prominence", 
            "## Financial Data". 
            Within these sections use sub-headings (like **Theme Title**) and bullet points where appropriate. 
            Focus on clarity and factual reporting based on available online data up to your knowledge cutoff."""
        )
        user_prompt = (
        f"""Generate a detailed narrative analysis report in Markdown for the company with ticker symbol: ${stock_name}. Analyze data and discussions in a period of the last {lookback} days.

            The report MUST include the following sections with these exact headings:
            1.  ## Description 
                (A brief 1-2 sentence overview of the company's current situation based on the analysis).
            2.  ## Narrative Themes
                * Identify 2-3 key recurring narrative themes. For each theme: use a bolded title (\`**Theme Title**\`) followed by a short paragraph explanation.
            3.  ## Sentiment Analysis
                * Start with a sentence describing the overall sentiment (e.g., "The sentiment appears predominantly positive...").
                * Include \`**Positive Sentiment Factors:**\` followed by a bulleted list (\`-\`).
                * Include \`**Cautionary Sentiment Elements:**\` followed by a bulleted list (\`-\`).
            4.  ## Discussion Prominence
                * Start with a paragraph describing overall discussion level. Give at least 5 sentences
                * Then report the following in format as describe below:.
                    * 1. Annual Revenue:   
                    * 2. Market Cap: 
                    * 3. Sentiment:  
            5.  ## Financial Data
                * Include \`**Stock Price Data (Recent Closing Prices):**\` followed by a bulleted list (\`-\`) with dates and prices.
                * Include \`**Quarterly Revenue:**\` followed by the latest reported figure and period.
                * Include \`**Additional Financial Metrics:**\` followed by a bulleted list (\`-\`) of items like projected margin, dividend, buybacks.
                * Include \`**Technical Analysis Projections:**\` with \`Optimistic forecast:\` and \`Pessimistic forecast:\` details if available.

            Ensure the output strictly follows this Markdown structure.
            Do not include any citation in response.
            Below is an example response generate it exactly the same as that :

            ## Description
            Apple Inc. is navigating a dynamic market landscape, balancing strong financial performance with strategic shareholder returns and future growth considerations.
            ## Narrative Themes
            The following recurring narrative themes emerge for Apple during the specified period:
            **Q2 2025 Financial Performance**
            Apple recently announced its fiscal 2025 second quarter results (ended March 29, 2025), revealing revenue of approximately $95.4 billion. This performance exceeded market expectations, indicating the company's continued ability to deliver strong financial results despite challenging market conditions.
            **Shareholder Returns Program**
            A major theme in Apple's current narrative is its substantial shareholder return initiatives. The company has announced a large-scale share buyback program worth $110 billion alongside a 4% increase in quarterly dividends to $0.26 per share. This generous capital return strategy appears to be a significant focus for investors examining Apple during this period.
            **Future Growth Outlook**
            Apple's forward guidance is cautiously optimistic, projecting revenue growth for Q3 2025 in the low to mid-single-digit range, with an expected gross margin between 45.5% and 46.5%. This measured outlook reflects both opportunities and challenges the company anticipates in the coming months.
            ## Sentiment Analysis
            The sentiment surrounding Apple during this period appears predominantly positive with some cautionary elements:
            **Positive Sentiment Factors:**
            - The better-than-expected Q2 2025 financial results have generated positive investor sentiment
            - The substantial shareholder returns program (buybacks and dividend increases) has been well-received
            - Technical analysis suggests a potential for further price growth, with AAPL trading within an ascending channel
            **Cautionary Sentiment Elements:**
            - Apple's guidance for Q3 2025 reflects "cautious optimism" rather than robust confidence
            - Market pressures and internal challenges are acknowledged in company projections
            - Analysis indicates a potential bearish scenario if support levels at $195 are breached
            Overall, the sentiment leans positive but with awareness of potential headwinds.
            ## Discussion Prominence
            Apple maintains significant prominence in investment discussions during this period. They are expanding very fast.
                    * 1. Annual Revenue: $97.69 billion
                    * 2. Market Cap: $1.08 trillion
                    * 3. Sentiment:  Optimistic
            ## Financial Data
            **Stock Price Data (Recent Closing Prices)**
            - May 2, 2025: $205.35
            - May 1, 2025: $213.32
            - April 30, 2025: $212.50
            - April 29, 2025: $211.21
            **Quarterly Revenue**
            - Q2 FY2025 (ended March 29, 2025): Approximately $95.4 billion
            **Additional Financial Metrics**
            - Projected gross margin for Q3 2025: Between 45.5% and 46.5%
            - Quarterly dividend: Increased by 4% to $0.26 per share
            - Share buyback program: $110 billion announced
            **Technical Analysis Projections**
            - Optimistic forecast: Potential breakout above $210 resistance toward historical peak of $260
            - Pessimistic forecast: Possible decline to $165 if support at $195 breaks
            The stock has demonstrated moderate volatility in recent trading, with price fluctuations between approximately $205 and $213 in early May 2025.
            """
        )
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        return self.get_response(messages, deep_research=False)

    def strategy(self, ticker: str, timeframe: str) -> dict:
        if not isinstance(ticker, str) or not ticker.strip():
            # Mimic dict structure for consistency, though it's an error.
            return {"error": "Invalid ticker name."}
        if timeframe not in ['intraday', 'weekly', 'monthly']:
            return {"error": f"Invalid timeframe: {timeframe}. Must be one of ['intraday', 'weekly', 'monthly']."}
            
        try:
            # sonar_api_key for TimeBasedStrategyGenerator is the Perplexity key
            generator = TimeBasedStrategyGenerator(
                alpha_vantage_api_key=self.alpha_advantage_key, 
                sonar_api_key=self.perplexity_api_key 
            )
            strategy_output = generator.generate_strategy(ticker=ticker, timeframe=timeframe)
            return strategy_output
        except Exception as e:
            return {"error": f"An error occurred while generating strategy: {e}"}
    
    def dashboard(self):
        system_prompt = (""" You are an expert financial analyst AI. Your task is to identify one dominant current market narrative for each specified financial sector.
                        You MUST respond with a single JSON object. This object MUST contain a key named "narratives".
                        The value for "narratives" MUST be an array of JavaScript objects. Each object in the array represents a single narrative
                        for one of the specified financial sectors and MUST strictly follow this structure:
                        {
                        "id": "string (unique slug-like ID, e.g., 'tech-ai-dominance')",
                        "title": "string (concise title for the narrative, max 5 words)",
                        "category": "string (the financial sector it belongs to, exactly as provided in the input list)",
                        "summary": "string (brief 1-2 sentence summary mentioning 1-2 key publicly traded companies (and their tickers if commonly known) most affected by this specific narrative)",
                        "sentiment": "string ('positive', 'negative', 'mixed', or 'emerging')",
                        "volume": "number (estimated discussion volume score for this narrative, 0-100, where 100 is extremely high volume)",
                        "momentumScore": "number (estimated momentum score for this narrative, 0-100, where 100 is peak momentum)",
                        "details": "string (a slightly more detailed explanation, 2-3 sentences, of this narrative and its implications, drawing from current information)",
                        "keyDevelopments": "array of strings (1-2 recent key developments or news bullet points specifically related to this narrative)"
                        }
                        Ensure all fields are present and correctly typed for each narrative object.
                        Generate exactly one narrative object for each of the provided sectors. Do not include any explanatory text before or after the JSON object itself.
                        The output must be parsable by JSON.parse().""")
        user_prompt = ("""For each of the following financial sectors: ["Technology", "Energy", "Financials", "Consumer Discretionary", "Healthcare", "Industrials", "Real Estate", "Cybersecurity"].
                        Provide one dominant current narrative primarily impacting publicly traded companies for each sector.
                        Follow the exact JSON structure defined in the system prompt.
                        Synthesize information from recent web searches to ensure relevance and timeliness for each narrative.
                        Ensure the 'category' field in each narrative object matches one of the input sectors.""")
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        return self.get_response(messages, deep_research=False)

    def assist(self,question):
        system_prompt= ( "You are an expert in stock and finance. Serve as a helpful assistant for questions related to these topics."+
                            "Make sure to not include any preference or citations in the response")
        user_prompt = (f"Answer the following question : {question}")
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        return self.get_response(messages, deep_research=False)
            


    def get_response(self, messages, deep_research=False):
        try:
            with httpx.Client() as client:              
                model = "sonar-deep-research" if deep_research else "sonar-pro"
                response = client.post(
                    "https://api.perplexity.ai/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.perplexity_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "messages": messages,
                    },
                    timeout=600.0
                )
                response.raise_for_status()
                response_data = response.json()

                if "choices" in response_data and len(response_data["choices"]) > 0:
                    text = response_data["choices"][0]["message"]["content"].strip()
                    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
                    text = re.sub(r"\[[1-3]\]", "", text) # Removes citations like [1], [2], [3]
                    return text
                else:
                    return "Could not retrieve a valid response from the AI model. No choices in response."

        except httpx.HTTPStatusError as e:
            return f"An API error occurred: {e.response.status_code} - {e.response.text}"
        except Exception as e:
            return f"An unexpected error occurred: {e}. Please check inputs and API key validity."

# --- MLFlow Model Wrapper ---
class FinancialAnalyzerMLflowModel(mlflow.pyfunc.PythonModel):
    def load_context(self, context):
        
        loaded_keys = load_api_keys_from_file(API_KEYS_FILEPATH)
        perplexity_api_key = loaded_keys.get("PERPLEXITY_API_KEY")
        alpha_advantage_key = loaded_keys.get("ALPHA_ADVANTAGE_KEY")
        
        if not perplexity_api_key or not alpha_advantage_key:
            raise ValueError("API keys (MLFLOW_PPLX_API_KEY, MLFLOW_ALPHA_VANTAGE_API_KEY) must be set in the MLFlow model's environment.")
        
        self.analyzer = FinancialSonarAnalyzer(
            perplexity_api_key=perplexity_api_key,
            alpha_advantage_key=alpha_advantage_key
        )
        if "TimeBasedStrategyGenerator" not in globals() and "strategy" not in globals():
            print("Warning: TimeBasedStrategyGenerator might not be available to MLFlow model if strategy.py was not packaged.")


    def predict(self, context, model_input: pd.DataFrame) -> pd.Series:
        results = []
        for index, row in model_input.iterrows():
            action = row.get('action')
            company_name = row.get('company_name')
            stock_name = row.get('stock_name', company_name) # Default to company_name if stock_name not provided
            lookback = row.get('lookback')
            timeframe = row.get('timeframe')
            question = row.get('question')
            result_data = {"error": "Invalid action or missing parameters"}
            print(action)
            try:
                if action == "news":
                    if company_name:
                        result_data = self.analyzer.news(str(company_name))
                        print(result_data)
                    else:
                        result_data = "Company name required for news action."
                elif action == "sentiment":
                    if stock_name:
                        result_data = self.analyzer.sentiment(str(stock_name))
                    else:
                        result_data = "Stock name required for sentiment action."
                elif action == "risk":
                    if stock_name:
                        result_data = self.analyzer.risk(str(stock_name))
                    else:
                        result_data = "Stock name required for risk action."
                elif action == "research":
                    if stock_name and lookback is not None:
                        result_data = self.analyzer.research(str(stock_name), int(lookback))
                    else:
                        result_data = "Stock name and lookback period required for research action."
                elif action == "strategy":
                    if stock_name and timeframe: # Ticker is stock_name for strategy
                        result_data = self.analyzer.strategy(str(stock_name), str(timeframe))
                    else:
                        result_data = "Ticker (stock_name) and timeframe required for strategy action."
                elif action == "dashboard":
                    result_data = self.analyzer.dashboard()
                    print(result_data)
                elif action == "assist":
                    result_data = self.analyzer.assist(str(question))
                    print(result_data)

                else:
                    result_data = f"Unknown action: {action}"
            except Exception as e:
                result_data = f"Error during action '{action}': {str(e)}"
            
            results.append(json.dumps(result_data) if isinstance(result_data, dict) else result_data)
        return pd.Series(results)

# --- FastAPI Application ---
app = FastAPI(
    title="Financial Sonar API",
    version="1.0.0",
    description="API for financial analysis using Perplexity AI and Alpha Vantage."
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allows your frontend origin
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods (GET, POST, etc.)
    allow_headers=["*"], # Allows all headers
)


# Dependency to get API keys for FastAPI app
# In a real "AIS" or cloud deployment, these would be configured securely.
def get_api_keys():
    loaded_keys = load_api_keys_from_file(API_KEYS_FILEPATH)
    perplexity_key =loaded_keys.get("PERPLEXITY_API_KEY")
    alpha_key = loaded_keys.get("ALPHA_ADVANTAGE_KEY")
    if not perplexity_key or not alpha_key:
        raise HTTPException(
            status_code=503, 
            detail="API keys (PERPLEXITY_API_KEY, ALPHA_ADVANTAGE_KEY) are not configured on the server."
        )
    return {"perplexity_api_key": perplexity_key, "alpha_advantage_key": alpha_key}

# Dependency to get FinancialSonarAnalyzer instance
# This creates a new instance per request, which is safer if state were involved,
# but for this stateless analyzer, a global instance could also work (see @app.on_event("startup")).
# For simplicity and to ensure keys are fresh if they could change, this is fine.
def get_analyzer(keys: dict = Depends(get_api_keys)):
    try:
        return FinancialSonarAnalyzer(
            perplexity_api_key=keys["perplexity_api_key"],
            alpha_advantage_key=keys["alpha_advantage_key"]
        )
    except ValueError as e: # Catch init errors from missing keys passed by get_api_keys
        raise HTTPException(status_code=503, detail=str(e))


# Pydantic Models for request bodies
class CompanyInput(BaseModel):
    company_name: str = Field(..., example="AAPL", description="The name or ticker of the company.")

class AssistInput(BaseModel):
    question: str = Field(..., example="What is a financial statement", description="Question user ask.")

class StockInput(BaseModel):
    stock_name: str = Field(..., example="MSFT", description="The name or ticker of the stock.")

class ResearchInput(BaseModel):
    stock_name: str = Field(..., example="GOOGL", description="The name or ticker of the stock.")
    lookback: int = Field(..., gt=0, example=30, description="Number of days to look back for research (positive integer).")

class StrategyInput(BaseModel):
    ticker: str = Field(..., example="IBM", description="The stock ticker.")
    timeframe: str = Field(..., example="intraday", pattern="^(intraday|weekly|monthly)$", description="Timeframe for the strategy ('intraday', 'weekly', 'monthly').")

# Helper to handle analyzer responses for FastAPI
def handle_analyzer_response(result: str | dict):
    if isinstance(result, str) and ("An error occurred" in result or "Invalid" in result.lower() or "Could not retrieve" in result):
        # More specific error codes could be mapped if desired
        raise HTTPException(status_code=400, detail=result)
    if isinstance(result, dict) and "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@app.post("/news", summary="Get concise news summary for a company")
async def api_get_news(data: CompanyInput, analyzer: FinancialSonarAnalyzer = Depends(get_analyzer)):
    result = analyzer.news(data.company_name)
    print(handle_analyzer_response(result))
    return {"summary": handle_analyzer_response(result)}

@app.post("/sentiment", summary="Get sentiment drivers for a stock")
async def api_get_sentiment(data: StockInput, analyzer: FinancialSonarAnalyzer = Depends(get_analyzer)):
    result = analyzer.sentiment(data.stock_name)
    return {"result": handle_analyzer_response(result)}

@app.post("/risk", summary="Get risk assessment for a stock")
async def api_get_risk(data: StockInput, analyzer: FinancialSonarAnalyzer = Depends(get_analyzer)):
    result = analyzer.risk(data.stock_name)
    return {"result": handle_analyzer_response(result)}
    
@app.post("/research", summary="Get detailed narrative analysis report for a stock")
async def api_get_research(data: ResearchInput, analyzer: FinancialSonarAnalyzer = Depends(get_analyzer)):
    result = analyzer.research(data.stock_name, data.lookback)
    return {"summary": handle_analyzer_response(result)}

@app.post("/strategy", summary="Generate a time-based trading strategy for a ticker")
async def api_get_strategy(data: StrategyInput, analyzer: FinancialSonarAnalyzer = Depends(get_analyzer)):
    result = analyzer.strategy(data.ticker, data.timeframe) # This method returns a dict
    return {"result": handle_analyzer_response(result)}

@app.post("/dashboard", summary="Generate data for momentum dashboard")
async def api_get_dashboard(analyzer: FinancialSonarAnalyzer = Depends(get_analyzer)):
    result = analyzer.dashboard() # This method returns a dict
    return {"result": handle_analyzer_response(result)}

@app.post("/assist", summary="Generate data for general question")
async def api_get_assist(data: AssistInput, analyzer: FinancialSonarAnalyzer = Depends(get_analyzer)):
    result = analyzer.assist(data.question) # 
    return {"result": handle_analyzer_response(result)}

# --- Main Execution Block ---
if __name__ == "__main__":
    loaded_keys = load_api_keys_from_file(API_KEYS_FILEPATH)
    PERPLEXITY_API_KEY = loaded_keys.get("PERPLEXITY_API_KEY")
    ALPHA_ADVANTAGE_KEY = loaded_keys.get("ALPHA_ADVANTAGE_KEY")

    if not PERPLEXITY_API_KEY or not ALPHA_ADVANTAGE_KEY:
        print("ERROR: Both PERPLEXITY_API_KEY and ALPHA_ADVANTAGE_KEY environment variables must be set.")
        print("Example usage:")
        print("  export PERPLEXITY_API_KEY='your_pplx_key'")
        print("  export ALPHA_ADVANTAGE_KEY='your_alpha_vantage_key'")
        print("Then run the script with an action: python your_script_name.py <action>")
        print("Available actions: test_analyzer, log_mlflow_model, run_api_server")
        # exit(1) # Commented out to allow script to be imported without exiting

    # Command-line argument to decide what to do
    import sys
    action = sys.argv[1] if len(sys.argv) > 1 else None

    if action == "test_analyzer":
        if not PERPLEXITY_API_KEY or not ALPHA_ADVANTAGE_KEY:
            print("API keys missing. Cannot test analyzer.")
        else:
            print("--- Testing FinancialSonarAnalyzer ---")
            analyzer = FinancialSonarAnalyzer(PERPLEXITY_API_KEY, ALPHA_ADVANTAGE_KEY)
            
            print("\nFetching news for 'NVDA'...")
            news_summary = analyzer.news("NVDA")
            print(f"News Summary for NVDA:\n{news_summary}")

            print("\nFetching sentiment for 'TSLA'...")
            sentiment_summary = analyzer.sentiment("TSLA")
            print(f"Sentiment for TSLA:\n{sentiment_summary}")
            
            print("\nFetching risk for 'MSFT'...")
            risk_summary = analyzer.risk("MSFT")
            print(f"Risk for MSFT:\n{risk_summary}")

            print("\nFetching research for 'AAPL' (30 days)...")
            research_summary = analyzer.research("AAPL", 30)
            print(f"Research for AAPL (30 days):\n{research_summary}")

            print("\nFetching intraday strategy for 'GOOG'...")
            # Ensure strategy.py's TimeBasedStrategyGenerator is available for this test
            strategy_summary = analyzer.strategy("GOOG", "intraday")
            print(f"Strategy for GOOG (intraday):\n{strategy_summary}")
            print("--- Test Complete ---")

    elif action == "log_mlflow_model":
        print("--- Logging Model to MLFlow ---")
        
        MLFLOW_TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", "./mlruns")
        mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
        print(f"MLFlow Tracking URI set to: {MLFLOW_TRACKING_URI}")
        
        # Define an experiment name
        experiment_name = "QuantumFinanceExperiments" # You can choose any name

        # Check if the experiment exists, and create it if it doesn't
        experiment = mlflow.get_experiment_by_name(experiment_name)
        if experiment is None:
            print(f"Experiment '{experiment_name}' not found. Creating new experiment.")
            try:
                mlflow.create_experiment(experiment_name)
            except mlflow.exceptions.MlflowException as e:
                # Handle cases where experiment creation might fail due to backend issues
                # or if it was created by a concurrent process.
                print(f"Could not create experiment '{experiment_name}': {e}")
                # Re-fetch in case it was created by a concurrent process
                experiment = mlflow.get_experiment_by_name(experiment_name)
                if experiment is None:
                    raise # Re-raise if it truly couldn't be created or found
        
        mlflow.set_experiment(experiment_name) # Set the active experiment

        if not PERPLEXITY_API_KEY or not ALPHA_ADVANTAGE_KEY:
            print("API keys missing. Cannot test analyzer.")
        else:
            mlflow_tracking_uri = os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5000")
            mlflow.set_tracking_uri(mlflow_tracking_uri)
            model_name = "QuantumFinanceModel"
            pip_requirements = [
                f"mlflow>={mlflow.__version__}", # Use the installed mlflow version
                "pandas",
                "httpx",
                "requests",
                "fastapi",
                "uvicorn",
                "pydantic",
                "virtualenv"
            ]
            current_script_name = os.path.basename(__file__)
            code_paths = [current_script_name, "strategy.py"]
            print('start run')

            with mlflow.start_run() as run:
                run_id = run.info.run_id
                print(f"Starting MLflow run with ID: {run_id}")
                
                # Log parameters (do not log actual keys)
                mlflow.log_param("model_type", "FinancialAnalysisOrchestrator")
                mlflow.log_param("perplexity_model_primary", "sonar-pro")
                mlflow.log_param("perplexity_model_research", "sonar-deep-research")
                input_example = pd.DataFrame({
                    "action": ["news", "sentiment", "research", "strategy", "assist","dashboard"],
                    "company_name": ["AAPL", None, None, None, None,None],
                    "stock_name": [None, "MSFT", "GOOGL", "TSLA", None,None],
                    "lookback": [None, None, 30, None, None,None],
                    "timeframe": [None, None, None, "monthly", None,None],
                    "question": [None, None, None, None, "What are P/E ratios?",None]
                })
                output_example = pd.Series([
                    json.dumps({"summary": "Example news summary for AAPL."}),
                    json.dumps({"result": "Example sentiment for MSFT."}),
                    json.dumps({"summary": "Example research for GOOGL."}),
                    json.dumps({"result": {"ticker": "TSLA", "timeframe": "monthly", "advice": "mock_advice"}}),
                    json.dumps({"result": "P/E ratios are..."})
                ])
                from mlflow.models import infer_signature

                signature = infer_signature(input_example, output_example)

                mlflow.pyfunc.log_model(
                    artifact_path="financial_analyzer_mlflow_model",
                    python_model=FinancialAnalyzerMLflowModel(),
                    code_paths=code_paths, # Bundle this script and strategy.py
                    pip_requirements=pip_requirements, # Use pip_requirements here
                    registered_model_name=model_name,
                    signature=signature,
                    input_example=input_example
                )
                print(f"Model '{model_name}' logged with run ID {run_id} and registered to MLFlow URI: {mlflow_tracking_uri}")
                print("--- MLFlow Logging Complete ---")

    elif action == "run_api_server":
        if not PERPLEXITY_API_KEY or not ALPHA_ADVANTAGE_KEY:
            print("API keys PERPLEXITY_API_KEY and ALPHA_ADVANTAGE_KEY must be set in the environment to run the API server.")
        else:
            print("--- Starting FastAPI Server ---")
            print("Access the API at http://localhost:8000")
            print("Swagger UI (API Docs) available at http://localhost:8000/docs")
            uvicorn.run(app, host="0.0.0.0", port=8000)
            # Note: For production, you'd use a more robust setup, e.g., gunicorn with uvicorn workers.

    else:
        print("Usage: python your_script_name.py <action>")
        print("Available actions:")
        print("  test_analyzer        - Run local tests of the FinancialSonarAnalyzer methods.")
        print("  log_mlflow_model     - Log and register the model to MLFlow.")
        print("  run_api_server       - Start the FastAPI server for API access and Swagger docs.")
       