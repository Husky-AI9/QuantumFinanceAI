import requests
import pandas as pd
from datetime import datetime, timedelta
import json
import io 
import httpx
import re

class TimeBasedStrategyGenerator:
    ALPHA_VANTAGE_BASE_URL = "https://www.alphavantage.co/query"
    def __init__(self, alpha_vantage_api_key: str, sonar_api_key: str):
        self.alpha_vantage_api_key = alpha_vantage_api_key
        self.sonar_api_key = sonar_api_key # Stored, though the call is mocked

    def _fetch_alpha_vantage_data(self, ticker: str, timeframe: str) -> pd.DataFrame | None:
        """
        Fetches historical stock data from Alpha Vantage based on the timeframe.
        """
        params = {
            "symbol": ticker,
            "apikey": self.alpha_vantage_api_key,
        }
        data_key_map = {
            "intraday": "Time Series (5min)", # Example, could be 1min, 15min etc.
            "weekly": "Time Series (Daily)",
            "monthly": "Monthly Adjusted Time Series"
        }

        if timeframe == "intraday":
            params["function"] = "TIME_SERIES_INTRADAY"
            params["interval"] = "5min" # Configurable: '1min', '5min', '15min', '30min', '60min'
            params["outputsize"] = "full" # Get more data to ensure we capture the latest full day
            data_key = data_key_map["intraday"]
        elif timeframe == "weekly":
            params["function"] = "TIME_SERIES_DAILY_ADJUSTED"
            params["outputsize"] = "compact" # Last 100 data points
            data_key = data_key_map["weekly"]
        elif timeframe == "monthly":
            params["function"] = "TIME_SERIES_MONTHLY_ADJUSTED"
            data_key = data_key_map["monthly"]
        else:
            print(f"Error: Invalid timeframe '{timeframe}'. Choose 'intraday', 'weekly', or 'monthly'.")
            return None

        try:
            response = requests.get(self.ALPHA_VANTAGE_BASE_URL, params=params)
            response.raise_for_status()  # Raise an exception for HTTP errors
            data = response.json()

            if "Error Message" in data:
                print(f"Alpha Vantage API Error: {data['Error Message']}")
                return None
            if "Note" in data and "API call frequency" in data["Note"]:
                print(f"Alpha Vantage API Info: {data['Note']}")
                # Potentially return None or raise a specific exception for rate limiting
                # For now, we'll try to proceed if data_key is present
            
            if data_key not in data:
                print(f"Error: Unexpected response structure. Missing key: {data_key}")
                print("Full response:", data)
                return None

            df = pd.DataFrame.from_dict(data[data_key], orient='index')
            df = df.astype(float) # Convert numeric columns
            df.index = pd.to_datetime(df.index)
            df = df.sort_index(ascending=True)

            # Rename columns to a standard format (OHLCV)
            if timeframe == "monthly":
                df.rename(columns={
                    '1. open': 'open', '2. high': 'high',
                    '3. low': 'low', '4. close': 'close',
                    '6. volume': 'volume' # Monthly data has '5. adjusted close', '6. volume'
                }, inplace=True)
                # Keep only relevant columns if others exist (like '5. adjusted close', '7. dividend amount')
                df = df[['open', 'high', 'low', 'close', 'volume']]
            else: # intraday, daily
                df.rename(columns={
                    '1. open': 'open', '2. high': 'high',
                    '3. low': 'low', '4. close': 'close',
                    '5. volume': 'volume'
                }, inplace=True)


            # Filter data based on timeframe requirements
            if timeframe == "intraday":
                if df.empty:
                    print("No intraday data found.")
                    return None
                latest_day = df.index.max().date()
                df = df[df.index.date == latest_day]
                if df.empty:
                    print(f"No intraday data found for the latest day: {latest_day}")
                    return None
                print(f"Fetched intraday data for {ticker} on {latest_day}, {len(df)} records.")

            elif timeframe == "weekly":
                if len(df) < 7:
                    print(f"Not enough daily data for a 7-day weekly analysis (found {len(df)} days). Using available data.")
                    if df.empty: return None
                df = df.tail(7)
                print(f"Fetched last 7 trading days for {ticker}, from {df.index.min().date()} to {df.index.max().date()}.")

            elif timeframe == "monthly":
                # For monthly, Alpha Vantage returns data with the month-end date.
                # We might want the last N months, e.g., 24 months for context.
                df = df.tail(24) # Get last 24 months
                if df.empty:
                    print(f"No monthly data found for {ticker}")
                    return None
                print(f"Fetched last {len(df)} months for {ticker}, from {df.index.min().date()} to {df.index.max().date()}.")
            
            return df

        except requests.exceptions.RequestException as e:
            print(f"Error fetching data from Alpha Vantage: {e}")
            return None
        except ValueError as e: # For issues with df.astype(float) if non-numeric data sneaks in
            print(f"Error processing data: {e}")
            return None
        except KeyError as e: # For issues with unexpected JSON structure
            print(f"Error parsing Alpha Vantage JSON response (KeyError): {e}. Check API response structure.")
            return None


    def _prepare_data_for_sonar_prompt(self, df: pd.DataFrame) -> str:
        """
        Formats the DataFrame into a CSV-like string for the sonar-api prompt.
        """
        if df.empty:
            return ""
        # Using io.StringIO to get CSV string from DataFrame
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=True) # index=True to include timestamp
        return csv_buffer.getvalue()

    def _call_sonar_api(self, historical_data_str: str, ticker: str, timeframe_description: str) -> str | None:
        print(f"\n--- Simulating call to sonar-api for {ticker} ({timeframe_description}) ---")
        
        # This is where you would construct the actual prompt for your sonar-api
        system_prompt = f"""
            Role: AI Quantitative Strategist (Short-Term Data Analyst)
            Task: Analyze the provided historical stock data for Ticker {ticker} which represents {timeframe_description} and generate a concise, actionable trading strategy.
            The strategy MUST include:
            1. Clear Entry Condition(s): Specific price levels, chart patterns, or simple indicator signals observable *within the provided data*.
            2. Clear Exit Condition(s) - Take Profit: A specific price target or condition.
            3. Clear Exit Condition(s) - Stop Loss: A specific price level or condition.
            4. Suggested Holding Period (implicit or explicit): Should align with the provided timeframe.
            (Optional but Highly Recommended):
            * A brief (1-2 sentences) Rationale explaining why the strategy is proposed based on the observed patterns in the *provided data only*.
            Strict Constraints:
            * The strategy must be based exclusively on the provided historical data segment. DO NOT use any external information.
            * Assume no prior positions.
            """
        user_prompt = f"""
            
            **Analysis Request for Trading Strategy**

            **Asset Ticker:** {ticker}
            **Strategy Timeframe:** {timeframe_description}

            **Historical Data Segment:**
            {historical_data_str}
            **Instruction:**
            Please generate a trading strategy based *only* on the historical data provided above, following all instructions outlined in your system role and task definition.
            """
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        with httpx.Client() as client:
                response = client.post(
                    "https://api.perplexity.ai/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.sonar_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "sonar-pro",  # Or "sonar-medium-online"
                        "messages": messages,
                    },
                    timeout=600.0
                )
                response.raise_for_status()  # Raise an exception for bad status codes
                response_data = response.json()
                
                if "choices" in response_data and len(response_data["choices"]) > 0:
                    return response_data["choices"][0]["message"]["content"].strip()
                else:
                    return "Could not retrieve a summary for the given company. No choices in response."
    
    def filter_text(self,text):
        text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
        text = re.sub(r"\[[1-3]\]", "", text)
        return text



    def generate_strategy(self, ticker: str, timeframe: str) -> dict | None:
        """
        Generates a trading strategy for the given ticker and timeframe.

        Args:
            ticker (str): The stock ticker symbol (e.g., "AAPL").
            timeframe (str): The timeframe for the strategy ('intraday', 'weekly', 'monthly').

        Returns:
            dict | None: A dictionary representing the strategy, or None if an error occurs.
        """
        print(f"Generating strategy for Ticker: {ticker}, Timeframe: {timeframe}")
        
        valid_timeframes = ["intraday", "weekly", "monthly"]
        if timeframe not in valid_timeframes:
            print(f"Error: Invalid timeframe '{timeframe}'. Must be one of {valid_timeframes}.")
            return None

        historical_df = self._fetch_alpha_vantage_data(ticker, timeframe)

        if historical_df is None or historical_df.empty:
            print(f"Could not fetch or process historical data for {ticker} ({timeframe}).")
            return None

        # Create timeframe description for the prompt
        if timeframe == "intraday":
            timeframe_description = f"the intraday trading session of {historical_df.index.max().date()}"
        elif timeframe == "weekly":
            timeframe_description = f"the daily trading data from {historical_df.index.min().date()} to {historical_df.index.max().date()} (last {len(historical_df)} trading days)"
        elif timeframe == "monthly":
            timeframe_description = f"the monthly trading data from {historical_df.index.min().strftime('%Y-%m')} to {historical_df.index.max().strftime('%Y-%m')} (last {len(historical_df)} months)"
        else: # Should not happen due to earlier validation
            timeframe_description = timeframe 

        sonar_prompt_data_str = self._prepare_data_for_sonar_prompt(historical_df)
        print(sonar_prompt_data_str)
        if not sonar_prompt_data_str:
            print("Formatted data for sonar-api is empty.")
            return None

        strategy = self._call_sonar_api(sonar_prompt_data_str, ticker, timeframe_description)

        if strategy:
            print(f"Successfully generated strategy for {ticker} ({timeframe}):")

            return self.filter_text(strategy)
        else:
            print(f"Failed to generate strategy from sonar-api for {ticker} ({timeframe}).")
            return None

